import { Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../../lib/http-error.js";
import { prisma } from "../../../lib/prisma.js";
import { describeTransaction, describeWallet } from "../../loyalty/program/loyalty.balance.js";
import { defaultTiers } from "../../loyalty/program/loyalty.config.js";
import { toOrderDto } from "../../commerce/orders/orders.serialization.js";
import { computeCustomerStats, resolveMemberTier } from "./customers.domain.js";
import type {
  CustomerDetailDto,
  CustomerListQuery,
  CustomerSummaryDto,
  PaginationDto,
} from "./customers.types.js";

export async function listMerchantCustomers(
  merchantId: number,
  query: CustomerListQuery,
): Promise<{ items: CustomerSummaryDto[]; pagination: PaginationDto; tiers: { level: string; name: string }[] }> {
  const [configuredTiers, rule] = await Promise.all([
    prisma.loyaltyTier.findMany({ where: { merchantId, isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.loyaltyRule.findUnique({ where: { merchantId } }),
  ]);
  const tiers = configuredTiers.length ? configuredTiers : defaultTiers;
  const mode = rule?.qualificationMode ?? "POINTS";
  const rankedTiers = tiers
    .map((tier) => ({
      level: tier.level,
      threshold: mode === "SPEND"
        ? ("minSpendVnd" in tier ? tier.minSpendVnd : null)
        : tier.minLifetimePoints,
    }))
    .filter((tier) => tier.threshold != null)
    .sort((left, right) => new Prisma.Decimal(String(right.threshold)).comparedTo(String(left.threshold)));
  const tierCases = rankedTiers.map((tier) =>
    Prisma.sql`WHEN m.qualificationProgress >= ${new Prisma.Decimal(String(tier.threshold))} THEN ${tier.level}`,
  );
  const earned = Prisma.sql`EXISTS (
    SELECT 1 FROM \`LoyaltyWallet\` w JOIN \`PointTransaction\` t ON t.walletId = w.id
    WHERE w.membershipId = m.id AND t.type = 'EARN'
  )`;
  const tierExpression = tierCases.length
    ? Prisma.sql`CASE WHEN m.tierId IS NOT NULL OR ${earned}
        THEN CASE ${Prisma.join(tierCases, " ")} ELSE 'UNRANKED' END
        ELSE 'UNRANKED' END`
    : Prisma.sql`'UNRANKED'`;
  const pattern = query.q ? `%${query.q.replace(/[\\%_]/g, "\\$&")}%` : "";
  const searchFilter = query.q
    ? Prisma.sql`AND (u.email LIKE ${pattern} OR u.name LIKE ${pattern} OR u.phone LIKE ${pattern})`
    : Prisma.empty;
  const hasOrders = Prisma.sql`EXISTS (
    SELECT 1 FROM \`Order\` o WHERE o.merchantId = m.merchantId AND o.memberId = m.memberId
      AND o.status IN ('PAID', 'REFUND_PENDING')
  )`;
  const purchaseFilter = query.purchaseStatus === "buyers" ? Prisma.sql`AND ${hasOrders}`
    : query.purchaseStatus === "non_buyers" ? Prisma.sql`AND NOT ${hasOrders}` : Prisma.empty;
  const tierFilter = query.tier ? Prisma.sql`AND (${tierExpression}) = ${query.tier}` : Prisma.empty;
  const where = Prisma.sql`FROM \`MerchantMembership\` m JOIN \`User\` u ON u.id = m.memberId
    WHERE m.merchantId = ${merchantId} ${searchFilter} ${purchaseFilter} ${tierFilter}`;
  const [ids, counts] = await prisma.$transaction([
    prisma.$queryRaw<{ id: number }[]>(Prisma.sql`SELECT m.id ${where} ORDER BY m.createdAt DESC, m.id DESC
      LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`),
    prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS total ${where}`),
  ]);
  const memberships = ids.length ? await prisma.merchantMembership.findMany({
    where: { merchantId, id: { in: ids.map(({ id }) => id) } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      member: { select: { id: true, email: true, name: true, phone: true } },
      wallet: { include: { _count: { select: { transactions: { where: { type: "EARN" } } } } } },
    },
  }) : [];
  const memberIds = memberships.map(({ memberId }) => memberId);
  const orderGroups = memberIds.length ? await prisma.order.groupBy({
    by: ["memberId", "status"],
    where: { merchantId, memberId: { in: memberIds }, status: { in: ["PAID", "REFUND_PENDING"] } },
    orderBy: [{ memberId: "asc" }, { status: "asc" }],
    _count: { _all: true }, _sum: { total: true }, _max: { paidAt: true },
  }) : [];

  const statsByMember = new Map<
    number,
    {
      paidOrderCount: number;
      refundPendingOrderCount: number;
      paidSpend: Prisma.Decimal;
      refundPendingSpend: Prisma.Decimal;
      lastPurchaseAt: Date | null;
    }
  >();

  for (const row of orderGroups) {
    const entry = statsByMember.get(row.memberId) ?? {
      paidOrderCount: 0,
      refundPendingOrderCount: 0,
      paidSpend: new Prisma.Decimal(0),
      refundPendingSpend: new Prisma.Decimal(0),
      lastPurchaseAt: null,
    };
    const count = typeof row._count === "object" && row._count !== null ? row._count._all ?? 0 : 0;
    const sum = row._sum?.total ?? new Prisma.Decimal(0);
    const maxPaidAt = row._max?.paidAt ?? null;
    if (row.status === "PAID") {
      entry.paidOrderCount += count;
      entry.paidSpend = entry.paidSpend.plus(sum);
    } else if (row.status === "REFUND_PENDING") {
      entry.refundPendingOrderCount += count;
      entry.refundPendingSpend = entry.refundPendingSpend.plus(sum);
    }
    if (maxPaidAt && (!entry.lastPurchaseAt || maxPaidAt > entry.lastPurchaseAt)) {
      entry.lastPurchaseAt = maxPaidAt;
    }
    statsByMember.set(row.memberId, entry);
  }

  const summaries: CustomerSummaryDto[] = memberships.map((membership) => {
    const walletInfo = describeWallet(membership.wallet);
    const tier = resolveMemberTier({
      tierId: membership.tierId,
      hasEarnTransaction: (membership.wallet?._count.transactions ?? 0) > 0,
      netLifetimeEarned: walletInfo.netLifetimeEarned,
      qualificationProgress: membership.qualificationProgress,
      qualificationMode: rule?.qualificationMode ?? "POINTS",
      tiers,
    });
    const orderStats = statsByMember.get(membership.memberId);
    const paidOrderCount = orderStats?.paidOrderCount ?? 0;
    const refundPendingOrderCount = orderStats?.refundPendingOrderCount ?? 0;
    const refundPendingSpend = orderStats?.refundPendingSpend ?? new Prisma.Decimal(0);
    const netSpend = (orderStats?.paidSpend ?? new Prisma.Decimal(0)).plus(refundPendingSpend);

    return {
      memberId: membership.member.id,
      email: membership.member.email,
      name: membership.member.name,
      phone: membership.member.phone,
      joinedAt: membership.createdAt.toISOString(),
      tier,
      availablePoints: walletInfo.availablePoints,
      exactBalance: walletInfo.exactBalance,
      fractionalCarry: walletInfo.fractionalCarry,
      netLifetimeEarned: walletInfo.netLifetimeEarned,
      pointDebt: walletInfo.pointDebt,
      paidOrderCount,
      refundPendingOrderCount,
      refundPendingSpendVnd: refundPendingSpend.toFixed(0),
      netSpendVnd: netSpend.toFixed(0),
      lastPurchaseAt: orderStats?.lastPurchaseAt ? orderStats.lastPurchaseAt.toISOString() : null,
    };
  });

  const totalItems = Number(counts[0]?.total ?? 0);
  const totalPages = Math.ceil(totalItems / query.limit);
  const items = summaries;

  return {
    items,
    tiers: tiers.map(({ level, name }) => ({ level, name })),
    pagination: {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages,
    },
  };
}

export async function getMerchantCustomerDetail(
  merchantId: number,
  memberId: number,
  paging?: Record<"orders" | "pointLedger" | "vouchers", { page: number; limit: number }>,
): Promise<{ customer: CustomerDetailDto }> {
  const membership = await prisma.merchantMembership.findUnique({
    where: { memberId_merchantId: { memberId, merchantId } },
    include: {
      member: { select: { id: true, email: true, name: true, phone: true, address: true, birthDate: true } },
      wallet: {
        include: {
          transactions: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: paging?.pointLedger.limit ?? 50,
            ...(paging ? { skip: (paging.pointLedger.page - 1) * paging.pointLedger.limit } : {}),
          },
          _count: { select: { transactions: { where: { type: "EARN" } } } },
        },
      },
    },
  });

  if (!membership) {
    throw new HttpError(404, "MEMBER_NOT_FOUND");
  }

  const [rule, configuredTiers, vouchers, orders] = await prisma.$transaction([
    prisma.loyaltyRule.findUnique({ where: { merchantId } }),
    prisma.loyaltyTier.findMany({ where: { merchantId, isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.memberVoucher.findMany({
      where: { membershipId: membership.id },
      include: { membership: true, activeReservation: true },
      orderBy: [{ redeemedAt: "desc" }, { id: "desc" }],
      ...(paging ? { skip: (paging.vouchers.page - 1) * paging.vouchers.limit, take: paging.vouchers.limit } : {}),
    }),
    prisma.order.findMany({
      where: { merchantId, memberId },
      include: {
        items: true,
        pointTransactions: true,
        refund: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(paging ? { skip: (paging.orders.page - 1) * paging.orders.limit, take: paging.orders.limit } : {}),
    }),
  ]);

  const counts = paging ? await Promise.all([
    prisma.order.count({ where: { merchantId, memberId } }),
    prisma.pointTransaction.count({ where: { wallet: { membershipId: membership.id } } }),
    prisma.memberVoucher.count({ where: { membershipId: membership.id } }),
    prisma.order.groupBy({ by: ["status"], where: { merchantId, memberId }, _count: { _all: true }, _sum: { total: true }, _max: { paidAt: true } }),
  ]) : null;
  const groups = counts?.[3] ?? [];
  const group = (status: string) => groups.find((entry) => entry.status === status);
  const paid = group("PAID");
  const pending = group("REFUND_PENDING");
  const refunded = group("REFUNDED");
  const netSpend = (paid?._sum.total ?? new Prisma.Decimal(0)).plus(pending?._sum.total ?? 0);
  const qualifyingCount = (paid?._count._all ?? 0) + (pending?._count._all ?? 0);
  const paidDates = [paid?._max.paidAt, pending?._max.paidAt].filter((date): date is Date => Boolean(date));
  const stats = counts ? {
    totalOrders: counts[0],
    paidOrderCount: paid?._count._all ?? 0,
    refundPendingOrderCount: pending?._count._all ?? 0,
    refundedOrderCount: refunded?._count._all ?? 0,
    netSpendVnd: netSpend.toFixed(0),
    refundPendingSpendVnd: (pending?._sum.total ?? new Prisma.Decimal(0)).toFixed(0),
    averageOrderValueVnd: qualifyingCount ? netSpend.div(qualifyingCount).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toFixed(0) : "0",
    lastPurchaseAt: paidDates.length ? new Date(Math.max(...paidDates.map((date) => date.getTime()))).toISOString() : null,
  } : computeCustomerStats(orders);
  const pageInfo = (name: "orders" | "pointLedger" | "vouchers", totalItems: number) => {
    const { page, limit } = paging![name];
    return { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) };
  };

  const tiers = configuredTiers.length ? configuredTiers : defaultTiers;
  const walletInfo = describeWallet(membership.wallet);
  const tier = resolveMemberTier({
    tierId: membership.tierId,
    hasEarnTransaction: (membership.wallet?._count.transactions ?? 0) > 0,
    netLifetimeEarned: walletInfo.netLifetimeEarned,
    qualificationProgress: membership.qualificationProgress,
    qualificationMode: rule?.qualificationMode ?? "POINTS",
    tiers,
  });

  return {
    customer: {
      member: {
        id: membership.member.id,
        email: membership.member.email,
        name: membership.member.name,
        phone: membership.member.phone,
        address: membership.member.address,
        birthDate: membership.member.birthDate?.toISOString().slice(0, 10) ?? null,
        joinedAt: membership.createdAt.toISOString(),
      },
      tags: Array.isArray(membership.tags) ? membership.tags.filter((tag): tag is string => typeof tag === "string") : [],
      stats,
      ...(counts ? { pagination: {
        orders: pageInfo("orders", counts[0]),
        pointLedger: pageInfo("pointLedger", counts[1]),
        vouchers: pageInfo("vouchers", counts[2]),
      } } : {}),
      wallet: {
        merchantId,
        policy: {
          merchantId,
          vndPerPoint: rule?.vndPerPoint ?? 10000,
          isActive: rule?.isActive ?? true,
          qualificationMode: rule?.qualificationMode ?? "POINTS",
          tiers: tiers.map((t) => ({ level: t.level, name: t.name, ...(t.minLifetimePoints !== null && t.minLifetimePoints !== undefined ? { minLifetimePoints: t.minLifetimePoints } : {}), ...(t.minSpendVnd !== null && t.minSpendVnd !== undefined ? { minSpendVnd: typeof t.minSpendVnd === "string" ? t.minSpendVnd : t.minSpendVnd.toFixed(0) } : {}), multiplier: typeof t.multiplier === "string" ? t.multiplier : t.multiplier.toFixed(2), benefits: Array.isArray(t.benefits) ? t.benefits.filter((benefit) => typeof benefit === "string") as string[] : [], iconUrl: t.iconUrl, color: t.color })),
        },
        ...walletInfo,
        tier,
      },
      pointLedger: (membership.wallet?.transactions ?? []).map((entry) => ({
        id: entry.id,
        type: entry.type,
        ...describeTransaction(entry),
        reason: entry.reason,
        eventRef: entry.eventRef,
        source: entry.source,
        actorId: entry.actorId,
        orderId: entry.orderId,
        memberVoucherId: entry.memberVoucherId,
        createdAt: entry.createdAt.toISOString(),
      })),
      vouchers: vouchers.map((v) => ({
        id: v.id,
        definitionId: v.definitionId,
        merchantId: v.membership.merchantId,
        memberId: v.membership.memberId,
        title: v.snapshotTitle,
        type: v.snapshotType,
        status: v.status,
        reserved: v.status === "AVAILABLE" && Boolean(v.activeReservation),
        pointsCost: v.snapshotPointsCost,
        discountAmount: v.snapshotDiscountAmount?.toFixed(0) ?? null,
        rewardDescription: v.snapshotRewardDescription,
        redeemedAt: v.redeemedAt.toISOString(),
        usedAt: v.usedAt?.toISOString() ?? null,
      })),
      orders: orders.map(toOrderDto),
    },
  };
}
