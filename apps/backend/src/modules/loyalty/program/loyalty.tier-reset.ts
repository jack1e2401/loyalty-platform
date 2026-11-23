import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { HttpError } from "../../../lib/http-error.js";
import { points, selectQualifiedTier } from "./loyalty.calculation.js";
import { resolveResetTier } from "./loyalty.tier-reset.domain.js";

const zone = "Asia/Ho_Chi_Minh";

function vietnamDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

function resolvedResetDay(year: number, month: number, day: number) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.min(day, lastDay);
}

function vndStartOfDayUtc(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1000);
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function runAnnualTierReset(merchantId: number, now = new Date()) {
  const rule = await prisma.loyaltyRule.findUnique({ where: { merchantId } });
  if (!rule?.resetEnabled || !rule.resetMonth || !rule.resetDay) throw new HttpError(409, "TIER_RESET_DISABLED");
  const resetMonth = rule.resetMonth;
  const resetDay = rule.resetDay;
  const today = vietnamDate(now);
  const dueDay = resolvedResetDay(today.year, resetMonth, resetDay);
  if (today.month !== resetMonth || today.day !== dueDay) throw new HttpError(409, "TIER_RESET_NOT_DUE");

  const cycleYear = today.year;
  const spendFrom = vndStartOfDayUtc(cycleYear - 1, resetMonth, resolvedResetDay(cycleYear - 1, resetMonth, resetDay));
  const spendTo = vndStartOfDayUtc(cycleYear, resetMonth, dueDay);
  try {
    return await prisma.$transaction(async (tx) => {
      const run = await tx.tierResetRun.create({ data: { merchantId, cycleYear, effectiveAt: spendTo } });
      const tiers = await tx.loyaltyTier.findMany({ where: { merchantId, isActive: true }, orderBy: { sortOrder: "asc" } });
      if (tiers.length === 0 || tiers[0]!.level !== "default") throw new HttpError(409, "DEFAULT_TIER_REQUIRED");
      const memberships = await tx.merchantMembership.findMany({ where: { merchantId }, include: { tier: true } });
      for (const membership of memberships) {
        const spend = await tx.order.aggregate({
          where: { merchantId, memberId: membership.memberId, status: { in: ["PAID", "REFUND_PENDING"] }, paidAt: { gte: spendFrom, lt: spendTo } },
          _sum: { total: true },
        });
        const result = resolveResetTier({
          currentTierId: membership.tierId,
          tiers,
          mode: rule.resetStrategy === "SELECTED" ? "TO_TIER" : "DOWN_ONE",
          targetTierId: rule.resetTargetLevel ? tiers.find((tier) => tier.level === rule.resetTargetLevel)?.id : undefined,
          qualificationMode: rule.qualificationMode,
          cycleSpendVnd: spend._sum.total ?? new Prisma.Decimal(0),
          maintenanceEnabled: tiers.some((tier) => tier.maintenanceSpendVnd !== null),
        });
        const postBoundaryOrders = await tx.order.aggregate({
          where: { merchantId, memberId: membership.memberId, status: { in: ["PAID", "REFUND_PENDING"] }, paidAt: { gte: spendTo } },
          _sum: { total: true, earnedPointsExact: true },
        });
        const postBoundaryChallengeRewards = rule.qualificationMode === "POINTS"
          ? await tx.challengeRewardGrant.aggregate({
            where: { status: "GRANTED", grantedAt: { gte: spendTo }, progress: { membershipId: membership.id } },
            _sum: { pointsGranted: true },
          })
          : null;
        const postBoundaryContribution = rule.qualificationMode === "SPEND"
          ? postBoundaryOrders._sum.total ?? new Prisma.Decimal(0)
          : (postBoundaryOrders._sum.earnedPointsExact ?? new Prisma.Decimal(0)).plus(postBoundaryChallengeRewards?._sum.pointsGranted ?? new Prisma.Decimal(0));
        const qualificationProgress = points(result.progress).plus(postBoundaryContribution);
        const qualifiedLevel = selectQualifiedTier(qualificationProgress, tiers, rule.qualificationMode) ?? tiers[0]!.level;
        const qualifiedTier = tiers.find((tier) => tier.level === qualifiedLevel)!;
        await tx.merchantMembership.update({
          where: { id: membership.id },
          data: { tierId: qualifiedTier.id, qualificationProgress, lastResetCycleYear: cycleYear, lastResetAt: spendTo },
        });
      }
      await tx.tierResetRun.update({ where: { id: run.id }, data: { processedCount: memberships.length } });
      return { cycleYear, processedCount: memberships.length, alreadyProcessed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const existing = await prisma.tierResetRun.findUnique({ where: { merchantId_cycleYear: { merchantId, cycleYear } } });
    if (!existing) throw error;
    return { cycleYear, processedCount: existing.processedCount, alreadyProcessed: true };
  }
}
