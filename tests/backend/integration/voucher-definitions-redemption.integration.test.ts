import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");
const [{ app }, { prisma }, { signAccessToken }] = await Promise.all([
  import("../../../apps/backend/src/app.js"),
  import("../../../apps/backend/src/lib/prisma.js"),
  import("../../../apps/backend/src/lib/access-token.js"),
]);
const suffix = randomUUID();
const emails = [`vdef-a-${suffix}@test.local`, `vdef-b-${suffix}@test.local`, `vdef-member-${suffix}@test.local`, `vdef-other-${suffix}@test.local`];
let server: Server | undefined;
let baseUrl: string;
let merchantAId: number;
let merchantBId: number;
let productAId: number;
let productBId: number;
let merchantAToken: string;
let merchantBToken: string;
let memberToken: string;
let otherToken: string;
let memberId: number;
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
    prisma.merchant.create({ data: { ownerId: ownerA.id, name: "VDef A", slug: `vdef-a-${suffix}` } }),
    prisma.merchant.create({ data: { ownerId: ownerB.id, name: "VDef B", slug: `vdef-b-${suffix}` } }),
  ]);
  merchantAId = a.id;
  merchantBId = b.id;
  productAId = (await prisma.product.create({ data: { merchantId: a.id, name: "VDef Product A", price: "200000" } })).id;
  productBId = (await prisma.product.create({ data: { merchantId: b.id, name: "VDef Product B", price: "100000" } })).id;
  await seedSaleProductStock(a.id, productAId, ownerA.id);
  await seedSaleProductStock(b.id, productBId, ownerB.id);
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
  await prisma.memberActivity.deleteMany({ where: { membershipId: { in: membershipIds } } });
  const wallets = await prisma.loyaltyWallet.findMany({ where: { membershipId: { in: membershipIds } }, select: { id: true } });
  const walletIds = wallets.map((item) => item.id);
  await prisma.rewardFulfillment.deleteMany({ where: { voucher: { membershipId: { in: membershipIds } } } });
  await prisma.rewardCancellation.deleteMany({ where: { voucher: { membershipId: { in: membershipIds } } } });
  await prisma.pointTransaction.deleteMany({ where: { walletId: { in: walletIds } } });
  await prisma.orderItem.deleteMany({ where: { order: { memberId: { in: fixtureIds } } } });
  await prisma.orderRequest.deleteMany({ where: { order: { memberId: { in: fixtureIds } } } });
  await prisma.orderVoucherReservation.deleteMany({ where: { order: { memberId: { in: fixtureIds } } } });
  await prisma.order.deleteMany({ where: { memberId: { in: fixtureIds } } });
  await prisma.memberVoucher.deleteMany({ where: { membershipId: { in: membershipIds } } });
  await prisma.loyaltyWallet.deleteMany({ where: { membershipId: { in: membershipIds } } });
  await prisma.merchantMembership.deleteMany({ where: { id: { in: membershipIds } } });
  await prisma.inventoryBalance.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.voucherDefinition.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyTier.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyRule.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyPolicyVersion.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: fixtureIds } } });
  await prisma.$disconnect();
});

async function request(path: string, method = "GET", token?: string, body?: unknown, options: { headers?: Record<string, string> } = {}) {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : undefined;
  const payload = method === "POST" && path === "/api/merchant/vouchers" && input?.type === "DISCOUNT" && input.initialQuantity === undefined
    ? { ...input, initialQuantity: 100 }
    : body;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(payload !== undefined ? { "content-type": "application/json" } : {}),
      ...(method === "POST" && path === "/api/orders" ? { "Idempotency-Key": randomUUID() } : {}),
      ...options.headers,
    },
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
  return { response, json: await response.json() as Record<string, any> };
}

