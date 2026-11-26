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
const emails = [`rlife-a-${suffix}@test.local`, `rlife-b-${suffix}@test.local`, `rlife-member-${suffix}@test.local`, `rlife-other-${suffix}@test.local`];
let server: Server | undefined;
let baseUrl: string;
let merchantAId: number;
let merchantBId: number;
let merchantAToken: string;
let merchantBToken: string;
let memberToken: string;
let memberId: number;
let otherToken: string;
let fixtureIds: number[] = [];

before(async () => {
  const [ownerA, ownerB, member, other] = await Promise.all([
    prisma.user.create({ data: { email: emails[0], passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: emails[1], passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: emails[2], passwordHash: "fixture", role: "MEMBER" } }),
    prisma.user.create({ data: { email: emails[3], passwordHash: "fixture", role: "MEMBER" } }),
  ]);
  memberId = member.id;
  fixtureIds = [ownerA.id, ownerB.id, member.id, other.id];
  const [a, b] = await Promise.all([
    prisma.merchant.create({ data: { ownerId: ownerA.id, name: "RLife A", slug: `rlife-a-${suffix}` } }),
    prisma.merchant.create({ data: { ownerId: ownerB.id, name: "RLife B", slug: `rlife-b-${suffix}` } }),
  ]);
  merchantAId = a.id;
  merchantBId = b.id;
  merchantAToken = await signAccessToken(ownerA.id);
  merchantBToken = await signAccessToken(ownerB.id);
  memberToken = await signAccessToken(member.id);
  otherToken = await signAccessToken(other.id);
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

test("hiding a reward product blocks new redemptions and preserves issued rewards for fulfillment", async () => {
  const rewardProductId = await createRewardProduct("Bình nước", merchantBToken);
  const created = await request("/api/merchant/vouchers", "POST", merchantBToken, {
    type: "REWARD", title: "Đổi bình nước", pointsCost: 100, discountAmount: null, rewardProductId,
  });
  assert.equal(created.response.status, 201);
  const definitionId = created.json.definition.id as number;
  const publicPath = `/api/merchants/${merchantBId}/vouchers`;
  const redeemPath = `/api/member/vouchers/${definitionId}/redeem`;

  const membership = await prisma.merchantMembership.create({ data: { memberId, merchantId: merchantBId } });
  const wallet = await prisma.loyaltyWallet.create({ data: { membershipId: membership.id, exactBalance: 200, netLifetimeEarned: 200 } });
  const redeemed = await request(redeemPath, "POST", memberToken, undefined, { headers: { "Idempotency-Key": randomUUID() } });
  assert.equal(redeemed.response.status, 201);
  const voucherId = redeemed.json.voucher.id as number;

  const hidden = await request(`/api/merchant/products/${rewardProductId}`, "PATCH", merchantBToken, { status: "HIDDEN" });
  assert.equal(hidden.response.status, 200);

  const rejected = await request(redeemPath, "POST", memberToken, undefined, { headers: { "Idempotency-Key": randomUUID() } });
  assert.equal(rejected.response.status, 404);
  assert.equal(rejected.json.error, "VOUCHER_DEFINITION_NOT_FOUND");

  const fulfillPath = `/api/merchant/rewards/${voucherId}/fulfill`;
  const fulfilled = await request(fulfillPath, "POST", merchantBToken, { note: "Đã trao" });
  assert.equal(fulfilled.response.status, 200);
  assert.equal(fulfilled.json.reward.status, "FULFILLED");
});

test("existing unlinked reward definitions remain redeemable", async () => {
  const definition = await prisma.voucherDefinition.create({ data: {
    merchantId: merchantBId, type: "REWARD", title: "Quà trước đây", pointsCost: 50, rewardDescription: "Ly sưu tầm",
  } });
  const membership = await prisma.merchantMembership.create({ data: { memberId: fixtureIds[3], merchantId: merchantBId } });
  await prisma.loyaltyWallet.create({ data: { membershipId: membership.id, exactBalance: 50, netLifetimeEarned: 50 } });

  const redeemed = await request(`/api/member/vouchers/${definition.id}/redeem`, "POST", otherToken, undefined, { headers: { "Idempotency-Key": randomUUID() } });
  assert.equal(redeemed.response.status, 201);
  assert.equal(redeemed.json.voucher.rewardDescription, "Ly sưu tầm");
  assert.equal(redeemed.json.wallet.availablePoints, 0);
});

test("reward cancellation: duplicate cancellation does not credit twice and rejects with 409", async () => {
  const rewardProductId = await createRewardProduct("Quà trùng lặp", merchantAToken);
  const def = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "REWARD", title: "Quà trùng lặp", pointsCost: 100, discountAmount: null, rewardProductId,
  });
  assert.equal(def.response.status, 201);

  const membership = await prisma.merchantMembership.upsert({
    where: { memberId_merchantId: { memberId, merchantId: merchantAId } },
    create: { memberId, merchantId: merchantAId },
    update: {},
  });
  await prisma.loyaltyWallet.upsert({
    where: { membershipId: membership.id },
    create: { membershipId: membership.id, exactBalance: 200, netLifetimeEarned: 200 },
    update: { exactBalance: 200 },
  });

  const redeemed = await request(`/api/member/vouchers/${def.json.definition.id}/redeem`, "POST", memberToken, undefined, {
    headers: { "Idempotency-Key": randomUUID() },
  });
  assert.equal(redeemed.response.status, 201);
  const voucherId = redeemed.json.voucher.id as number;

  const res1 = await request(`/api/merchant/rewards/${voucherId}/cancel`, "POST", merchantAToken, { reason: "Lần 1" });
  assert.equal(res1.response.status, 200);

  const res2 = await request(`/api/merchant/rewards/${voucherId}/cancel`, "POST", merchantAToken, { reason: "Lần 2" });
  assert.equal(res2.response.status, 409);
  assert.equal(res2.json.error, "REWARD_ALREADY_CANCELLED");
});

