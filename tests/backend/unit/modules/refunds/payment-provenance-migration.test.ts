import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const migrations = resolve(process.cwd(), "prisma/migrations");
const provenancePath = resolve(migrations, "20261122085000_payment_provenance/migration.sql");
const runtimePath = resolve(migrations, "20261122090000_single_merchant_runtime/migration.sql");

test("legacy settled provider references are copied before PaymentAttempt is dropped", () => {
  assert.equal(existsSync(provenancePath), true, "payment provenance migration must precede the destructive runtime migration");
  const provenanceSql = readFileSync(provenancePath, "utf8");
  const runtimeSql = readFileSync(runtimePath, "utf8");

  assert.match(provenanceSql, /JOIN\s+`PaymentAttempt`/i);
  assert.match(provenanceSql, /`status`\s*=\s*'SUCCEEDED'/i);
  assert.match(provenanceSql, /`txnRef`/i);
  assert.match(provenanceSql, /`transactionNo`/i);
  assert.ok(provenanceSql.includes("paymentProvider"));
  assert.ok(provenanceSql.includes("paymentProviderReference"));
  assert.ok(provenanceSql.includes("paymentProviderTransactionNo"));
  assert.ok(provenancePath.localeCompare(runtimePath) < 0);
  assert.match(runtimeSql, /DROP TABLE `PaymentAttempt`/i);
});
