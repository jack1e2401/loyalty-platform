import { randomUUID } from "node:crypto";
import { Prisma, type TierResetTrigger } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { HttpError } from "../../../lib/http-error.js";
import { maxPoints, points, selectQualifiedTier } from "./loyalty.calculation.js";

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

type ExecuteResetInput = {
  merchantId: number;
  triggerType: TierResetTrigger;
  cycleYear: number;
  cycleKey: string;
  effectiveAt: Date;
  targetPointsInt: number;
};

async function executeTierReset({
  merchantId,
  triggerType,
  cycleYear,
  cycleKey,
  effectiveAt,
  targetPointsInt,
}: ExecuteResetInput) {
  const targetPoints = points(targetPointsInt);
  return prisma.$transaction(async (tx) => {
    const latestRun = await tx.tierResetRun.findFirst({
      where: { merchantId },
      orderBy: [{ seasonNumber: "desc" }, { id: "desc" }],
      select: { seasonNumber: true },
    });
    const seasonNumber = latestRun ? latestRun.seasonNumber + 1 : 2;
    const run = await tx.tierResetRun.create({
      data: {
        merchantId,
        cycleYear,
        cycleKey,
        triggerType,
        seasonNumber,
        targetPoints: targetPointsInt,
        effectiveAt,
      },
    });
    const tiers = await tx.loyaltyTier.findMany({
      where: { merchantId, isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    if (tiers.length === 0 || tiers[0]!.level !== "default") {
      throw new HttpError(409, "DEFAULT_TIER_REQUIRED");
    }
    const memberships = await tx.merchantMembership.findMany({
      where: { merchantId },
      include: { tier: true, wallet: true },
    });

    const modeLabel = triggerType === "MANUAL" ? "thủ công" : "tự động";
    for (const membership of memberships) {
      const wallet = membership.wallet ?? await tx.loyaltyWallet.upsert({
        where: { membershipId: membership.id },
        create: { membershipId: membership.id },
        update: {},
      });

      const postBoundaryTx = await tx.pointTransaction.aggregate({
        where: { walletId: wallet.id, createdAt: { gte: effectiveAt } },
        _sum: { delta: true },
      });
      const postBoundaryWalletDelta = points(postBoundaryTx._sum.delta ?? "0");
      const balanceAtBoundary = points(wallet.exactBalance).minus(postBoundaryWalletDelta);
      const delta = targetPoints.minus(balanceAtBoundary);
      const newBalance = points(wallet.exactBalance).plus(delta);

      await tx.loyaltyWallet.update({
        where: { id: wallet.id },
        data: { exactBalance: newBalance },
      });

      const [postBoundaryOrders, postBoundaryChallengeRewards] = await Promise.all([
        tx.order.aggregate({
          where: {
            merchantId,
            memberId: membership.memberId,
            status: { in: ["PAID", "REFUND_PENDING"] },
            paidAt: { gte: effectiveAt },
          },
          _sum: { earnedPointsExact: true },
        }),
        tx.challengeRewardGrant.aggregate({
          where: {
            status: "GRANTED",
            grantedAt: { gte: effectiveAt },
            progress: { membershipId: membership.id },
          },
          _sum: { pointsGranted: true },
        }),
      ]);

      const postBoundaryQual = points(postBoundaryOrders._sum.earnedPointsExact ?? "0")
        .plus(points(postBoundaryChallengeRewards._sum.pointsGranted ?? "0"));
      const qualificationProgress = targetPoints.plus(postBoundaryQual);
      const qualifiedLevel = selectQualifiedTier(qualificationProgress, tiers, "POINTS") ?? tiers[0]!.level;
      const qualifiedTier = tiers.find((tier) => tier.level === qualifiedLevel)!;
      const prevTierName = membership.tier?.name ?? "Chưa xếp hạng";

      await tx.pointTransaction.create({
        data: {
          walletId: wallet.id,
          type: "SEASON_RESET",
          delta,
          balanceAfter: targetPoints,
          promotedToTier: qualifiedTier.level,
          reason: `Reset điểm ${modeLabel} sang Mùa ${seasonNumber} · ${cycleYear} (Mùa trước: ${prevTierName})`,
          eventRef: `season-reset-${merchantId}-run-${run.id}-${membership.id}`,
          source: "SYSTEM",
        },
      });

      await tx.merchantMembership.update({
        where: { id: membership.id },
        data: {
          tierId: qualifiedTier.id,
          qualificationProgress,
          lastResetCycleYear: cycleYear,
          lastResetAt: effectiveAt,
        },
      });
    }

    await tx.tierResetRun.update({ where: { id: run.id }, data: { processedCount: memberships.length } });
    return {
      cycleYear,
      seasonNumber,
      triggerType,
      targetPoints: targetPointsInt,
      effectiveAt: effectiveAt.toISOString(),
      processedCount: memberships.length,
      alreadyProcessed: false,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
  const cycleKey = `scheduled-${cycleYear}`;
  const effectiveAt = vndStartOfDayUtc(cycleYear, resetMonth, dueDay);
  const targetPointsInt = rule.resetTargetPoints ?? 0;

  try {
    return await executeTierReset({
      merchantId,
      triggerType: "SCHEDULED",
      cycleYear,
      cycleKey,
      effectiveAt,
      targetPointsInt,
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const existing = await prisma.tierResetRun.findUnique({
      where: { merchantId_cycleKey: { merchantId, cycleKey } },
    });
    if (!existing) throw error;
    return {
      cycleYear,
      seasonNumber: existing.seasonNumber,
      triggerType: existing.triggerType,
      targetPoints: existing.targetPoints,
      effectiveAt: existing.effectiveAt.toISOString(),
      processedCount: existing.processedCount,
      alreadyProcessed: true,
    };
  }
}

export async function runManualTierReset(
  merchantId: number,
  options?: { targetPoints?: number; now?: Date },
) {
  const rule = await prisma.loyaltyRule.findUnique({ where: { merchantId } });
  const targetPointsInt = options?.targetPoints ?? rule?.resetTargetPoints ?? 0;
  if (!Number.isInteger(targetPointsInt) || targetPointsInt < 0 || points(targetPointsInt).greaterThan(maxPoints)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  const now = options?.now ?? new Date();
  const today = vietnamDate(now);

  return executeTierReset({
    merchantId,
    triggerType: "MANUAL",
    cycleYear: today.year,
    cycleKey: `manual-${randomUUID()}`,
    effectiveAt: now,
    targetPointsInt,
  });
}

export async function runScheduledTierResetForAllMerchants(now = new Date()) {
  const today = vietnamDate(now);
  const merchants = await prisma.merchant.findMany({
    where: {
      isActive: true,
      loyaltyRule: {
        is: {
          resetEnabled: true,
          resetMonth: today.month,
          resetDay: { not: null },
        },
      },
    },
    select: { id: true, slug: true },
  });

  const results: Array<{ merchantId: number; slug: string; status: "PROCESSED" | "SKIPPED" | "FAILED"; processedCount?: number }> = [];
  for (const merchant of merchants) {
    try {
      const outcome = await runAnnualTierReset(merchant.id, now);
      results.push({
        merchantId: merchant.id,
        slug: merchant.slug,
        status: outcome.alreadyProcessed ? "SKIPPED" : "PROCESSED",
        processedCount: outcome.processedCount,
      });
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 409) {
        results.push({ merchantId: merchant.id, slug: merchant.slug, status: "SKIPPED" });
        continue;
      }
      console.error(`Scheduled tier reset failed for merchant ${merchant.slug} (#${merchant.id})`, error);
      results.push({ merchantId: merchant.id, slug: merchant.slug, status: "FAILED" });
    }
  }
  return results;
}
