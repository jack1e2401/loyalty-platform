import assert from "node:assert/strict";
import { test } from "node:test";
import { refundSettlementRoute } from "../../../../../apps/backend/src/modules/commerce/refunds/refunds.payment-routing.js";

test("only Mock payments may complete a synthetic refund", () => {
  assert.equal(refundSettlementRoute("MOCK"), "MOCK_REFUND");
});

test("VNPay and unknown legacy payment sources require manual reconciliation", () => {
  assert.equal(refundSettlementRoute("VNPAY"), "MANUAL_RECONCILIATION");
  assert.equal(refundSettlementRoute("UNKNOWN"), "MANUAL_RECONCILIATION");
});
