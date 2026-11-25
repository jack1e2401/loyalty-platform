import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import type {
  CancelOrderResult,
  CreatePendingOrderInput,
  OrderDto,
  RefundPreviewDto,
} from "./orders.types.js";
import { OrderNotCancellableError } from "./orders.types.js";
import { completePaidOrder } from "./orders.complete-payment.js";
import { withTransactionRetry } from "../../../lib/prisma-transaction.js";
import { calculateDiscountedTotal } from "./order-pricing.js";
import { toOrderDto } from "./orders.serialization.js";
import { HttpError } from "../../../lib/http-error.js";
import { describeWallet, exactPoints } from "../../loyalty/program/loyalty.balance.js";
import { points, selectQualifiedTier } from "../../loyalty/program/loyalty.calculation.js";
import { defaultTiers, loadEarningPolicy } from "../../loyalty/program/loyalty.config.js";
import {
  reserveOrderInventory,
  releaseOrderInventory,
  releaseExpiredMockOrders,
} from "../inventory/inventory.order.js";
import { orderReadRepository } from "./orders.read.repository.js";

export const ordersRepository = {
  ...orderReadRepository,

  async findIdempotentOrder(memberId: number, merchantId: number, idempotencyKey: string, payloadHash: string) {
    const request = await prisma.orderRequest.findUnique({
      where: { merchantId_memberId_idempotencyKey: { merchantId, memberId, idempotencyKey } },
      include: { order: { include: { items: { orderBy: { id: "asc" } }, refund: true, pointTransactions: true } } },
    });
    if (!request) return null;
    if (request.payloadHash !== payloadHash) throw new HttpError(409, "IDEMPOTENCY_KEY_CONFLICT");
    return { order: toOrderDto(request.order), replayed: true as const };
  },

  async createPendingOrder(input: CreatePendingOrderInput): Promise<{ order: OrderDto; replayed: boolean }> {
    let order: Prisma.OrderGetPayload<{
      include: {
        items: true;
        refund: true;
        pointTransactions: true;
      };
    }>;
    try {
      order = await withTransactionRetry(() =>
        prisma.$transaction(
          async (tx) => {
            let requestedDiscount = new Prisma.Decimal(0);
            if (input.voucherId !== null) {
              const voucher = await tx.memberVoucher.findFirst({
                where: {
                  id: input.voucherId,
                  status: "AVAILABLE",
                  membership: {
                    memberId: input.memberId,
                    merchantId: input.merchantId,
                  },
                  snapshotType: "DISCOUNT",
                },
                include: { activeReservation: true },
              });
              if (!voucher) throw new HttpError(404, "VOUCHER_NOT_FOUND");
              if (voucher.activeReservation)
                throw new HttpError(409, "VOUCHER_ALREADY_RESERVED");
              requestedDiscount =
                voucher.snapshotDiscountAmount ?? new Prisma.Decimal(0);
            }
            const { discountAmount, total } = calculateDiscountedTotal(
              input.subtotal,
              requestedDiscount,
            );
            const now = new Date();
            const created = await tx.order.create({
              data: {
                memberId: input.memberId,
                merchantId: input.merchantId,
                status: "PENDING",
                subtotal: input.subtotal,
                discountAmount,
                total,
                voucherId: input.voucherId,
                stockReservedAt: now,
                stockReservedUntil: new Date(now.getTime() + 5 * 60 * 1000),
                paidAt: null,
                items: { create: input.items },
              },
              include: {
                items: { orderBy: { id: "asc" } },
                refund: true,
                pointTransactions: true,
              },
            });
            await tx.orderRequest.create({
              data: {
                merchantId: input.merchantId,
                memberId: input.memberId,
                idempotencyKey: input.idempotencyKey,
                payloadHash: input.payloadHash,
                orderId: created.id,
              },
            });
            await reserveOrderInventory(tx, {
              merchantId: input.merchantId,
              orderId: created.id,
              memberId: input.memberId,
              items: created.items,
            });
            if (input.voucherId !== null) {
              await tx.orderVoucherReservation.create({
                data: {
                  voucherId: input.voucherId,
                  orderId: created.id,
                },
              });
            }
            return created;
          },
          { isolationLevel: "Serializable" },
        ),
      );
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        const request = await prisma.orderRequest.findUnique({
          where: { merchantId_memberId_idempotencyKey: { merchantId: input.merchantId, memberId: input.memberId, idempotencyKey: input.idempotencyKey } },
          include: { order: { include: { items: { orderBy: { id: "asc" } }, refund: true, pointTransactions: true } } },
        });
        if (request) {
          if (request.payloadHash !== input.payloadHash) throw new HttpError(409, "IDEMPOTENCY_KEY_CONFLICT");
          return { order: toOrderDto(request.order), replayed: true };
        }
        if (input.voucherId !== null) throw new HttpError(409, "VOUCHER_ALREADY_RESERVED");
      }
      throw error;
    }
    return { order: toOrderDto(order), replayed: false };
  },

  async markPaid(
    memberId: number,
    orderId: number,
  ): Promise<
    | OrderDto
    | "missing"
    | "already_paid"
    | "reservation_expired"
  > {
    return withTransactionRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const order = await tx.order.findFirst({
            where: { id: orderId, memberId },
            include: { items: true },
          });
          if (!order) return "missing";
          if (order.status !== "PENDING") return "already_paid";
          if (
            order.stockReservedUntil &&
            order.stockReservedUntil.getTime() <= Date.now()
          ) {
            await releaseOrderInventory(
              tx,
              order,
              memberId,
              "Order stock reservation expired after five minutes",
            );
            await tx.order.updateMany({
              where: { id: orderId, memberId, status: "PENDING" },
              data: { status: "CANCELLED" },
            });
            await tx.orderVoucherReservation.deleteMany({ where: { orderId } });
            return "reservation_expired";
          }
          return completePaidOrder(tx, orderId, memberId);
        },
        { isolationLevel: "Serializable" },
      ),
      6,
    );
  },

  async cancelOrder(
    memberId: number,
    orderId: number,
  ): Promise<CancelOrderResult> {
    return withTransactionRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const order = await tx.order.findFirst({
            where: { id: orderId, memberId },
            include: {
              voucherReservation: true,
              items: true,
            },
          });
          if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");
          if (order.status !== "PENDING") {
            throw new OrderNotCancellableError(order.status);
          }

          await releaseOrderInventory(
            tx,
            order,
            memberId,
            `Cancelled by member #${memberId}`,
          );

          const deletedReservation =
            await tx.orderVoucherReservation.deleteMany({
              where: { orderId },
            });
          const voucherReleased = deletedReservation.count > 0;

          const updated = await tx.order.update({
            where: { id: orderId },
            data: { status: "CANCELLED" },
            include: {
              items: true,
              refund: true,
              pointTransactions: true,
            },
          });

          return {
            order: toOrderDto(updated),
            voucherReleased,
            capacityReleasedExact: "0",
          };
        },
        { isolationLevel: "Serializable" },
      ),
    );
  },

  async getRefundPreview(
    merchantId: number,
    orderId: number,
    challengePaging?: { page: number; limit: number },
  ): Promise<RefundPreviewDto> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { voucher: true, refund: true },
      });
      if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");
      if (order.merchantId !== merchantId)
        throw new HttpError(403, "FORBIDDEN");
      if (
        order.status !== "PAID" &&
        order.status !== "REFUND_PENDING" &&
        order.status !== "REFUNDED"
      ) {
        throw new HttpError(409, "ORDER_NOT_REFUNDABLE");
      }

      const [membership, configuredTiers, rule] = await Promise.all([
        tx.merchantMembership.findUnique({
          where: {
            memberId_merchantId: { memberId: order.memberId, merchantId },
          },
          include: { wallet: true },
        }),
        tx.loyaltyTier.findMany({ where: { merchantId, isActive: true }, orderBy: { sortOrder: "asc" } }),
        tx.loyaltyRule.findUnique({ where: { merchantId } }),
      ]);
      const tiers = configuredTiers.length ? configuredTiers : defaultTiers;
      const wallet = membership?.wallet;
      const originalEarned = points(order.earnedPointsExact ?? "0");

      const qualificationMode = rule?.qualificationMode ?? "POINTS";
      const tierBefore = selectQualifiedTier(membership?.qualificationProgress ?? "0", tiers, qualificationMode) ?? "UNRANKED";
      const challengeEntries = await tx.challengeProgressEntry.findMany({
        where: { activity: { orderId: order.id, type: "ORDER_PAID" }, deltaValue: { gt: 0 } },
        include: { progress: { include: { challenge: true, grants: { where: { status: "GRANTED" }, orderBy: { cycle: "desc" }, take: 1 } } } },
        ...(challengePaging ? { orderBy: { id: "asc" }, skip: (challengePaging.page - 1) * challengePaging.limit, take: challengePaging.limit } : {}),
      });
      const challenges = challengeEntries.map((entry) => {
        const progress = entry.progress; const challenge = progress.challenge; const grant = progress.grants[0] ?? null;
        const after = progress.currentValue.minus(entry.deltaValue); const belowTarget = after.lessThan(challenge.targetValue); const revoke = Boolean(grant && belowTarget);
        return { challengeId: challenge.id, title: challenge.title, type: challenge.type, targetValue: challenge.targetValue.toFixed(0), currentValueBefore: progress.currentValue.toFixed(0), currentValueAfter: after.toFixed(0), rewardStateBefore: progress.rewardState, rewardStateAfter: belowTarget ? "IN_PROGRESS" : progress.rewardState, grantStatusBefore: grant ? "GRANTED" as const : null, grantStatusAfter: revoke ? "REVERSED" as const : grant ? "GRANTED" as const : null, pointsToReverseExact: revoke && grant ? grant.pointsGranted.toFixed(12) : "0", budgetSpentBefore: challenge.budgetSpent.toFixed(12), budgetSpentAfter: revoke && grant ? challenge.budgetSpent.minus(grant.pointsGranted).toFixed(12) : challenge.budgetSpent.toFixed(12) };
      });
      const totals = challengePaging ? await tx.$queryRaw<{ totalItems: bigint; reversalTotal: Prisma.Decimal | null }[]>(Prisma.sql`
        SELECT COUNT(*) AS totalItems, SUM(CASE WHEN progress.currentValue - entry.deltaValue < challenge.targetValue
          THEN COALESCE((SELECT grantRow.pointsGranted FROM \`ChallengeRewardGrant\` grantRow
            WHERE grantRow.progressId = progress.id AND grantRow.status = 'GRANTED'
            ORDER BY grantRow.cycle DESC LIMIT 1), 0) ELSE 0 END) AS reversalTotal
        FROM \`ChallengeProgressEntry\` entry
        JOIN \`MemberActivity\` activity ON activity.id = entry.activityId
        JOIN \`ChallengeProgress\` progress ON progress.id = entry.progressId
        JOIN \`Challenge\` challenge ON challenge.id = progress.challengeId
        WHERE activity.orderId = ${order.id} AND activity.type = 'ORDER_PAID' AND entry.deltaValue > 0
      `) : null;
      const challengeReversalTotal = totals
        ? points(totals[0]?.reversalTotal ?? "0")
        : challenges.reduce((sum, item) => sum.plus(item.pointsToReverseExact), points("0"));
      const challengeTotal = Number(totals?.[0]?.totalItems ?? 0);
      const walletBefore = describeWallet(wallet);
      const projectedBalance = points(wallet?.exactBalance ?? "0").minus(originalEarned).minus(challengeReversalTotal);
      const projectedLifetime = points(wallet?.netLifetimeEarned ?? "0").minus(originalEarned).minus(challengeReversalTotal);
      const walletAfter = describeWallet({
        exactBalance: projectedBalance,
        netLifetimeEarned: projectedLifetime,
      });
      const progressReversal = qualificationMode === "SPEND" ? order.total : originalEarned.plus(challengeReversalTotal);
      const progressAfterReversal = points(membership?.qualificationProgress ?? "0").minus(progressReversal);
      const projectedProgress = progressAfterReversal.isNegative() ? points("0") : progressAfterReversal;
      const tierAfter = selectQualifiedTier(projectedProgress, tiers, qualificationMode) ?? "UNRANKED";

      return {
        orderId: order.id,
        refundAmountVnd: order.total.toFixed(0),
        refundStatus: order.refund?.status ?? null,
        earningReversalExact: exactPoints(originalEarned),
        walletBefore,
        walletAfter,
        tierBefore,
        tierAfter,
        discountVoucherRestorable: Boolean(
          order.voucherId && order.voucher?.status === "USED",
        ),
        challenges,
        ...(challengePaging ? { challengePagination: {
          ...challengePaging, totalItems: challengeTotal, totalPages: Math.ceil(challengeTotal / challengePaging.limit),
        } } : {}),
      };
    });
  },

  releaseExpiredMockOrders,
};
