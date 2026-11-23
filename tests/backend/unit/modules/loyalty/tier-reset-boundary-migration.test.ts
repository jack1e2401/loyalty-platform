import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const migrationPath = resolve(process.cwd(), "prisma/migrations/20261123120000_persist_tier_reset_boundary/migration.sql");

test("tier reset migration persists an effective boundary and backfills existing memberships", () => {
  assert.equal(existsSync(migrationPath), true);
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /ADD COLUMN `effectiveAt` DATETIME\(3\)/i);
  assert.match(sql, /SET `effectiveAt` = `completedAt`/i);
  assert.match(sql, /ADD COLUMN `lastResetAt` DATETIME\(3\)/i);
  assert.match(sql, /SET membership\.`lastResetAt` = resetRun\.`effectiveAt`/i);
  assert.match(sql, /resetRun\.`cycleYear` = membership\.`lastResetCycleYear`/i);
});
