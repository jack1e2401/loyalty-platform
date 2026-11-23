import { Prisma } from "../../../generated/prisma/client.js";

export type TierLevel = string;
export type TierQualificationMode = "POINTS" | "SPEND";
export type TierThreshold = {
  level: TierLevel;
  minLifetimePoints?: number | null;
  minSpendVnd?: PointValue | null;
  isActive?: boolean;
  sortOrder?: number;
};
export type PointValue = Prisma.Decimal | string | number;
const CalculationDecimal = Prisma.Decimal.clone({ precision: 60, rounding: Prisma.Decimal.ROUND_HALF_UP });
export const pointScale = 12;
export const maxPoints = new CalculationDecimal("2147483647");

/** Isolated high-precision arithmetic; never change Prisma.Decimal's global settings. */
export function points(value: PointValue): Prisma.Decimal {
  return new CalculationDecimal(value.toString());
}

export function calculateEarnedPoints(totalVnd: Prisma.Decimal, vndPerPoint: number, multiplier: Prisma.Decimal): Prisma.Decimal {
  if (!Number.isSafeInteger(vndPerPoint) || vndPerPoint <= 0 ||
    !totalVnd.isFinite() || totalVnd.isNegative() || !multiplier.isFinite() || multiplier.isNegative()) {
    throw new RangeError("Invalid loyalty calculation inputs");
  }
  const earnedPoints = points(totalVnd).mul(multiplier.toString()).div(vndPerPoint.toString())
    .toDecimalPlaces(pointScale, Prisma.Decimal.ROUND_HALF_UP);
  if (earnedPoints.greaterThan(maxPoints)) throw new RangeError("Earned points exceed database capacity");
  return earnedPoints;
}

export function selectTier(lifetimePoints: PointValue, tiers: readonly TierThreshold[]): TierLevel | null {
  const reached = tiers
    .filter((tier) => tier.isActive !== false && tier.minLifetimePoints !== undefined && tier.minLifetimePoints !== null && points(lifetimePoints).greaterThanOrEqualTo(tier.minLifetimePoints.toString()))
    .sort((left, right) => right.minLifetimePoints! - left.minLifetimePoints!)[0];
  return reached?.level ?? null;
}

export function selectSpendTier(spendVnd: PointValue, tiers: readonly TierThreshold[]): TierLevel | null {
  const reached = tiers
    .filter((tier) => tier.isActive !== false && tier.minSpendVnd !== undefined && tier.minSpendVnd !== null && points(spendVnd).greaterThanOrEqualTo(tier.minSpendVnd))
    .sort((left, right) => points(right.minSpendVnd!).comparedTo(points(left.minSpendVnd!)))[0];
  return reached?.level ?? null;
}

export function selectQualifiedTier(
  qualificationProgress: PointValue,
  tiers: readonly TierThreshold[],
  mode: TierQualificationMode,
): TierLevel | null {
  return mode === "SPEND" ? selectSpendTier(qualificationProgress, tiers) : selectTier(qualificationProgress, tiers);
}
