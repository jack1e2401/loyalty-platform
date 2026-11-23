import type { Order, Prisma } from "../../../generated/prisma/client.js";
import { points, selectQualifiedTier } from "./loyalty.calculation.js";
import { loadEarningPolicy } from "./loyalty.config.js";

export function isInResetQualificationCycle(
  paidAt: Date | null,
  lastResetCycleYear: number | null,
  resetMonth: number | null,
  resetDay: number | null,
): boolean {
  if (!paidAt || lastResetCycleYear === null) return true;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(paidAt);
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value);
  const year = part("year");
  const month = part("month");
  const day = part("day");
  const boundaryMonth = resetMonth ?? 1;
  const boundaryDay = resetDay ?? 1;
  const orderCycleYear = month < boundaryMonth || (month === boundaryMonth && day < boundaryDay) ? year - 1 : year;
  return orderCycleYear >= lastResetCycleYear;
}

export async function reverseOrderPoints(
  tx: Prisma.TransactionClient,
  order: Pick<Order, "id" | "memberId" | "merchantId" | "earnedPointsExact" | "total" | "paidAt">,
  ownerId: number,
) {
  const { merchantId } = order;
  const originalEarned = points(order.earnedPointsExact ?? "0");
  if (originalEarned.greaterThan(0)) {
    const membership = await tx.merchantMembership.findUniqueOrThrow({
      where: {
        memberId_merchantId: { memberId: order.memberId, merchantId },
      },
      include: { wallet: true },
    });
    const wallet = membership.wallet!;
    const balanceAfter = points(wallet.exactBalance).minus(
      originalEarned,
    );
    const lifetimeAfter = points(wallet.netLifetimeEarned).minus(
      originalEarned,
    );

    const updatedWallet = await tx.loyaltyWallet.updateMany({
      where: {
        id: wallet.id,
        exactBalance: wallet.exactBalance,
        netLifetimeEarned: wallet.netLifetimeEarned,
      },
      data: {
        exactBalance: { decrement: originalEarned },
        netLifetimeEarned: { decrement: originalEarned },
      },
    });
    if (updatedWallet.count !== 1)
      throw Object.assign(new Error("Concurrent wallet update"), {
        code: "P2034",
      });

    await tx.pointTransaction.create({
      data: {
        walletId: wallet.id,
        type: "EARN_REVERSAL",
        delta: originalEarned.negated(),
        balanceAfter,
        promotedToTier: null,
        reason: `Refund for order #${order.id}`,
        eventRef: `order-earn-reversal-${order.id}`,
        source: "MERCHANT_REFUND",
        actorId: ownerId,
        orderId: order.id,
      },
    });
  }

  const membership = await tx.merchantMembership.findUniqueOrThrow({
    where: { memberId_merchantId: { memberId: order.memberId, merchantId } },
  });
  const resetRule = await tx.loyaltyRule.findUnique({ where: { merchantId }, select: { resetMonth: true, resetDay: true } });
  if (!isInResetQualificationCycle(order.paidAt, membership.lastResetCycleYear, resetRule?.resetMonth ?? null, resetRule?.resetDay ?? null)) return;
  const policy = await loadEarningPolicy(tx, merchantId);
  const progressReversal = policy.qualificationMode === "SPEND" ? points(order.total) : originalEarned;
  const progressAfterRaw = points(membership.qualificationProgress).minus(progressReversal);
  const progressAfter = progressAfterRaw.isNegative() ? points("0") : progressAfterRaw;
  const nextLevel = selectQualifiedTier(progressAfter, policy.tiers, policy.qualificationMode) ?? policy.tiers[0]!.level;
  const nextTier = policy.tiers.find((tier) => tier.level === nextLevel)!;
  await tx.merchantMembership.update({ where: { id: membership.id }, data: { tierId: nextTier.id, qualificationProgress: progressAfter } });
}
