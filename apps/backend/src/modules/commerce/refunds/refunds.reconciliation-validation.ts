import { createHash } from "node:crypto";
import { HttpError } from "../../../lib/http-error.js";

export type ManualRefundOutcome = "FAILED" | "SETTLED";

export type ManualRefundEvidence = {
  outcome: ManualRefundOutcome;
  providerReference: string;
  providerTransactionNo: string | null;
  failureReason: string | null;
};

function optionalText(value: unknown, maximum: number, code: string) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new HttpError(400, code);
  const text = value.trim();
  if (!text) return null;
  if (text.length > maximum) throw new HttpError(400, code);
  return text;
}

export function parseManualRefundEvidence(value: unknown): ManualRefundEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "INVALID_INPUT");
  const record = value as Record<string, unknown>;
  if (record.outcome !== "FAILED" && record.outcome !== "SETTLED") throw new HttpError(400, "INVALID_INPUT");
  const providerReference = optionalText(record.providerReference, 191, "INVALID_INPUT");
  if (!providerReference) throw new HttpError(400, "PROVIDER_REFERENCE_REQUIRED");
  const providerTransactionNo = optionalText(record.providerTransactionNo, 64, "INVALID_INPUT");
  const failureReason = optionalText(record.failureReason, 255, "INVALID_INPUT");
  if (record.outcome === "FAILED" && !failureReason) throw new HttpError(400, "FAILURE_REASON_REQUIRED");
  if (record.outcome === "SETTLED" && failureReason) throw new HttpError(400, "INVALID_INPUT");
  return { outcome: record.outcome, providerReference, providerTransactionNo, failureReason };
}

export function hashManualRefundEvidence(evidence: ManualRefundEvidence) {
  const payload = JSON.stringify([
    evidence.outcome,
    evidence.providerReference,
    evidence.providerTransactionNo,
    evidence.failureReason,
  ]);
  return createHash("sha256").update(payload).digest("hex");
}
