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
const merchantAEmail = `ref-merchant-a-${suffix}@test.local`;
const merchantBEmail = `ref-merchant-b-${suffix}@test.local`;
const memberAEmail = `ref-member-a-${suffix}@test.local`;
const fixtureEmails = [merchantAEmail, merchantBEmail, memberAEmail];

let server: Server | undefined;
let baseUrl: string;
let merchantAId: number;
let merchantBId: number;
let merchantAOwnerId: number;
let memberAId: number;
let merchantAToken: string;
let merchantBToken: string;
let memberAToken: string;
let productAId: number;

before(async () => {
  const [ownerA, ownerB, memberA] = await Promise.all([
    prisma.user.create({ data: { email: merchantAEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: merchantBEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: memberAEmail, passwordHash: "fixture", role: "MEMBER" } }),
  ]);
  merchantAOwnerId = ownerA.id;
  memberAId = memberA.id;

  const [merchantA, merchantB] = await Promise.all([
    prisma.merchant.create({ data: { ownerId: ownerA.id, name: "Merchant A", slug: `ref-a-${suffix}` } }),
    prisma.merchant.create({ data: { ownerId: ownerB.id, name: "Merchant B", slug: `ref-b-${suffix}` } }),
  ]);
  merchantAId = merchantA.id;
  merchantBId = merchantB.id;

  await prisma.loyaltyRule.createMany({
    data: [
      { merchantId: merchantA.id, vndPerPoint: 10000, isActive: true },
      { merchantId: merchantB.id, vndPerPoint: 10000, isActive: true },
    ],
  });

  await prisma.loyaltyTier.createMany({
    data: [
      { merchantId: merchantA.id, level: "default", name: "Default", minLifetimePoints: 0, multiplier: "1.00" },
      { merchantId: merchantA.id, level: "silver", name: "Silver", minLifetimePoints: 1000, multiplier: "1.20" },
      { merchantId: merchantA.id, level: "gold", name: "Gold", minLifetimePoints: 5000, multiplier: "1.50" },
      { merchantId: merchantA.id, level: "platinum", name: "Platinum", minLifetimePoints: 10000, multiplier: "2.00" },
    ],
  });

  const product = await prisma.product.create({
    data: {
      merchantId: merchantA.id,
      name: "Special Coffee",
      price: "100000",
      kind: "SALE",
      status: "ACTIVE",
    },
  });
  productAId = product.id;

  await prisma.$transaction(async (tx) => {
    const balance = await tx.inventoryBalance.create({
      data: {
        merchantId: merchantA.id,
        ownerType: "SALE_PRODUCT",
        productId: product.id,
        onHandQuantity: 100,
      },
    });
    await tx.inventoryMovement.create({
      data: {
        balanceId: balance.id,
        merchantId: merchantA.id,
        ownerType: "SALE_PRODUCT",
        movementType: "INITIAL_STOCK",
        quantityDelta: 100,
        onHandBefore: 0,
        onHandAfter: 100,
        reservedBefore: 0,
        reservedAfter: 0,
        productId: product.id,
        actorId: ownerA.id,
        reason: "Integration fixture opening stock",
        eventRef: `ref-initial-stock-${product.id}-${suffix}`,
      },
    });
  });

  merchantAToken = await signAccessToken(ownerA.id);
  merchantBToken = await signAccessToken(ownerB.id);
  memberAToken = await signAccessToken(memberA.id);

  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  const users = await prisma.user.findMany({ where: { email: { in: fixtureEmails } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const merchants = await prisma.merchant.findMany({ where: { ownerId: { in: userIds } }, select: { id: true } });
  const merchantIds = merchants.map((m) => m.id);

  await prisma.inventoryMovement.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.refundRequest.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.refundOrder.deleteMany({ where: { requestedById: { in: userIds } } });
  await prisma.reservation.deleteMany({ where: { order: { merchantId: { in: merchantIds } } } });
  await prisma.pointTransaction.deleteMany({ where: { wallet: { membership: { merchantId: { in: merchantIds } } } } });
  await prisma.challengeProgressEntry.deleteMany({ where: { progress: { membership: { merchantId: { in: merchantIds } } } } });
  await prisma.challengeRewardGrant.deleteMany({ where: { progress: { membership: { merchantId: { in: merchantIds } } } } });
  await prisma.challengeProgress.deleteMany({ where: { membership: { merchantId: { in: merchantIds } } } });
  await prisma.memberActivity.deleteMany({ where: { membership: { merchantId: { in: merchantIds } } } });
  await prisma.loyaltyWallet.deleteMany({ where: { membership: { merchantId: { in: merchantIds } } } });
  await prisma.memberVoucher.deleteMany({ where: { membership: { merchantId: { in: merchantIds } } } });
  await prisma.orderItem.deleteMany({ where: { order: { merchantId: { in: merchantIds } } } });
  await prisma.orderRequest.deleteMany({ where: { order: { merchantId: { in: merchantIds } } } });
  await prisma.order.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.merchantMembership.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.inventoryBalance.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.voucherDefinition.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyTier.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyRule.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyPolicyVersion.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

async function request(path: string, method = "GET", token?: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
      ...(method === "POST" && path === "/api/orders" ? { "Idempotency-Key": randomUUID() } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  try {
    return { response, json: JSON.parse(text) };
  } catch {
    return { response, text };
  }
}

async function approveRefund(orderId: number, reason: string) {
  const submitted = await request(`/api/orders/${orderId}/refund-request`, "POST", memberAToken, { reason });
  if (submitted.response.status !== 201) return submitted;
  const requestId = submitted.json.refundRequest.id as number;
  const merchantApproval = await request(`/api/merchant/refund-requests/${requestId}/approve`, "POST", merchantAToken, {});
  assert.equal(merchantApproval.response.status, 200, JSON.stringify(merchantApproval.json));
  return merchantApproval;
}

test("1. mock refund exact fractional reversal, debt, tier demotion, and voucher restore", async () => {
  const def = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "DISCOUNT",
    title: "20k off",
    pointsCost: 10,
    discountAmount: "20000",
    initialQuantity: 1,
  });
  const membership = await prisma.merchantMembership.upsert({
    where: { memberId_merchantId: { memberId: memberAId, merchantId: merchantAId } },
    create: { memberId: memberAId, merchantId: merchantAId },
    update: {},
  });
  const voucher = await prisma.memberVoucher.create({
    data: {
      membershipId: membership.id,
      definitionId: def.json.definition.id,
      snapshotType: "DISCOUNT",
      snapshotTitle: "20k off",
      snapshotPointsCost: 10,
      snapshotDiscountAmount: "20000",
      status: "AVAILABLE",
    },
  });

  const product15Result = await request("/api/merchant/products", "POST", merchantAToken, {
    name: "Juice",
    price: "35000",
    kind: "SALE",
    initialQuantity: 1,
  });
  assert.equal(product15Result.response.status, 201);
  const product15 = product15Result.json.product;

  const orderRes = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: product15.id, quantity: 1 }],
    voucherId: voucher.id,
  });
  const orderId = orderRes.json.order.id;
  assert.equal(orderRes.json.order.total, "15000");

  const paid = await request(`/api/orders/${orderId}/pay`, "POST", memberAToken);
  assert.equal(paid.response.status, 200);
  assert.equal(paid.json.order.earnedPointsExact, "1.5");

  await prisma.loyaltyWallet.update({
    where: { membershipId: membership.id },
    data: { exactBalance: "0.5" },
  });

  const preview = await request(`/api/merchant/orders/${orderId}/refund-preview`, "GET", merchantAToken);
  assert.equal(preview.response.status, 200);
  assert.equal(preview.json.earningReversalExact, "1.5");
  assert.equal(preview.json.discountVoucherRestorable, true);

  const refundRes = await approveRefund(orderId, "Defective item returned");
  assert.equal(refundRes.response.status, 200);
  assert.equal(refundRes.json.refund.status, "COMPLETED");
  assert.equal(refundRes.json.order.status, "REFUNDED");

  assert.equal(refundRes.json.walletImpact.exactBalance, "-1");
  assert.equal(refundRes.json.walletImpact.pointDebt, "1");
  assert.equal(refundRes.json.walletImpact.availablePoints, 0);
  assert.equal(refundRes.json.walletImpact.fractionalCarry, "0");

  const reversalTx = await prisma.pointTransaction.findFirstOrThrow({
    where: { orderId, type: "EARN_REVERSAL" },
  });
  assert.equal(reversalTx.delta.toString(), "-1.5");
  assert.equal(reversalTx.source, "MERCHANT_REFUND");
  assert.equal(reversalTx.actorId, merchantAOwnerId);
  assert.equal(reversalTx.eventRef, `order-earn-reversal-${orderId}`);

  const restoredVoucher = await prisma.memberVoucher.findUniqueOrThrow({ where: { id: voucher.id } });
  assert.equal(restoredVoucher.status, "AVAILABLE");
  assert.equal(restoredVoucher.usedAt, null);

  const reusedOrder = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
    voucherId: voucher.id,
  });
  assert.equal(reusedOrder.response.status, 201);
});