test("reward cancellation: fulfill-then-cancel and cancel-then-fulfill rejections", async () => {
  const rewardProductId = await createRewardProduct("Quà fulfill race", merchantAToken);
  const def = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "REWARD", title: "Quà fulfill race", pointsCost: 50, discountAmount: null, rewardProductId,
  });
  assert.equal(def.response.status, 201);

  const membership = await prisma.merchantMembership.upsert({
    where: { memberId_merchantId: { memberId, merchantId: merchantAId } },
    create: { memberId, merchantId: merchantAId },
    update: {},
  });
  await prisma.loyaltyWallet.upsert({
    where: { membershipId: membership.id },
    create: { membershipId: membership.id, exactBalance: 200, netLifetimeEarned: 200 },
    update: { exactBalance: 200 },
  });

  const redeemed1 = await request(`/api/member/vouchers/${def.json.definition.id}/redeem`, "POST", memberToken, undefined, {
    headers: { "Idempotency-Key": randomUUID() },
  });
  const v1Id = redeemed1.json.voucher.id as number;

  const fulfilled = await request(`/api/merchant/rewards/${v1Id}/fulfill`, "POST", merchantAToken, { note: "Đã trao quà" });
  assert.equal(fulfilled.response.status, 200);

  const cancelFulfilled = await request(`/api/merchant/rewards/${v1Id}/cancel`, "POST", merchantAToken, { reason: "Cancel after fulfill" });
  assert.equal(cancelFulfilled.response.status, 409);
  assert.equal(cancelFulfilled.json.error, "REWARD_ALREADY_FULFILLED");

  const redeemed2 = await request(`/api/member/vouchers/${def.json.definition.id}/redeem`, "POST", memberToken, undefined, {
    headers: { "Idempotency-Key": randomUUID() },
  });
  const v2Id = redeemed2.json.voucher.id as number;

  const cancelled = await request(`/api/merchant/rewards/${v2Id}/cancel`, "POST", merchantAToken, { reason: "Cancel first" });
  assert.equal(cancelled.response.status, 200);

  const fulfillCancelled = await request(`/api/merchant/rewards/${v2Id}/fulfill`, "POST", merchantAToken, { note: "Fulfill after cancel" });
  assert.equal(fulfillCancelled.response.status, 409);
  assert.equal(fulfillCancelled.json.error, "REWARD_ALREADY_CANCELLED");
});

test("reward cancellation: migration data preservation backfills REWARD vouchers and preserves DISCOUNT vouchers", async () => {
  const membership = await prisma.merchantMembership.upsert({
    where: { memberId_merchantId: { memberId, merchantId: merchantAId } },
    create: { memberId, merchantId: merchantAId },
    update: {},
  });

  const discountDef = await prisma.voucherDefinition.create({
    data: {
      merchantId: merchantAId, type: "DISCOUNT", title: "Test Disc Def", pointsCost: 10, discountAmount: "10000", rewardDescription: null,
    },
  });
  const rewardDef = await prisma.voucherDefinition.create({
    data: {
      merchantId: merchantAId, type: "REWARD", title: "Test Rew Def", pointsCost: 50, discountAmount: null, rewardDescription: "Quà test backfill",
    },
  });

  const discountAvailable = await prisma.memberVoucher.create({
    data: {
      membershipId: membership.id, definitionId: discountDef.id, snapshotType: "DISCOUNT", snapshotTitle: "Disc Avail", snapshotPointsCost: 10, snapshotDiscountAmount: "10000", snapshotRewardDescription: null, status: "AVAILABLE",
    },
  });
  const rewardLegacy = await prisma.memberVoucher.create({
    data: {
      membershipId: membership.id, definitionId: rewardDef.id, snapshotType: "REWARD", snapshotTitle: "Rew Legacy", snapshotPointsCost: 50, snapshotDiscountAmount: null, snapshotRewardDescription: "Quà test backfill", status: "AVAILABLE",
    },
  });

  await prisma.$executeRawUnsafe(
    "UPDATE `MemberVoucher` SET `status` = 'PENDING_FULFILLMENT' WHERE `snapshotType` = 'REWARD' AND `status` = 'AVAILABLE';"
  );

  const checkDiscountAvail = await prisma.memberVoucher.findUniqueOrThrow({ where: { id: discountAvailable.id } });
  assert.equal(checkDiscountAvail.status, "AVAILABLE");

  const checkRewardLegacy = await prisma.memberVoucher.findUniqueOrThrow({ where: { id: rewardLegacy.id } });
  assert.equal(checkRewardLegacy.status, "PENDING_FULFILLMENT");

  const cancelBackfilled = await request(`/api/merchant/rewards/${rewardLegacy.id}/cancel`, "POST", merchantAToken, {
    reason: "Cancelled after backfill",
  });
  assert.equal(cancelBackfilled.response.status, 200);
  assert.equal(cancelBackfilled.json.reward.status, "CANCELLED");
});
