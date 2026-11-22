import { Prisma } from "../../../generated/prisma/client.js";
import type { TierQualificationMode } from "./loyalty.calculation.js";

export interface ResetTierCandidate {
  id: number;
  level: string;
  minLifetimePoints: number | null;
  minSpendVnd: Prisma.Decimal | string | null;
  maintenanceSpendVnd: Prisma.Decimal | string | null;
}

export interface ResolveTierResetInput {
  currentTierId: number | null;
  tiers: readonly ResetTierCandidate[];
  mode: "DOWN_ONE" | "TO_TIER";
  targetTierId?: number;
  qualificationMode: TierQualificationMode;
  cycleSpendVnd: Prisma.Decimal | string;
  maintenanceEnabled: boolean;
}

function decimal(value: Prisma.Decimal | string | number): Prisma.Decimal {
  return new Prisma.Decimal(value.toString());
}

function threshold(tier: ResetTierCandidate, mode: TierQualificationMode): string {
  if (mode === "SPEND") return tier.minSpendVnd?.toString() ?? "0";
  return String(tier.minLifetimePoints ?? 0);
}

export function resolveResetTier(input: ResolveTierResetInput): { tierId: number; progress: string } {
  const tiers = [...input.tiers].sort((left, right) => left.id - right.id);
  if (tiers.length === 0) throw new RangeError("At least one tier is required");
  const currentIndex = Math.max(0, tiers.findIndex((tier) => tier.id === input.currentTierId));
  const current = tiers[currentIndex]!;
  const maintenance = current.maintenanceSpendVnd;
  if (input.maintenanceEnabled && maintenance !== null && decimal(input.cycleSpendVnd).greaterThanOrEqualTo(maintenance.toString())) {
    return { tierId: current.id, progress: threshold(current, input.qualificationMode) };
  }
  const requestedIndex = input.mode === "TO_TIER"
    ? tiers.findIndex((tier) => tier.id === input.targetTierId)
    : currentIndex - 1;
  const targetIndex = requestedIndex < 0 ? 0 : Math.min(requestedIndex, currentIndex);
  const target = tiers[targetIndex]!;
  return { tierId: target.id, progress: threshold(target, input.qualificationMode) };
}
