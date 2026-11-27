export type TierLevel = string;

export type MemberTier = TierLevel | "UNRANKED";

export interface AppliedLoyaltyPolicySnapshot {
  policyVersionId: number;
  version: number;
  publishedAt: string;
  capturedAt: string;
  vndPerPoint: number;
  isActive: boolean;
  tierLevel: TierLevel;
  multiplier: string;
  tiers: LoyaltyTierDto[];
}

export interface LoyaltyTierDto {
  level: TierLevel;
  name?: string;
  minLifetimePoints?: number;
  minSpendVnd?: string;
  multiplier: string;
  benefits?: string[];
  iconUrl?: string | null;
  color?: string;
  maintenanceSpendVnd?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface TierResetConfigDto {
  enabled: boolean;
  month: number;
  day: number;
  targetPoints?: number;
  strategy?: "ONE_DOWN" | "SELECTED";
  targetLevel?: string | null;
}

export interface LoyaltyConfigDto {
  merchantId: number;
  vndPerPoint: number;
  isActive: boolean;
  qualificationMode: "POINTS" | "SPEND";
  tiers: LoyaltyTierDto[];
  reset: TierResetConfigDto;
}

export interface LoyaltyConfigInput {
  vndPerPoint: number;
  isActive: boolean;
  qualificationMode: "POINTS" | "SPEND";
  tiers: LoyaltyTierDto[];
  reset: TierResetConfigDto;
  publishAsNewVersion?: boolean;
}

export type PointTransactionType =
  | "EARN"
  | "REDEEM_DISCOUNT"
  | "REDEEM_REWARD"
  | "EARN_REVERSAL"
  | "REDEMPTION_REVERSAL"
  | "MERCHANT_ADJUSTMENT"
  | "LEGACY_BACKFILL"
  | "SEASON_RESET";

export interface WalletTransactionDto {
  id: number;
  eventRef?: string;
  type: PointTransactionType;
  delta: string;
  balanceAfter: string;
  availablePointsAfter: number;
  fractionalCarryAfter: string;
  pointDebtAfter: string;
  reason: string;
  source?: string;
  actorId?: number | null;
  orderId: number | null;
  memberVoucherId: number | null;
  createdAt: string;
}

export interface SeasonHistoryEntryDto {
  seasonYear: number;
  previousTierName: string;
  newSeasonYear: number;
  newTierLevel: string;
  newTierName: string;
  resetToPoints: string;
  delta: string;
  resetAt: string;
}

export interface WalletDto {
  merchantId: number;
  availablePoints: number;
  exactBalance: string;
  fractionalCarry: string;
  pointDebt: string;
  netLifetimeEarned: string;
  lifetimeEarnedPoints: number;
  qualificationProgress?: string;
  currentSeason?: number;
  lastResetAt?: string | null;
  seasonHistory?: SeasonHistoryEntryDto[];
  tier: MemberTier;
  policy?: LoyaltyConfigDto;
  transactions: WalletTransactionDto[];
}

export type LoyaltyConfigResponse = { config: LoyaltyConfigDto };

export type WalletResponse = { wallet: WalletDto };

export interface MemberEarningPreviewResponse {
  merchantId: number;
  active: boolean;
  netOrderAmountVnd: string;
  tierLevel: MemberTier;
  multiplier: string;
  vndPerPoint: number;
  estimatedPointsExact: string;
  policyUpdatedAt?: string;
}

export interface MerchantLoyaltyPreviewInput {
  netOrderAmountVnd: string;
  tierLevel?: TierLevel;
}

export interface MerchantLoyaltyPreviewResponse {
  netOrderAmountVnd: string;
  tierLevel: MemberTier;
  multiplier: string;
  vndPerPoint: number;
  active: boolean;
  estimatedPointsExact: string;
  integerProjection: number;
  fractionalProjection: string;
  rounding: "HALF_UP" | string;
  scale: number;
}

export interface MerchantLedgerItemDto extends WalletTransactionDto {
  memberId: number;
  memberEmail?: string | null;
  orderSummary?: { id: number; total: string; status: string } | null;
  voucherSummary?: { id: number; title: string; type: string } | null;
}

type LoyaltyPagination = { page: number; limit: number; totalItems: number; totalPages: number };

export interface MerchantTransactionsResponse {
  pagination?: LoyaltyPagination;
  summary?: { earned: string; redeemed: string; reversed: string; restored: string };
  items: MerchantLedgerItemDto[];
  nextCursor: string | null;
}

export interface MerchantLoyaltyMemberDto {
  id: number;
  email: string;
  tier: MemberTier;
  availablePoints: number;
  netLifetimeEarned: string;
  qualificationProgress?: string;
  pointDebt: string;
  latestChange: Pick<WalletTransactionDto, "type" | "delta" | "createdAt"> | null;
}

export type MerchantLoyaltyMembersResponse = { items: MerchantLoyaltyMemberDto[]; nextCursor: number | null; pagination?: LoyaltyPagination };

export type MerchantLoyaltyMemberWalletResponse = {
  member: Pick<MerchantLoyaltyMemberDto, "id" | "email">;
  wallet: WalletDto;
};

export interface MerchantLoyaltyPolicyVersionDto {
  id: number;
  version: number;
  vndPerPoint: number;
  isActive: boolean;
  qualificationMode: "POINTS" | "SPEND" | null;
  reset: {
    enabled: boolean;
    month: number | null;
    day: number | null;
    targetPoints?: number;
    strategy: "ONE_DOWN" | "SELECTED" | null;
    targetLevel: string | null;
  } | null;
  tiers: LoyaltyTierDto[];
  source: "MERCHANT_PUBLISH" | "LEGACY_BACKFILL";
  publishedAt: string;
  publishedById: number | null;
  publishedByEmail: string | null;
  isCurrent: boolean;
}

export type MerchantLoyaltyHistoryResponse = { versions: MerchantLoyaltyPolicyVersionDto[]; current?: MerchantLoyaltyPolicyVersionDto | null; pagination?: LoyaltyPagination };

export interface MerchantTransactionsQuery {
  page?: number;
  memberId?: number;
  orderId?: number;
  type?: PointTransactionType;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}