async function seedSaleProductStock(merchantId: number, productId: number, actorId: number, quantity = 100) {
  await prisma.$transaction(async (tx) => {
    const balance = await tx.inventoryBalance.create({
      data: { merchantId, ownerType: "SALE_PRODUCT", productId, onHandQuantity: quantity },
    });
    await tx.inventoryMovement.create({
      data: {
        balanceId: balance.id,
        merchantId,
        ownerType: "SALE_PRODUCT",
        movementType: "INITIAL_STOCK",
        quantityDelta: quantity,
        onHandBefore: 0,
        onHandAfter: quantity,
        reservedBefore: 0,
        reservedAfter: 0,
        productId,
        actorId,
        reason: "VDef fixture opening stock",
        eventRef: `vdef-initial-stock-${productId}-${randomUUID()}`,
      },
    });
  });
}

async function createRewardProduct(name: string, token: string): Promise<number> {
  const result = await request("/api/merchant/products", "POST", token, { kind: "REWARD", name, initialQuantity: 100 });
  assert.equal(result.response.status, 201);
  return result.json.product.id as number;
}

test("merchant definitions enforce type-specific fields and ownership", async () => {
  const discount = await request("/api/merchant/vouchers", "POST", merchantAToken, { type: "DISCOUNT", title: "Giảm 20k", pointsCost: 200, discountAmount: "20000" });
  assert.equal(discount.response.status, 201);
  assert.equal(discount.json.definition.discountAmount, "20000");
  const invalid = await request("/api/merchant/vouchers", "POST", merchantAToken, { type: "DISCOUNT", title: "Sai", pointsCost: 0, discountAmount: "-1" });
  assert.equal(invalid.response.status, 400);
  const foreign = await request(`/api/merchant/vouchers/${discount.json.definition.id}`, "PATCH", merchantBToken, { title: "Không phải của tôi" });
  assert.equal(foreign.response.status, 404);
  await request(`/api/merchant/vouchers/${discount.json.definition.id}`, "PATCH", merchantAToken, { isActive: false });
  const publicList = await request(`/api/merchants/${merchantAId}/vouchers`);
  assert.equal((publicList.json.definitions as any[]).some((item) => item.id === discount.json.definition.id), false);
});

test("new reward definitions require an active reward product from the same merchant", async () => {
  const fields = { type: "REWARD", title: "Đổi ly", pointsCost: 500, discountAmount: null };
  const unlinked = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    ...fields, rewardDescription: "Một chiếc ly",
  });
  assert.equal(unlinked.response.status, 400);
  assert.equal(unlinked.json.error, "INVALID_INPUT");

  const ownProductId = await createRewardProduct("Ly sứ", merchantAToken);
  const reward = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    ...fields, rewardProductId: ownProductId,
  });
  assert.equal(reward.response.status, 201);
  assert.equal(reward.json.definition.rewardProductId, ownProductId);
  assert.equal(reward.json.definition.rewardDescription, "Ly sứ");
  assert.equal(reward.json.definition.discountAmount, null);

  const foreignProductId = await createRewardProduct("Ly quà của cửa hàng khác", merchantBToken);
  const hidden = await request(`/api/merchant/products/${ownProductId}`, "PATCH", merchantAToken, { status: "HIDDEN" });
  assert.equal(hidden.response.status, 200);
  for (const [label, rewardProductId] of [
    ["sale product", productAId],
    ["foreign reward product", foreignProductId],
    ["hidden reward product", ownProductId],
  ] as const) {
    const rejected = await request("/api/merchant/vouchers", "POST", merchantAToken, { ...fields, rewardProductId });
    assert.equal(rejected.response.status, 404, label);
    assert.equal(rejected.json.error, "REWARD_PRODUCT_NOT_FOUND", label);
  }
});

