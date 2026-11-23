import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, test } from "node:test";
import { env } from "../../../apps/backend/src/config/env.js";
import { prisma } from "../../../apps/backend/src/lib/prisma.js";

after(async () => {
  await prisma.$disconnect();
});

test("runtime migration activates pending and rejected applicants before converting them to members", async () => {
  const databaseUrl = new URL(env.databaseUrl ?? "");
  assert.equal(
    databaseUrl.hostname,
    "127.0.0.1",
    "migration fixture must only run against the isolated local test database",
  );
  assert.equal(databaseUrl.port || "3306", "3306");
  assert.equal(
    decodeURIComponent(databaseUrl.pathname.slice(1)),
    "incomsg_testdb_cf91d4bc9614",
  );

  const migrationPath = resolve(
    process.cwd(),
    "prisma/migrations/20261122090000_single_merchant_runtime/migration.sql",
  );
  const migration = readFileSync(migrationPath, "utf8");
  const statements = migration.match(/UPDATE `User` AS u[\s\S]*?;/g) ?? [];
  assert.equal(
    statements.length,
    2,
    "expected distinct account status and role updates",
  );

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "CREATE TEMPORARY TABLE `User` (`id` INT NOT NULL PRIMARY KEY, `role` VARCHAR(16) NOT NULL, `accountStatus` VARCHAR(32) NOT NULL)",
    );
    await tx.$executeRawUnsafe(
      "CREATE TEMPORARY TABLE `Merchant` (`id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY, `ownerId` INT NOT NULL)",
    );
    try {
      await tx.$executeRawUnsafe(
        "INSERT INTO `User` (`id`,`role`,`accountStatus`) VALUES (1,'MERCHANT','PENDING_APPROVAL'),(2,'MERCHANT','REJECTED'),(3,'MERCHANT','ACTIVE'),(4,'MERCHANT','ACTIVE'),(5,'ADMIN','SUSPENDED')",
      );
      await tx.$executeRawUnsafe(
        "INSERT INTO `Merchant` (`ownerId`) VALUES (4)",
      );
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
      const users = await tx.$queryRawUnsafe<
        Array<{ id: number; role: string; accountStatus: string }>
      >("SELECT `id`,`role`,`accountStatus` FROM `User` ORDER BY `id`");
      assert.deepEqual(users, [
        { id: 1, role: "MEMBER", accountStatus: "ACTIVE" },
        { id: 2, role: "MEMBER", accountStatus: "ACTIVE" },
        { id: 3, role: "MEMBER", accountStatus: "ACTIVE" },
        { id: 4, role: "MERCHANT", accountStatus: "ACTIVE" },
        { id: 5, role: "MEMBER", accountStatus: "SUSPENDED" },
      ]);
    } finally {
      await tx.$executeRawUnsafe("DROP TEMPORARY TABLE IF EXISTS `Merchant`");
      await tx.$executeRawUnsafe("DROP TEMPORARY TABLE IF EXISTS `User`");
    }
  });
});

test("overlong bootstrap password exits before creating an owner or merchant", async () => {
  const databaseUrl = new URL(env.databaseUrl ?? "");
  assert.equal(
    databaseUrl.hostname,
    "127.0.0.1",
    "bootstrap fixture must only run against the isolated local test database",
  );
  assert.equal(databaseUrl.port || "3306", "3306");
  assert.equal(
    decodeURIComponent(databaseUrl.pathname.slice(1)),
    "incomsg_testdb_cf91d4bc9614",
  );

  const suffix = randomUUID();
  const email = `invalid-bootstrap-${suffix}@test.local`;
  const slug = `invalid-bootstrap-${suffix}`;
  const [ownerBefore, merchantBefore] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.merchant.findUnique({ where: { slug }, select: { id: true } }),
  ]);
  assert.equal(ownerBefore, null);
  assert.equal(merchantBefore, null);

  const seedPath = resolve(process.cwd(), "prisma/seed.ts");
  const tsxPath = resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs");
  const result = spawnSync(process.execPath, [tsxPath, seedPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      MERCHANT_OWNER_EMAIL: email,
      MERCHANT_OWNER_PASSWORD: "x".repeat(129),
      MERCHANT_NAME: "Invalid password fixture",
      MERCHANT_SLUG: slug,
    },
  });
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /MERCHANT_OWNER_PASSWORD must have at most 128 characters/,
  );

  const [ownerAfter, merchantAfter] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.merchant.findUnique({ where: { slug }, select: { id: true } }),
  ]);
  assert.equal(ownerAfter, null);
  assert.equal(merchantAfter, null);
});
