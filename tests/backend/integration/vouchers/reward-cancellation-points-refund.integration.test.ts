import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");
const [{ app }, { prisma }, { signAccessToken }] = await Promise.all([
  import("../../../../apps/backend/src/app.js"),
  import("../../../../apps/backend/src/lib/prisma.js"),
  import("../../../../apps/backend/src/lib/access-token.js"),
]);
const suffix = randomUUID();
const emails = [`rcan-a-${suffix}@test.local`, `rcan-member-${suffix}@test.local`];
let server: Server | undefined;
let baseUrl: string;
let merchantAId: number;
let merchantAToken: string;
let memberToken: string;
let memberId: number;
let fixtureIds: number[] = [];

before(async () => {
  const [ownerA, member] = await Promise.all([
    prisma.user.create({ data: { email: emails[0], passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: emails[1], passwordHash: "fixture", role: "MEMBER" } }),
  ]);
  memberId = member.id;
  fixtureIds = [ownerA.id, member.id];
  const a = await prisma.merchant.create({ data: { ownerId: ownerA.id, name: "RCan A", slug: `rcan-a-${suffix}` } });
  merchantAId = a.id;
  merchantAToken = await signAccessToken(ownerA.id);
  memberToken = await signAccessToken(member.id);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  if (fixtureIds.length === 0) return;
  const merchants = await prisma.merchant.findMany({ where: { ownerId: { in: fixtureIds } }, select: { id: true } });
  const merchantIds = merchants.map((item) => item.id);
  await prisma.inventoryMovement.deleteMany({ where: { merchantId: { in: merchantIds } } });
  const memberships = await prisma.merchantMembership.findMany({ where: { memberId: { in: fixtureIds } }, select: { id: true } });
  const membershipIds = memberships.map((item) => item.id);
  await prisma.rewardCancellation.deleteMany({ where: { voucher: { membershipId: { in: membershipIds } } } });
  await prisma.pointTransaction.deleteMany({ where: { wallet: { membershipId: { in: membershipIds } } } });
  await prisma.memberVoucher.deleteMany({ where: { membershipId: { in: membershipIds } } });
  await prisma.loyaltyWallet.deleteMany({ where: { membershipId: { in: membershipIds } } });
  await prisma.merchantMembership.deleteMany({ where: { id: { in: membershipIds } } });
  await prisma.inventoryBalance.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.voucherDefinition.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: fixtureIds } } });
  await prisma.$disconnect();
});

async function request(path: string, method = "GET", token?: string, body?: unknown, options: { headers?: Record<string, string> } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { response, json: await response.json() as Record<string, any> };
}

async function createRewardProduct(name: string, token: string): Promise<number> {
  const result = await request("/api/merchant/products", "POST", token, { kind: "REWARD", name, initialQuantity: 100 });
  assert.equal(result.response.status, 201);
  return result.json.product.id as number;
}

test("reward fulfillment cancellation: success refunds exact integer points and records audit", async () => {
  const rewardProductId = await createRewardProduct("Quà tặng RCan", merchantAToken);
  const rewardDef = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "REWARD", title: "Đổi quà tặng RCan", pointsCost: 150, discountAmount: null, rewardProductId,
  });
  assert.equal(rewardDef.response.status, 201);
  const definitionId = rewardDef.json.definition.id as number;

  const membership = await prisma.merchantMembership.create({
    data: { memberId, merchantId: merchantAId },
  });
  await prisma.loyaltyWallet.create({
    data: { membershipId: membership.id, exactBalance: 300, netLifetimeEarned: 300 },
  });

  const redeemed = await request(`/api/member/vouchers/${definitionId}/redeem`, "POST", memberToken, undefined, {
    headers: { "Idempotency-Key": randomUUID() },
  });
  assert.equal(redeemed.response.status, 201);
  assert.equal(redeemed.json.voucher.status, "PENDING_FULFILLMENT");
  assert.equal(redeemed.json.wallet.availablePoints, 150);
  const voucherId = redeemed.json.voucher.id as number;

  const cancelRes = await request(`/api/merchant/rewards/${voucherId}/cancel`, "POST", merchantAToken, {
    reason: "Item damaged during preparation",
  });
  assert.equal(cancelRes.response.status, 200);

  const { reward, wallet } = cancelRes.json;
  assert.equal(reward.status, "CANCELLED");
  assert.equal(reward.memberVoucherId, voucherId);
  assert.equal(reward.memberId, memberId);
  assert.equal(reward.pointsCost, 150);
  assert.equal(reward.cancellationReason, "Item damaged during preparation");

  assert.equal(wallet.exactBalance, "300");
  assert.equal(wallet.availablePoints, 300);
  assert.equal(wallet.pointDebt, "0");
  assert.equal(wallet.netLifetimeEarned, "300");

  const dbVoucher = await prisma.memberVoucher.findUniqueOrThrow({
    where: { id: voucherId },
    include: { cancellation: true },
  });
  assert.equal(dbVoucher.status, "CANCELLED");
  assert.ok(dbVoucher.cancellation);
  assert.equal(dbVoucher.cancellation.reason, "Item damaged during preparation");

  const ledger = await prisma.pointTransaction.findFirstOrThrow({
    where: { memberVoucherId: voucherId, type: "REDEMPTION_REVERSAL" },
  });
  assert.equal(ledger.delta.toString(), "150");
  assert.equal(ledger.balanceAfter.toString(), "300");
});

test("reward cancellation: debt recovery pays down pointDebt before available points without changing tier or lifetime", async () => {
  const membership = await prisma.merchantMembership.findUniqueOrThrow({
    where: { memberId_merchantId: { memberId, merchantId: merchantAId } },
  });
  await prisma.loyaltyWallet.update({
    where: { membershipId: membership.id },
    data: { exactBalance: "-40.5", netLifetimeEarned: "500" },
  });

  const rewardProductId = await createRewardProduct("Quà nợ", merchantAToken);
  const def = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "REWARD", title: "Quà nợ", pointsCost: 100, discountAmount: null, rewardProductId,
  });
  assert.equal(def.response.status, 201);

  const voucher = await prisma.memberVoucher.create({
    data: {
      membershipId: membership.id,
      definitionId: def.json.definition.id,
      snapshotType: "REWARD",
      snapshotTitle: "Quà nợ",
      snapshotPointsCost: 100,
      snapshotDiscountAmount: null,
      snapshotRewardDescription: "Quà nợ",
      status: "PENDING_FULFILLMENT",
    },
  });

  const cancelRes = await request(`/api/merchant/rewards/${voucher.id}/cancel`, "POST", merchantAToken, {
    reason: "Debt recovery test",
  });
  assert.equal(cancelRes.response.status, 200);

  const wallet = cancelRes.json.wallet;
  assert.equal(wallet.pointDebt, "0");
  assert.equal(wallet.availablePoints, 59);
  assert.equal(wallet.fractionalCarry, "0.5");
  assert.equal(wallet.exactBalance, "59.5");
  assert.equal(wallet.netLifetimeEarned, "500");
});
