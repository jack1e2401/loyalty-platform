import type { Order, Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../../lib/http-error.js";
import { calculateEarnedPoints, maxPoints, points, selectQualifiedTier, pointScale } from "./loyalty.calculation.js";
import { exactPoints } from "./loyalty.balance.js";
import { loadEarningPolicy } from "./loyalty.config.js";

export async function creditOrderPoints(
  tx: Prisma.TransactionClient,
  order: Pick<Order, "id" | "memberId" | "merchantId" | "total"> & { paidAt: Date },
) {
  const memberId = order.memberId;
  const policy = await loadEarningPolicy(tx, order.merchantId);
  const membership = await tx.merchantMembership.upsert({
    where: { memberId_merchantId: { memberId, merchantId: order.merchantId } },
    create: { memberId, merchantId: order.merchantId }, update: {}, include: { wallet: true, tier: true },
  });
  const wallet = membership.wallet ?? await tx.loyaltyWallet.create({ data: { membershipId: membership.id } });
  const currentLevel = selectQualifiedTier(membership.qualificationProgress, policy.tiers, policy.qualificationMode) ?? policy.tiers[0]!.level;
  const currentTier = policy.tiers.find((tier) => tier.level === currentLevel)!;
  const tierLevel = currentLevel;
  const multiplier = currentTier.multiplier;
  const vndPerPoint = policy.vndPerPoint;
  const ruleActive = policy.isActive;
  let earned: Prisma.Decimal;
  try {
    earned = ruleActive ? calculateEarnedPoints(order.total, vndPerPoint, multiplier) : points("0");
  } catch (error) {
    if (error instanceof RangeError) throw new HttpError(409, "LOYALTY_LIMIT_EXCEEDED");
    throw error;
  }
  if (
    points(wallet.exactBalance).plus(earned).greaterThan(maxPoints) ||
    points(wallet.netLifetimeEarned).plus(earned).greaterThan(maxPoints)
  ) {
    throw new HttpError(409, "LOYALTY_LIMIT_EXCEEDED");
  }
  const balanceAfter = points(wallet.exactBalance).plus(earned);
  const lifetimeAfter = points(wallet.netLifetimeEarned).plus(earned);
  const progressDelta = policy.qualificationMode === "SPEND" ? order.total : earned;
  const progressAfter = points(membership.qualificationProgress).plus(progressDelta);
  const nextTier = policy.tiers.find((tier) => tier.level === selectQualifiedTier(progressAfter, policy.tiers, policy.qualificationMode))!;
  const promotedToTier = nextTier.sortOrder > (membership.tier?.sortOrder ?? -1) ? nextTier.level : null;
  const credited = await tx.loyaltyWallet.updateMany({
    where: { id: wallet.id, exactBalance: wallet.exactBalance, netLifetimeEarned: wallet.netLifetimeEarned },
    data: { exactBalance: { increment: earned }, netLifetimeEarned: { increment: earned } },
  });
  if (credited.count !== 1) throw Object.assign(new Error("Concurrent wallet change"), { code: "P2034" });
  await tx.pointTransaction.create({ data: {
    walletId: wallet.id, type: "EARN", delta: earned, balanceAfter, promotedToTier,
    reason: `Earned from order #${order.id}`, orderId: order.id,
    eventRef: `order-earn-${order.id}`,
    source: "MOCK_PAYMENT",
    actorId: memberId,
  } });
  const audit: Prisma.InputJsonObject = {
    source: "MOCK_PAID",
    capturedAt: order.paidAt.toISOString(), pointScale, rounding: "HALF_UP",
    netOrderAmount: order.total.toFixed(0), vndPerPoint, ruleActive, tierLevel,
    multiplier: multiplier.toFixed(2), earnedPointsExact: exactPoints(earned),
    policyVersionId: policy.policyVersion.id,
    policyVersion: policy.policyVersion.version,
    policyPublishedAt: policy.policyVersion.publishedAt.toISOString(),
    qualificationMode: policy.qualificationMode,
    tiers: policy.tiers.map((tier) => ({ level: tier.level, name: tier.name, minLifetimePoints: tier.minLifetimePoints, minSpendVnd: tier.minSpendVnd?.toFixed(0) ?? null, sortOrder: tier.sortOrder, multiplier: tier.multiplier.toFixed(2), benefits: tier.benefits, iconUrl: tier.iconUrl, color: tier.color, maintenanceSpendVnd: tier.maintenanceSpendVnd?.toFixed(0) ?? null })),
  };
  const paid = await tx.order.update({
    where: { id: order.id },
    data: { earnedPointsExact: earned, loyaltySnapshot: audit, loyaltyPolicyVersionId: policy.policyVersion.id },
    include: { items: true, refund: true, pointTransactions: true },
  });
  await tx.merchantMembership.update({ where: { id: membership.id }, data: { tierId: nextTier.id, qualificationProgress: progressAfter } });
  return { paid, promotedToTier, membershipId: membership.id };
}
