import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../../../../../apps/backend/src/lib/http-error.js";
import { parseManualRefundEvidence, hashManualRefundEvidence } from "../../../../../apps/backend/src/modules/commerce/refunds/refunds.reconciliation-validation.js";

test("manual refund evidence normalizes provider references and outcome", () => {
  assert.deepEqual(parseManualRefundEvidence({
    outcome: "SETTLED",
    providerReference: "  refund-123  ",
    providerTransactionNo: " txn-456 ",
  }), {
    outcome: "SETTLED",
    providerReference: "refund-123",
    providerTransactionNo: "txn-456",
    failureReason: null,
  });
});

test("failed reconciliation requires a reason and all evidence has an external reference", () => {
  assert.throws(() => parseManualRefundEvidence({ outcome: "FAILED", providerReference: "r1" }), (error) =>
    error instanceof HttpError && error.statusCode === 400 && error.message === "FAILURE_REASON_REQUIRED",
  );
  assert.throws(() => parseManualRefundEvidence({ outcome: "SETTLED", providerReference: " " }), (error) =>
    error instanceof HttpError && error.statusCode === 400 && error.message === "PROVIDER_REFERENCE_REQUIRED",
  );
});

test("same settlement evidence hashes identically after normalization", () => {
  const a = parseManualRefundEvidence({ outcome: "FAILED", providerReference: "same", failureReason: " bank rejected " });
  const b = parseManualRefundEvidence({ outcome: "FAILED", providerReference: "same", failureReason: "bank rejected" });
  assert.equal(hashManualRefundEvidence(a), hashManualRefundEvidence(b));
  assert.notEqual(hashManualRefundEvidence(a), hashManualRefundEvidence({ ...b, outcome: "SETTLED" }));
});
