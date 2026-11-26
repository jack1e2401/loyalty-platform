import { Prisma } from "../../../generated/prisma/client.js";
import type {
  OrderStatus,
  PaymentProvider,
  PointTransactionSource,
  PointTransactionType,
  RefundStatus,
  RefundRequestStatus,
} from "../../../generated/prisma/enums.js";
import { describeTransaction, exactPoints } from "../../loyalty/program/loyalty.balance.js";
import type { AppliedLoyaltyPolicyDto, OrderActionsDto, OrderDto, OrderLoyaltyEventDto } from "./orders.types.js";

type OrderRecord = {
  id: number;
  merchantId: number;
  memberId: number;
  status: OrderStatus;
  paymentProvider: PaymentProvider;
  paymentProviderReference: string | null;
  paymentProviderTransactionNo: string | null;
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  total: Prisma.Decimal;
  paidAt: Date | null;
  stockReservedUntil?: Date | null;
  loyaltySnapshot?: Prisma.JsonValue | null;
  items: {
    productId: number;
    productName: string;
    unitPrice: Prisma.Decimal;
    quantity: number;
    lineTotal: Prisma.Decimal;
  }[];
  earnedPointsExact?: Prisma.Decimal | null;
  refund?: { status: RefundStatus } | null;
  refundRequest?: {
    id: number;
    status: RefundRequestStatus;
    requestedAt: Date;
    reason: string;
    merchantReviewedAt: Date | null;
    merchantDecisionReason: string | null;
  } | null;
  pointTransactions?: {
    id: number;
    type: PointTransactionType;
    delta: Prisma.Decimal;
    balanceAfter: Prisma.Decimal;
    reason: string;
    source: PointTransactionSource;
    actorId: number | null;
    createdAt: Date;
  }[];
};

function appliedPolicy(value: Prisma.JsonValue | null | undefined): AppliedLoyaltyPolicyDto | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Record<string, Prisma.JsonValue>;
  const tiers = snapshot.tiers;
  if (!Array.isArray(tiers) || typeof snapshot.policyVersionId !== "number" || typeof snapshot.policyVersion !== "number" ||
      typeof snapshot.vndPerPoint !== "number" || typeof snapshot.ruleActive !== "boolean" ||
      typeof snapshot.tierLevel !== "string" || typeof snapshot.multiplier !== "string" ||
      typeof snapshot.capturedAt !== "string" || typeof snapshot.policyPublishedAt !== "string") return null;
  const tierLevel = snapshot.tierLevel;
  if (typeof tierLevel !== "string" || tierLevel.length > 64) return null;
  const parsedTiers: AppliedLoyaltyPolicyDto["tiers"] = [];
  for (const tier of tiers) {
    if (!tier || typeof tier !== "object" || Array.isArray(tier)) continue;
    const item = tier as Record<string, Prisma.JsonValue>;
    if (typeof item.level !== "string" || typeof item.multiplier !== "string") continue;
    parsedTiers.push({
      level: item.level,
      name: typeof item.name === "string" ? item.name : item.level,
      ...(typeof item.minLifetimePoints === "number" ? { minLifetimePoints: item.minLifetimePoints } : {}),
      ...(typeof item.minSpendVnd === "string" ? { minSpendVnd: item.minSpendVnd } : {}),
      multiplier: item.multiplier,
      benefits: Array.isArray(item.benefits) ? item.benefits.filter((benefit): benefit is string => typeof benefit === "string") : [],
      iconUrl: typeof item.iconUrl === "string" ? item.iconUrl : null,
      color: typeof item.color === "string" ? item.color : "#6B7280",
    });
  }
  return {
    policyVersionId: snapshot.policyVersionId,
    version: snapshot.policyVersion,
    publishedAt: snapshot.policyPublishedAt,
    capturedAt: snapshot.capturedAt,
    vndPerPoint: snapshot.vndPerPoint,
    isActive: snapshot.ruleActive,
    tierLevel,
    multiplier: snapshot.multiplier,
    tiers: parsedTiers,
  };
}

export function computeOrderActions(
  status: OrderStatus,
  refund: { status: RefundStatus } | null | undefined,
  refundRequest?: { status: string } | null,
): OrderActionsDto {
  const canCancel = status === "PENDING";
  const canRefund = status === "PAID" && !refund;
  return {
    canCancel,
    canRefund,
    canRequestRefund: status === "PAID" && !refund && !refundRequest,
  };
}

export function toOrderDto(order: OrderRecord): OrderDto {
  const isPaidOrRefunded = ["PAID", "REFUND_PENDING", "REFUNDED"].includes(order.status);
  const earned = isPaidOrRefunded ? order.earnedPointsExact : null;
  const refund = order.refund ?? null;
  const refundRequest = order.refundRequest ?? null;
  const pointTransactions = order.pointTransactions;

  const loyaltyEvents: OrderLoyaltyEventDto[] = (pointTransactions ?? [])
    .filter((tx) => ["EARN", "EARN_REVERSAL"].includes(tx.type))
    .map((tx) => ({
      id: tx.id,
      type: tx.type,
      ...describeTransaction(tx),
      reason: tx.reason,
      source: tx.source,
      actorId: tx.actorId,
      createdAt: tx.createdAt.toISOString(),
    }));

  return {
    id: order.id,
    merchantId: order.merchantId,
    memberId: order.memberId,
    status: order.status,
    paymentProvider: order.paymentProvider,
    paymentProviderReference: order.paymentProviderReference,
    paymentProviderTransactionNo: order.paymentProviderTransactionNo,
    subtotal: order.subtotal.toFixed(0),
    discountAmount: order.discountAmount.toFixed(0),
    total: order.total.toFixed(0),
    paidAt: order.paidAt?.toISOString() ?? null,
    stockReservedUntil: order.stockReservedUntil?.toISOString() ?? null,
    appliedLoyaltyPolicy: appliedPolicy(order.loyaltySnapshot),
    earnedPoints: earned?.floor().toNumber() ?? (isPaidOrRefunded ? 0 : null),
    earnedPointsExact: earned === null || earned === undefined ? null : exactPoints(earned),
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice.toFixed(0),
      quantity: item.quantity,
      lineTotal: item.lineTotal.toFixed(0),
    })),
    refundStatus: refund?.status ?? null,
    refundRequest: refundRequest ? {
      id: refundRequest.id,
      status: refundRequest.status,
      requestedAt: refundRequest.requestedAt.toISOString(),
      reason: refundRequest.reason,
      merchantReviewedAt: refundRequest.merchantReviewedAt?.toISOString() ?? null,
      merchantDecisionReason: refundRequest.status === "REJECTED" ? refundRequest.merchantDecisionReason : null,
    } : null,
    loyaltyEvents,
    actions: computeOrderActions(order.status, refund, refundRequest),
  };
}
