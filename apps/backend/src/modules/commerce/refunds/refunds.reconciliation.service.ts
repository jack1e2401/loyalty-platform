import { HttpError } from "../../../lib/http-error.js";
import { withTransactionRetry } from "../../../lib/prisma-transaction.js";
import { prisma } from "../../../lib/prisma.js";
import { merchantService } from "../../merchants/profile/merchant.service.js";
import { completeReconciledRefund } from "./refunds.complete.js";
import { refundSettlementRoute } from "./refunds.payment-routing.js";
import { hashManualRefundEvidence, parseManualRefundEvidence } from "./refunds.reconciliation-validation.js";

export function reconciliationAttemptDto(attempt: {
  id: number;
  recordedById: number;
  providerReference: string;
  providerTransactionNo: string | null;
  outcome: "FAILED" | "SETTLED";
  failureReason: string | null;
  createdAt: Date;
}) {
  return {
    id: attempt.id,
    recordedById: attempt.recordedById,
    providerReference: attempt.providerReference,
    providerTransactionNo: attempt.providerTransactionNo,
    outcome: attempt.outcome,
    failureReason: attempt.failureReason,
    createdAt: attempt.createdAt.toISOString(),
  };
}

export async function merchantReconcileRefund(ownerId: number, id: number, evidenceValue: unknown) {
  const evidence = parseManualRefundEvidence(evidenceValue);
  const requestHash = hashManualRefundEvidence(evidence);
  const merchant = await merchantService.getOwnStore(ownerId);
  return withTransactionRetry(() => prisma.$transaction(async (tx) => {
    const request = await tx.refundRequest.findFirst({ where: { id, merchantId: merchant.id } });
    if (!request) throw new HttpError(404, "REFUND_REQUEST_NOT_FOUND");
    const order = await tx.order.findFirst({
      where: { id: request.orderId, merchantId: merchant.id },
      select: { id: true, status: true, paymentProvider: true, refund: { select: { id: true } } },
    });
    if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");
    if (refundSettlementRoute(order.paymentProvider) !== "MANUAL_RECONCILIATION") {
      throw new HttpError(409, "REFUND_PROVIDER_DOES_NOT_REQUIRE_MANUAL_RECONCILIATION");
    }

    const where = { refundRequestId_providerReference: { refundRequestId: id, providerReference: evidence.providerReference } };
    const existing = await tx.refundReconciliationAttempt.findUnique({ where });
    if (existing) {
      if (existing.requestHash !== requestHash) throw new HttpError(409, "REFUND_SETTLEMENT_REFERENCE_CONFLICT");
      if (existing.outcome === "SETTLED") {
        const result = await completeReconciledRefund(tx, {
          merchantId: merchant.id,
          ownerId,
          orderId: request.orderId,
          reason: request.reason,
          providerReference: existing.providerReference,
          replay: true,
        });
        return {
          ...result,
          refundRequest: request,
          reconciliationAttempt: reconciliationAttemptDto(existing),
          manualReconciliationRequired: false as const,
        };
      }
      return {
        refundRequest: request,
        reconciliationAttempt: reconciliationAttemptDto(existing),
        manualReconciliationRequired: request.status !== "COMPLETED",
      };
    }

    if (request.status !== "PROCESSING") throw new HttpError(409, "REFUND_REQUEST_NOT_PROCESSING");
    if (order.status !== "PAID" || order.refund) throw new HttpError(409, "ORDER_NOT_REFUNDABLE");
    const attempt = await tx.refundReconciliationAttempt.create({
      data: {
        refundRequestId: id,
        recordedById: ownerId,
        providerReference: evidence.providerReference,
        providerTransactionNo: evidence.providerTransactionNo,
        outcome: evidence.outcome,
        failureReason: evidence.failureReason,
        requestHash,
      },
    });
    if (evidence.outcome === "FAILED") {
      return {
        refundRequest: request,
        reconciliationAttempt: reconciliationAttemptDto(attempt),
        manualReconciliationRequired: true as const,
      };
    }

    const result = await completeReconciledRefund(tx, {
      merchantId: merchant.id,
      ownerId,
      orderId: request.orderId,
      reason: request.reason,
      providerReference: evidence.providerReference,
      replay: false,
    });
    const updated = await tx.refundRequest.updateMany({
      where: { id, merchantId: merchant.id, status: "PROCESSING" },
      data: {
        status: "COMPLETED",
        merchantReviewedById: ownerId,
        merchantReviewedAt: new Date(),
        merchantDecisionReason: `External refund settlement confirmed by reference ${evidence.providerReference}`.slice(0, 255),
      },
    });
    if (!updated.count) throw new HttpError(409, "REFUND_REQUEST_NOT_PROCESSING");
    return {
      ...result,
      refundRequest: await tx.refundRequest.findUniqueOrThrow({ where: { id } }),
      reconciliationAttempt: reconciliationAttemptDto(attempt),
      manualReconciliationRequired: false as const,
    };
  }, { isolationLevel: "Serializable" }));
}
