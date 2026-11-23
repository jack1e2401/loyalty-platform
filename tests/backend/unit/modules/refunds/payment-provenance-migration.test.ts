import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const migrations = resolve(process.cwd(), "prisma/migrations");
const provenancePath = resolve(
  migrations,
  "20261122085000_payment_provenance/migration.sql",
);
const runtimePath = resolve(
  migrations,
  "20261122090000_single_merchant_runtime/migration.sql",
);
const reconciliationPath = resolve(
  migrations,
  "20261122091000_manual_refund_reconciliation/migration.sql",
);
const qualificationBackfillPath = resolve(
  migrations,
  "20261123100000_backfill_qualification_progress/migration.sql",
);

test("existing qualification progress is backfilled from lifetime earnings", () => {
  assert.equal(existsSync(qualificationBackfillPath), true);
  const sql = readFileSync(qualificationBackfillPath, "utf8");
  assert.match(sql, /UPDATE `MerchantMembership` AS membership/i);
  assert.match(sql, /JOIN `LoyaltyWallet` AS wallet ON wallet\.`membershipId` = membership\.`id`/i);
  assert.match(sql, /SET membership\.`qualificationProgress` = wallet\.`netLifetimeEarned`/i);
});

test("legacy settled provider references are copied before PaymentAttempt is dropped", () => {
  assert.equal(
    existsSync(provenancePath),
    true,
    "payment provenance migration must precede the destructive runtime migration",
  );
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
  assert.match(
    sql,
    /UNIQUE INDEX `RefundRecon_request_providerRef_key` \(`refundRequestId`, `providerReference`\)/i,
  );
  assert.match(sql, /ENUM\('FAILED', 'SETTLED'\)/i);
  assert.match(sql, /`requestHash` VARCHAR\(64\) NOT NULL/i);
  assert.match(
    sql,
    /FOREIGN KEY \(`refundRequestId`\) REFERENCES `RefundRequest`/i,
  );
  assert.match(sql, /FOREIGN KEY \(`recordedById`\) REFERENCES `User`/i);
});

test("pending and rejected merchant applicant statuses are activated before role conversion", () => {
  const sql = readFileSync(runtimePath, "utf8");
  const userUpdates = sql.match(/UPDATE `User` AS u[\s\S]*?;/g) ?? [];
  assert.equal(
    userUpdates.length,
    2,
    "status and role changes must be separate User updates",
  );
  assert.match(userUpdates[0], /SET u\.`accountStatus` = 'ACTIVE'/i);
  assert.match(
    userUpdates[0],
    /u\.`accountStatus` IN \('PENDING_APPROVAL', 'REJECTED'\)/i,
  );
  assert.doesNotMatch(userUpdates[0].split(/WHERE/i, 1)[0], /u\.`role`/i);
  assert.match(userUpdates[1], /SET u\.`role` = 'MEMBER'/i);
  assert.ok(sql.indexOf(userUpdates[0]) < sql.indexOf(userUpdates[1]));
});
