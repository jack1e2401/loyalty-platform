import type { TierLevel, TierQualificationMode } from "./loyalty.calculation.js";

export interface LoyaltyTierInput {
  level: TierLevel;
  name: string;
  minLifetimePoints?: number;
  minSpendVnd?: string;
  multiplier: string;
  benefits: string[];
  iconUrl: string | null;
  color: string;
  maintenanceSpendVnd: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface TierResetConfigInput {
  enabled: boolean;
  month: number;
  day: number;
  strategy: "ONE_DOWN" | "SELECTED";
  targetLevel: string | null;
}

export interface LoyaltyConfigInput {
  vndPerPoint: number;
  isActive: boolean;
  qualificationMode: TierQualificationMode;
  tiers: LoyaltyTierInput[];
  reset: TierResetConfigInput;
}

export interface LoyaltyTierDto extends LoyaltyTierInput {}

export interface LoyaltyConfigDto {
  merchantId: number;
  vndPerPoint: number;
  isActive: boolean;
  qualificationMode: TierQualificationMode;
  tiers: LoyaltyTierDto[];
  reset: TierResetConfigInput;
}