test("2. duplicate refund request is rejected and approved refund reverses once", async () => {
  const orderRes = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
  });
  const orderId = orderRes.json.order.id;
  await request(`/api/orders/${orderId}/pay`, "POST", memberAToken);

  const res1 = await approveRefund(orderId, "Concurrent request");
  const res2 = await request(`/api/orders/${orderId}/refund-request`, "POST", memberAToken, { reason: "Duplicate request" });
  assert.equal(res1.response.status, 200);
  assert.equal(res2.response.status, 409);
  assert.equal(res2.json.error, "REFUND_REQUEST_ALREADY_EXISTS");

  const reversals = await prisma.pointTransaction.findMany({
    where: { orderId, type: "EARN_REVERSAL" },
  });
  assert.equal(reversals.length, 1);

  const res3 = await request(`/api/merchant/orders/${orderId}/refund`, "POST", merchantAToken, { reason: "Third try" });
  assert.equal(res3.response.status, 409);
  assert.equal(res3.json.error, "USE_REFUND_APPROVAL_WORKFLOW");
});

test("3. wrong merchant 403: Merchant B cannot preview or refund Merchant A's order", async () => {
  const orderRes = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
  });
  const orderId = orderRes.json.order.id;

  const preview = await request(`/api/merchant/orders/${orderId}/refund-preview`, "GET", merchantBToken);
  assert.equal(preview.response.status, 403);
  assert.equal(preview.json.error, "FORBIDDEN");

  assert.equal((await request(`/api/orders/${orderId}/pay`, "POST", memberAToken)).response.status, 200);
  const { json } = await request(`/api/orders/${orderId}/refund-request`, "POST", memberAToken, { reason: "Wrong item" });
  const refundPath = `/api/merchant/refund-requests/${json.refundRequest.id}`;
  assert.equal((await request(refundPath, "GET", merchantBToken)).response.status, 404);

  assert.equal((await request(`${refundPath}/approve`, "POST", merchantBToken)).response.status, 404);
  assert.equal((await request(`${refundPath}/reject`, "POST", merchantBToken, { reason: "Not ours" })).response.status, 404);
});