test("redemption spends points once and keeps vouchers merchant scoped", async () => {
  const definition = await request("/api/merchant/vouchers", "POST", merchantAToken, { type: "DISCOUNT", title: "Giảm 20k", pointsCost: 200, discountAmount: "20000" });
  assert.equal(definition.response.status, 201);
  const membership = await prisma.merchantMembership.create({ data: { memberId, merchantId: merchantAId } });
  const wallet = await prisma.loyaltyWallet.create({ data: { membershipId: membership.id, exactBalance: 200, netLifetimeEarned: 200 } });
  await prisma.pointTransaction.create({ data: { walletId: wallet.id, type: "EARN", delta: 200, balanceAfter: 200, reason: "fixture" } });
  const concurrent = await Promise.all([
    request(`/api/member/vouchers/${definition.json.definition.id}/redeem`, "POST", memberToken, undefined, { headers: { "Idempotency-Key": randomUUID() } }),
    request(`/api/member/vouchers/${definition.json.definition.id}/redeem`, "POST", memberToken, undefined, { headers: { "Idempotency-Key": randomUUID() } }),
  ]);
  assert.deepEqual(concurrent.map(({ response }) => response.status).sort(), [201, 409]);
  const winner = concurrent.find(({ response }) => response.status === 201)!;
  assert.equal(winner.json.wallet.availablePoints, 0);
  assert.equal(winner.json.voucher.status, "AVAILABLE");

  const checkout = await request("/api/orders", "POST", memberToken, { productId: productAId, quantity: 1, voucherId: winner.json.voucher.id });
  assert.equal(checkout.response.status, 201);
  assert.equal(checkout.json.order.discountAmount, "20000");
  assert.equal(checkout.json.order.total, "180000");

  const rewardProductId = await createRewardProduct("Cốc xanh", merchantAToken);
  const rewardDefinition = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "REWARD", title: "Cốc quà", pointsCost: 100, discountAmount: null, rewardProductId,
  });
  assert.equal(rewardDefinition.response.status, 201);
  await prisma.loyaltyWallet.update({ where: { id: wallet.id }, data: { exactBalance: 100 } });
  const rewardRedemption = await request(`/api/member/vouchers/${rewardDefinition.json.definition.id}/redeem`, "POST", memberToken, undefined, { headers: { "Idempotency-Key": randomUUID() } });
  assert.equal(rewardRedemption.response.status, 201);
  assert.equal(rewardRedemption.json.voucher.type, "REWARD");
  assert.equal(rewardRedemption.json.voucher.rewardDescription, "Cốc xanh");
});

test("discount snapshot is reserved once and used only on a committed pay", async () => {
  const discountDefinition = await request("/api/merchant/vouchers", "POST", merchantAToken, { type: "DISCOUNT", title: "Giảm 20k", pointsCost: 1, discountAmount: "20000" });
  assert.equal(discountDefinition.response.status, 201);
  const membership = await prisma.merchantMembership.findUniqueOrThrow({ where: { memberId_merchantId: { memberId, merchantId: merchantAId } }, include: { wallet: true } });
  const wallet = await prisma.loyaltyWallet.update({ where: { id: membership.wallet!.id }, data: { exactBalance: 2 } });
  const discountVoucher = await prisma.memberVoucher.create({ data: { membershipId: membership.id, definitionId: discountDefinition.json.definition.id, snapshotType: "DISCOUNT", snapshotTitle: "Giảm 20k", snapshotPointsCost: 1, snapshotDiscountAmount: "20000", snapshotRewardDescription: null } });

  const orderResponse = await request("/api/orders", "POST", memberToken, { productId: productAId, quantity: 1, voucherId: discountVoucher.id });
  assert.equal(orderResponse.response.status, 201);
  const order = orderResponse.json.order;
  assert.equal(order.subtotal, "200000");
  assert.equal(order.discountAmount, "20000");
  assert.equal(order.total, "180000");

  const duplicateReservation = await request("/api/orders", "POST", memberToken, { productId: productAId, quantity: 1, voucherId: discountVoucher.id });
  assert.equal(duplicateReservation.response.status, 409);

  const successfulPay = await request(`/api/orders/${order.id}/pay`, "POST", memberToken);
  assert.equal(successfulPay.response.status, 200);
  assert.equal(successfulPay.json.order.total, "180000");

  const usedVoucher = await prisma.memberVoucher.findUniqueOrThrow({ where: { id: discountVoucher.id } });
  assert.equal(usedVoucher.status, "USED");
  assert.ok(usedVoucher.usedAt);
});
