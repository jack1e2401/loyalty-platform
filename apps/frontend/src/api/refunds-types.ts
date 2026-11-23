import type { OrderDto, PaymentProvider, RefundDto, RefundPreviewDto } from "./contracts/orders";
import type { ChallengeRewardGrantStatus, ChallengeRewardState, ChallengeType } from "./challenges-types";

export type RefundRequestStatus =
  | "PENDING_MERCHANT"
  | "REJECTED"
  | "APPROVED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface ChallengeRefundImpactDto {
  challengeId: number;
  title: string;
  type: ChallengeType;
  targetValue: string;
  currentValueBefore: string;
  currentValueAfter: string;
  rewardStateBefore: ChallengeRewardState;
  rewardStateAfter: ChallengeRewardState;
  grantStatusBefore: ChallengeRewardGrantStatus | null;
  grantStatusAfter: ChallengeRewardGrantStatus | null;
  pointsToReverseExact: string;
  budgetSpentBefore: string;
  budgetSpentAfter: string;
}

export interface ExtendedRefundPreviewDto extends RefundPreviewDto {
  challenges?: ChallengeRefundImpactDto[];
}

export interface RefundRequestDto {
  id: number;
  orderId: number;
  memberId: number;
  merchantId: number;
  reason: string;
  status: RefundRequestStatus;
  requestedAt: string;
  merchantReviewedById: number | null;
  merchantReviewedAt: string | null;
  merchantDecisionReason: string | null;
  adminReviewedById: number | null;
  adminReviewedAt: string | null;
  adminDecisionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RefundRequestListItemDto extends RefundRequestDto {
  orderTotalVnd: string;
  orderStatus: OrderDto["status"];
  memberEmail: string;
  merchantName?: string;
  merchantSlug?: string;
}

export interface RefundRequestPaginationDto {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface RefundRequestListResponse {
  items: RefundRequestListItemDto[];
  pagination: RefundRequestPaginationDto;
}

export interface RefundRequestDetailResponse {
  refundRequest: RefundRequestDto;
  order: OrderDto;
  merchant?: { id: number; name: string; slug: string };
  member?: { id: number; email: string };
  preview: ExtendedRefundPreviewDto;
  settlement?: Pick<RefundDto, "status" | "amountVnd" | "completedAt"> | null;
  reconciliationAttempts?: RefundReconciliationAttemptDto[];
}

export interface RefundReconciliationAttemptDto {
  id: number;
  recordedById: number;
  providerReference: string;
  providerTransactionNo: string | null;
  outcome: "FAILED" | "SETTLED";
  failureReason: string | null;
  createdAt: string;
}

export interface ManualRefundEvidenceInput {
  outcome: "FAILED" | "SETTLED";
  providerReference: string;
  providerTransactionNo?: string;
  failureReason?: string;
}

export interface MerchantReconcileRefundResponse {
  refundRequest: RefundRequestDto;
  reconciliationAttempt: RefundReconciliationAttemptDto;
  manualReconciliationRequired: boolean;
  refund?: RefundDto;
  order?: OrderDto;
  walletImpact?: unknown;
  challengeReversals?: number;
}

export interface MockMerchantApproveRefundResponse {
  refundRequest: RefundRequestDto;
  refund: RefundDto;
  order: OrderDto;
  walletImpact: unknown;
  challengeReversals: number;
}

export interface ManualReconciliationResponse {
  refundRequest: RefundRequestDto;
  manualReconciliationRequired: true;
  paymentProvenance: {
    provider: PaymentProvider;
    providerReference: string | null;
    providerTransactionNo: string | null;
  };
}

export type MerchantApproveRefundResponse = MockMerchantApproveRefundResponse | ManualReconciliationResponse;

export interface ListRefundRequestsParams {
  status?: RefundRequestStatus | "";
  page?: number;
  limit?: number;
}