test("4. merchant rejection exposes the recorded reason without refunding the order", async () => {
  const created = await request("/api/orders", "POST", memberAToken, { items: [{ productId: productAId, quantity: 1 }] });
  assert.equal(created.response.status, 201);
  const orderId = created.json.order.id;
  assert.equal((await request(`/api/orders/${orderId}/pay`, "POST", memberAToken)).response.status, 200);
  const submitted = await request(`/api/orders/${orderId}/refund-request`, "POST", memberAToken, { reason: "Wrong size" });
  assert.equal(submitted.response.status, 201);
  const rejectPath = `/api/merchant/refund-requests/${submitted.json.refundRequest.id}/reject`;
  assert.equal((await request(rejectPath, "POST", merchantAToken, { reason: " " })).response.status, 400);
  assert.equal((await request(rejectPath, "POST", merchantAToken, { reason: "Size was verified" })).response.status, 200);
  const { json } = await request(`/api/member/orders/${orderId}`, "GET", memberAToken);
  assert.equal(json.order.status, "PAID");
  assert.equal(json.order.refundStatus, null);
  assert.equal(json.order.refundRequest.status, "REJECTED");
  assert.equal(json.order.refundRequest.merchantDecisionReason, "Size was verified");
  assert.ok(Number.isFinite(Date.parse(json.order.refundRequest.merchantReviewedAt)));
});

test("5. pending orders cannot be refunded before payment", async () => {
  const created = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
  });
  assert.equal(created.response.status, 201);
  const orderId = created.json.order.id;

  const preview = await request(`/api/merchant/orders/${orderId}/refund-preview`, "GET", merchantAToken);
  const refund = await request(`/api/orders/${orderId}/refund-request`, "POST", memberAToken, { reason: "Cannot refund unpaid money" });
  assert.equal(preview.response.status, 409);
  assert.equal(refund.response.status, 409);
  assert.equal(refund.json.error, "ORDER_NOT_REFUNDABLE");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, "PENDING");
});
