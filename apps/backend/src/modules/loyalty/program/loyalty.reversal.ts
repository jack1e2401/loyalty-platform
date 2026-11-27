import type { Order, Prisma } from "../../../generated/prisma/client.js";
import { points, selectQualifiedTier } from "./loyalty.calculation.js";
import { loadEarningPolicy } from "./loyalty.config.js";
import { isQualificationContributionInCurrentCycle } from "./loyalty.cycle.js";

export async function reverseOrderPoints(
  tx: Prisma.TransactionClient,
  order: Pick<Order, "id" | "memberId" | "merchantId" | "earnedPointsExact" | "total" | "paidAt">,
  ownerId: number,
) {
  const { merchantId } = order;
  const membership = await tx.merchantMembership.findUniqueOrThrow({
    where: {
      memberId_merchantId: { memberId: order.memberId, merchantId },
    },
    include: { wallet: true },
  });
  // BR09: Refunds for orders from a previous season must not deduct points or rank progress in the new season.
  if (!isQualificationContributionInCurrentCycle(order.paidAt, membership.lastResetAt)) return;

  const originalEarned = points(order.earnedPointsExact ?? "0");
  if (originalEarned.greaterThan(0)) {
    const wallet = membership.wallet!;
    const balanceAfter = points(wallet.exactBalance).minus(
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

  const policy = await loadEarningPolicy(tx, merchantId);
  const progressReversal = policy.qualificationMode === "SPEND" ? points(order.total) : originalEarned;
  const progressAfterRaw = points(membership.qualificationProgress).minus(progressReversal);
  const progressAfter = progressAfterRaw.isNegative() ? points("0") : progressAfterRaw;
  const nextLevel = selectQualifiedTier(progressAfter, policy.tiers, policy.qualificationMode) ?? policy.tiers[0]!.level;
  const nextTier = policy.tiers.find((tier) => tier.level === nextLevel)!;
  await tx.merchantMembership.update({ where: { id: membership.id }, data: { tierId: nextTier.id, qualificationProgress: progressAfter } });
}
