import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const migrations = resolve(process.cwd(), "prisma/migrations");
const provenancePath = resolve(migrations, "20261122085000_payment_provenance/migration.sql");
const runtimePath = resolve(migrations, "20261122090000_single_merchant_runtime/migration.sql");
const reconciliationPath = resolve(migrations, "20261122091000_manual_refund_reconciliation/migration.sql");

test("legacy settled provider references are copied before PaymentAttempt is dropped", () => {
  assert.equal(existsSync(provenancePath), true, "payment provenance migration must precede the destructive runtime migration");
  const provenanceSql = readFileSync(provenancePath, "utf8");
  const runtimeSql = readFileSync(runtimePath, "utf8");

  assert.match(provenanceSql, /JOIN\s+`PaymentAttempt`/i);
  assert.match(provenanceSql, /`status`\s*=\s*'SUCCEEDED'/i);
  assert.match(provenanceSql, /`txnRef`/i);
  assert.match(provenanceSql, /`transactionNo`/i);
  assert.match(provenanceSql, /`source`\s*=\s*'VNPAY_IPN'/i);
  assert.match(provenanceSql, /`source`\s*=\s*'MOCK_PAYMENT'/i);
  assert.ok(provenanceSql.includes("paymentProvider"));
  assert.ok(provenanceSql.includes("paymentProviderReference"));
  assert.ok(provenanceSql.includes("paymentProviderTransactionNo"));
  assert.ok(provenancePath.localeCompare(runtimePath) < 0);
  assert.match(runtimeSql, /DROP TABLE `PaymentAttempt`/i);
});

test("manual reconciliation evidence is append-only and idempotent per provider reference", () => {
  assert.equal(existsSync(reconciliationPath), true);
  const sql = readFileSync(reconciliationPath, "utf8");
  assert.match(sql, /CREATE TABLE `RefundReconciliationAttempt`/i);
  assert.match(sql, /UNIQUE INDEX `RefundRecon_request_providerRef_key` \(`refundRequestId`, `providerReference`\)/i);
  assert.match(sql, /ENUM\('FAILED', 'SETTLED'\)/i);
  assert.match(sql, /`requestHash` VARCHAR\(64\) NOT NULL/i);
  assert.match(sql, /FOREIGN KEY \(`refundRequestId`\) REFERENCES `RefundRequest`/i);
  assert.match(sql, /FOREIGN KEY \(`recordedById`\) REFERENCES `User`/i);
});
