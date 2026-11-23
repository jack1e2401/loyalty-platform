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
const merchantAEmail = `m34-merchant-a-${suffix}@test.local`;
const merchantBEmail = `m34-merchant-b-${suffix}@test.local`;
const memberAEmail = `m34-member-a-${suffix}@test.local`;
const memberBEmail = `m34-member-b-${suffix}@test.local`;
const fixtureEmails = [merchantAEmail, merchantBEmail, memberAEmail, memberBEmail];

let server: Server | undefined;
let baseUrl: string;
let merchantAId: number;
let merchantBId: number;
let merchantAOwnerId: number;
let merchantBOwnerId: number;
let memberAId: number;
let memberBId: number;
let merchantAToken: string;
let merchantBToken: string;
let memberAToken: string;
let memberBToken: string;
let productAId: number;

before(async () => {
  const [ownerA, ownerB, memberA, memberB] = await Promise.all([
    prisma.user.create({ data: { email: merchantAEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: merchantBEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: memberAEmail, passwordHash: "fixture", role: "MEMBER" } }),
    prisma.user.create({ data: { email: memberBEmail, passwordHash: "fixture", role: "MEMBER" } }),
  ]);
  merchantAOwnerId = ownerA.id;
  merchantBOwnerId = ownerB.id;
  memberAId = memberA.id;
  memberBId = memberB.id;

  const [merchantA, merchantB] = await Promise.all([
    prisma.merchant.create({ data: { ownerId: ownerA.id, name: "Merchant A", slug: `m34-a-${suffix}` } }),
    prisma.merchant.create({ data: { ownerId: ownerB.id, name: "Merchant B", slug: `m34-b-${suffix}` } }),
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
        eventRef: `m34-initial-stock-${product.id}-${suffix}`,
      },
    });
  });

  merchantAToken = await signAccessToken(ownerA.id);
  merchantBToken = await signAccessToken(ownerB.id);
  memberAToken = await signAccessToken(memberA.id);
  memberBToken = await signAccessToken(memberB.id);

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
  await prisma.refundReconciliationAttempt.deleteMany({ where: { refundRequest: { merchantId: { in: merchantIds } } } });
  await prisma.refundRequest.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.challengeProgressEntry.deleteMany({ where: { progress: { challenge: { merchantId: { in: merchantIds } } } } });
  await prisma.challengeRewardGrant.deleteMany({ where: { progress: { challenge: { merchantId: { in: merchantIds } } } } });
  await prisma.challengeProgress.deleteMany({ where: { challenge: { merchantId: { in: merchantIds } } } });
  await prisma.memberActivity.deleteMany({ where: { membership: { merchantId: { in: merchantIds } } } });
  await prisma.orderRefund.deleteMany({ where: { requestedById: { in: userIds } } });
  await prisma.orderVoucherReservation.deleteMany({ where: { order: { merchantId: { in: merchantIds } } } });
  await prisma.pointTransaction.deleteMany({ where: { wallet: { membership: { merchantId: { in: merchantIds } } } } });
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

test("1. cancel paid rejection: cannot cancel a paid order", async () => {
  const created = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
  });
  assert.equal(created.response.status, 201);
  const orderId = created.json.order.id;

  // Pay order in mock mode
  const paid = await request(`/api/orders/${orderId}/pay`, "POST", memberAToken);
  assert.equal(paid.response.status, 200);

  // Try to cancel paid order
  const cancelled = await request(`/api/orders/${orderId}/cancel`, "POST", memberAToken);
  assert.equal(cancelled.response.status, 409);
  assert.equal(cancelled.json.error, "ORDER_NOT_CANCELLABLE");
  assert.equal(cancelled.json.orderStatus, "PAID");
});

test("2. pending cancel voucher release: safe cancel releases discount voucher for reuse", async () => {
  // Create discount voucher definition and issue to member
  const def = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "DISCOUNT",
    title: "10k off",
    pointsCost: 10,
    discountAmount: "10000",
  });
  assert.equal(def.response.status, 201);

  // Member gets membership & wallet
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
      snapshotTitle: "10k off",
      snapshotPointsCost: 10,
      snapshotDiscountAmount: "10000",
      status: "AVAILABLE",
    },
  });

  // Create pending order reserving voucher
  const orderRes = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
    voucherId: voucher.id,
  });
  assert.equal(orderRes.response.status, 201);
  const orderId = orderRes.json.order.id;

  // Verify voucher is reserved
  const vouchersBefore = await request(`/api/member/merchants/${merchantAId}/vouchers`, "GET", memberAToken);
  const vBefore = vouchersBefore.json.vouchers.find((v: any) => v.id === voucher.id);
  assert.equal(vBefore.reserved, true);

  // Cancel pending order
  const cancelRes = await request(`/api/orders/${orderId}/cancel`, "POST", memberAToken);
  assert.equal(cancelRes.response.status, 200);
  assert.equal(cancelRes.json.order.status, "CANCELLED");
  assert.equal(cancelRes.json.voucherReleased, true);

  // Verify voucher is released (reserved: false) and still AVAILABLE
  const vouchersAfter = await request(`/api/member/merchants/${merchantAId}/vouchers`, "GET", memberAToken);
  const vAfter = vouchersAfter.json.vouchers.find((v: any) => v.id === voucher.id);
  assert.equal(vAfter.status, "AVAILABLE");
  assert.equal(vAfter.reserved, false);

  // A new order can now reserve this voucher!
  const newOrder = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
    voucherId: voucher.id,
  });
  assert.equal(newOrder.response.status, 201);
  assert.equal(newOrder.json.order.discountAmount, "10000");

  // Historical cancelled order still preserves its voucherId
  const dbCancelled = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  assert.equal(dbCancelled.voucherId, voucher.id);
  assert.equal(dbCancelled.status, "CANCELLED");
});

test("3. two orders cannot reserve one voucher", async () => {
  const def = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "DISCOUNT",
    title: "15k off",
    pointsCost: 10,
    discountAmount: "15000",
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
      snapshotTitle: "15k off",
      snapshotPointsCost: 10,
      snapshotDiscountAmount: "15000",
      status: "AVAILABLE",
    },
  });

  const order1 = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
    voucherId: voucher.id,
  });
  assert.equal(order1.response.status, 201);

  // Second order attempting to reserve the same voucher must fail with 409
  const order2 = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
    voucherId: voucher.id,
  });
  assert.equal(order2.response.status, 409);
  assert.equal(order2.json.error, "VOUCHER_ALREADY_RESERVED");
});

test("7. mock refund exact fractional reversal, debt, tier demotion, and voucher restore", async () => {

  // Create discount voucher
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

  // Create product with price 35,000 so total = 15,000 VND -> earns exactly 1.5 points (vndPerPoint=10000, 1.00x)
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

  // Pay order
  const paid = await request(`/api/orders/${orderId}/pay`, "POST", memberAToken);
  assert.equal(paid.response.status, 200);
  assert.equal(paid.json.order.earnedPointsExact, "1.5");

  // Member wallet currently has 1.5 points. Simulate member spending 1 point on a voucher, leaving 0.5 balance:
  await prisma.loyaltyWallet.update({
    where: { membershipId: membership.id },
    data: { exactBalance: "0.5" },
  });

  // Merchant previews refund
  const preview = await request(`/api/merchant/orders/${orderId}/refund-preview`, "GET", merchantAToken);
  assert.equal(preview.response.status, 200);
  assert.equal(preview.json.earningReversalExact, "1.5");
  assert.equal(preview.json.discountVoucherRestorable, true);

  // Merchant executes refund
  const refundRes = await approveRefund(orderId, "Defective item returned");
  assert.equal(refundRes.response.status, 200);
  assert.equal(refundRes.json.refund.status, "COMPLETED");
  assert.equal(refundRes.json.order.status, "REFUNDED");

  // Wallet balance became 0.5 - 1.5 = -1.0. Verify debt projection:
  assert.equal(refundRes.json.walletImpact.exactBalance, "-1");
  assert.equal(refundRes.json.walletImpact.pointDebt, "1");
  assert.equal(refundRes.json.walletImpact.availablePoints, 0);
  assert.equal(refundRes.json.walletImpact.fractionalCarry, "0");

  // Verify unique EARN_REVERSAL transaction was written
  const reversalTx = await prisma.pointTransaction.findFirstOrThrow({
    where: { orderId, type: "EARN_REVERSAL" },
  });
  assert.equal(reversalTx.delta.toString(), "-1.5");
  assert.equal(reversalTx.source, "MERCHANT_REFUND");
  assert.equal(reversalTx.actorId, merchantAOwnerId);
  assert.equal(reversalTx.eventRef, `order-earn-reversal-${orderId}`);

  // Verify USED discount voucher was restored to AVAILABLE
  const restoredVoucher = await prisma.memberVoucher.findUniqueOrThrow({ where: { id: voucher.id } });
  assert.equal(restoredVoucher.status, "AVAILABLE");
  assert.equal(restoredVoucher.usedAt, null);

  // Restored voucher can be used by a new order!
  const reusedOrder = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
    voucherId: voucher.id,
  });
  assert.equal(reusedOrder.response.status, 201);
});

test("8. duplicate refund request is rejected and approved refund reverses once", async () => {
  const orderRes = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
  });
  const orderId = orderRes.json.order.id;
  await request(`/api/orders/${orderId}/pay`, "POST", memberAToken);

  // Run two concurrent refund requests
  const res1 = await approveRefund(orderId, "Concurrent request");
  const res2 = await request(`/api/orders/${orderId}/refund-request`, "POST", memberAToken, { reason: "Duplicate request" });
  assert.equal(res1.response.status, 200);
  assert.equal(res2.response.status, 409);
  assert.equal(res2.json.error, "REFUND_REQUEST_ALREADY_EXISTS");

  // Only one EARN_REVERSAL transaction exists
  const reversals = await prisma.pointTransaction.findMany({
    where: { orderId, type: "EARN_REVERSAL" },
  });
  assert.equal(reversals.length, 1);

  // Subsequent refund call returns existing refund record
  const res3 = await request(`/api/merchant/orders/${orderId}/refund`, "POST", merchantAToken, { reason: "Third try" });
  assert.equal(res3.response.status, 409);
  assert.equal(res3.json.error, "USE_REFUND_APPROVAL_WORKFLOW");
});

test("9. wrong merchant 403: Merchant B cannot preview or refund Merchant A's order", async () => {
  const orderRes = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
  });
  const orderId = orderRes.json.order.id;

  const preview = await request(`/api/merchant/orders/${orderId}/refund-preview`, "GET", merchantBToken);
  assert.equal(preview.response.status, 403);
  assert.equal(preview.json.error, "FORBIDDEN");

  const refund = await request(`/api/merchant/orders/${orderId}/refund`, "POST", merchantBToken, { reason: "Steal" });
  assert.equal(refund.response.status, 409);
  assert.equal(refund.json.error, "USE_REFUND_APPROVAL_WORKFLOW");

  assert.equal((await request(`/api/orders/${orderId}/pay`, "POST", memberAToken)).response.status, 200);
  const { json } = await request(`/api/orders/${orderId}/refund-request`, "POST", memberAToken, { reason: "Wrong item" });
  const refundPath = `/api/merchant/refund-requests/${json.refundRequest.id}`;
  assert.equal((await request(refundPath, "GET", merchantBToken)).response.status, 404);
  assert.equal((await request(`${refundPath}/approve`, "POST", merchantBToken)).response.status, 404);
  assert.equal((await request(`${refundPath}/reject`, "POST", merchantBToken, { reason: "Not ours" })).response.status, 404);
  const [approved, rejected] = await Promise.all([
    request(`${refundPath}/approve`, "POST", merchantAToken),
    request(`${refundPath}/reject`, "POST", merchantAToken, { reason: "Order correct" }),
  ]);
  assert.deepEqual([approved.response.status, rejected.response.status].sort(), [200, 409]);
  const persisted = await prisma.refundRequest.findUniqueOrThrow({ where: { orderId }, include: { order: { include: { refund: true } } } });
  if (approved.response.ok) {
    assert.equal(persisted.status, "COMPLETED");
    assert.equal(persisted.order.refund?.status, "COMPLETED");
  } else {
    assert.equal(persisted.status, "REJECTED");
    assert.equal(persisted.order.status, "PAID");
    assert.equal(persisted.order.refund, null);
    const detail = await request(`/api/member/orders/${orderId}`, "GET", memberAToken);
    assert.equal(detail.json.order.refundRequest.merchantDecisionReason, "Order correct");
  }
});

test("merchant rejection exposes the recorded reason to the member without refunding the order", async () => {
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

test("11. preview auth: enforces authentication and role boundaries", async () => {
  // Member preview requires MEMBER role
  const anonMem = await request(`/api/member/merchants/${merchantAId}/loyalty/preview`, "POST", undefined, {
    netOrderAmountVnd: "50000",
  });
  assert.equal(anonMem.response.status, 401);

  const merchAsMem = await request(`/api/member/merchants/${merchantAId}/loyalty/preview`, "POST", merchantAToken, {
    netOrderAmountVnd: "50000",
  });
  assert.equal(merchAsMem.response.status, 403);

  const validMem = await request(`/api/member/merchants/${merchantAId}/loyalty/preview`, "POST", memberAToken, {
    netOrderAmountVnd: "50000",
  });
  assert.equal(validMem.response.status, 200);
  assert.equal(validMem.json.estimatedPointsExact, "5");
  assert.equal(validMem.json.multiplier, "1.00");

  // Merchant preview requires MERCHANT role
  const anonMerch = await request("/api/merchant/loyalty/preview", "POST", undefined, {
    netOrderAmountVnd: "50000",
  });
  assert.equal(anonMerch.response.status, 401);

  const memAsMerch = await request("/api/merchant/loyalty/preview", "POST", memberAToken, {
    netOrderAmountVnd: "50000",
  });
  assert.equal(memAsMerch.response.status, 403);

  const validMerch = await request("/api/merchant/loyalty/preview", "POST", merchantAToken, {
    netOrderAmountVnd: "50000",
    tierLevel: "silver",
  });
  assert.equal(validMerch.response.status, 200);
  assert.equal(validMerch.json.estimatedPointsExact, "6"); // 50000/10000 * 1.20 = 6
  assert.equal(validMerch.json.integerProjection, 6);
  assert.equal(validMerch.json.fractionalProjection, "0");
});

test("pending orders cannot be refunded before Mock payment", async () => {
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
  assert.equal(await prisma.orderRefund.count({ where: { orderId } }), 0);
  assert.equal(await prisma.pointTransaction.count({ where: { orderId } }), 0);
});

test("ledger reads stay merchant-scoped and pending orders remain cancellable", async () => {
  const txList = await request("/api/merchant/loyalty/transactions", "GET", merchantAToken);
  assert.equal(txList.response.status, 200);
  assert.ok(Array.isArray(txList.json.items));
  assert.ok(txList.json.items.length > 0);
  const first = txList.json.items[0];
  assert.ok("id" in first);
  assert.ok("delta" in first);
  assert.ok("balanceAfter" in first);
  assert.ok("memberId" in first);
  assert.ok("email" in first);

  const earnOnly = await request("/api/merchant/loyalty/transactions?type=EARN", "GET", merchantAToken);
  assert.equal(earnOnly.response.status, 200);
  assert.ok(earnOnly.json.items.every((item: any) => item.type === "EARN"));

  const created = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
  });
  const orderId = created.json.order.id;
  const memberOrder = await request(`/api/member/orders/${orderId}`, "GET", memberAToken);
  assert.equal(memberOrder.response.status, 200);
  assert.equal(memberOrder.json.order.status, "PENDING");
  assert.equal(memberOrder.json.order.actions.canCancel, true);
});

test("settled legacy provider refunds require manual reconciliation and preserve order effects", async () => {
  const created = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
  });
  assert.equal(created.response.status, 201);
  const orderId = created.json.order.id as number;
  const paid = await request(`/api/orders/${orderId}/pay`, "POST", memberAToken);
  assert.equal(paid.response.status, 200);
  assert.equal(paid.json.order.paymentProvider, "MOCK");

  const providerReference = `legacy-vnpay-${suffix}`;
  const providerTransactionNo = `txn-${suffix}`;
  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentProvider: "VNPAY",
      paymentProviderReference: providerReference,
      paymentProviderTransactionNo: providerTransactionNo,
    },
  });
  const walletBefore = await prisma.loyaltyWallet.findFirstOrThrow({
    where: { membership: { memberId: memberAId, merchantId: merchantAId } },
  });
  const ledgerBefore = await prisma.pointTransaction.findMany({ where: { orderId }, orderBy: { id: "asc" } });
  const inventoryBefore = await prisma.inventoryBalance.findFirstOrThrow({
    where: { merchantId: merchantAId, productId: productAId },
  });

  const submitted = await request(`/api/orders/${orderId}/refund-request`, "POST", memberAToken, { reason: "Legacy provider refund" });
  assert.equal(submitted.response.status, 201);
  const requestId = submitted.json.refundRequest.id as number;
  const approval = await request(`/api/merchant/refund-requests/${requestId}/approve`, "POST", merchantAToken, {});
  assert.equal(approval.response.status, 200);
  assert.equal(approval.json.manualReconciliationRequired, true);
  assert.equal(approval.json.refundRequest.status, "PROCESSING");
  assert.deepEqual(approval.json.paymentProvenance, {
    provider: "VNPAY",
    providerReference,
    providerTransactionNo,
  });

  const persistedOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const persistedRequest = await prisma.refundRequest.findUniqueOrThrow({ where: { orderId } });
  const walletAfter = await prisma.loyaltyWallet.findUniqueOrThrow({ where: { id: walletBefore.id } });
  const ledgerAfter = await prisma.pointTransaction.findMany({ where: { orderId }, orderBy: { id: "asc" } });
  const inventoryAfter = await prisma.inventoryBalance.findFirstOrThrow({
    where: { merchantId: merchantAId, productId: productAId },
  });
  assert.equal(persistedOrder.status, "PAID");
  assert.equal(persistedOrder.paymentProvider, "VNPAY");
  assert.equal(persistedOrder.paymentProviderReference, providerReference);
  assert.equal(persistedOrder.paymentProviderTransactionNo, providerTransactionNo);
  assert.equal(persistedRequest.status, "PROCESSING");
  assert.match(persistedRequest.merchantDecisionReason ?? "", /Manual reconciliation required/);
  assert.equal(await prisma.orderRefund.count({ where: { orderId } }), 0);
  assert.equal(walletAfter.exactBalance.toString(), walletBefore.exactBalance.toString());
  assert.equal(walletAfter.netLifetimeEarned.toString(), walletBefore.netLifetimeEarned.toString());
  assert.deepEqual(ledgerAfter.map((row) => row.id), ledgerBefore.map((row) => row.id));
  assert.equal(inventoryAfter.onHandQuantity, inventoryBefore.onHandQuantity);
  assert.equal(inventoryAfter.reservedQuantity, inventoryBefore.reservedQuantity);

  const detail = await request(`/api/merchant/refund-requests/${requestId}`, "GET", merchantAToken);
  assert.equal(detail.response.status, 200);
  assert.equal(detail.json.order.paymentProvider, "VNPAY");
  assert.equal(detail.json.order.paymentProviderReference, providerReference);
  assert.equal(detail.json.order.paymentProviderTransactionNo, providerTransactionNo);
  assert.equal(detail.json.settlement, null);

  const failedEvidence = {
    outcome: "FAILED",
    providerReference: `refund-failed-${suffix}`,
    providerTransactionNo: `refund-txn-failed-${suffix}`,
    failureReason: "Provider declined the refund",
  };
  const otherMerchant = await request(`/api/merchant/refund-requests/${requestId}/reconcile`, "POST", merchantBToken, failedEvidence);
  assert.equal(otherMerchant.response.status, 404);
  assert.equal(await prisma.refundReconciliationAttempt.count({ where: { refundRequestId: requestId } }), 0);
  const failedResult = await request(`/api/merchant/refund-requests/${requestId}/reconcile`, "POST", merchantAToken, failedEvidence);
  assert.equal(failedResult.response.status, 200);
  assert.equal(failedResult.json.refundRequest.status, "PROCESSING");
  assert.equal(failedResult.json.manualReconciliationRequired, true);
  assert.equal(failedResult.json.reconciliationAttempt.outcome, "FAILED");
  assert.equal(failedResult.json.reconciliationAttempt.providerReference, failedEvidence.providerReference);
  const duplicateFailure = await request(`/api/merchant/refund-requests/${requestId}/reconcile`, "POST", merchantAToken, failedEvidence);
  assert.equal(duplicateFailure.response.status, 200);
  assert.equal(duplicateFailure.json.reconciliationAttempt.id, failedResult.json.reconciliationAttempt.id);
  assert.equal(await prisma.refundReconciliationAttempt.count({ where: { refundRequestId: requestId } }), 1);
  const conflictingReference = await request(`/api/merchant/refund-requests/${requestId}/reconcile`, "POST", merchantAToken, {
    ...failedEvidence,
    failureReason: "Different payload with same provider reference",
  });
  assert.equal(conflictingReference.response.status, 409);
  assert.equal(conflictingReference.json.error, "REFUND_SETTLEMENT_REFERENCE_CONFLICT");
  const failedOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const walletAfterFailure = await prisma.loyaltyWallet.findUniqueOrThrow({ where: { id: walletBefore.id } });
  const ledgerAfterFailure = await prisma.pointTransaction.findMany({ where: { orderId }, orderBy: { id: "asc" } });
  assert.equal(failedOrder.status, "PAID");
  assert.equal(await prisma.orderRefund.count({ where: { orderId } }), 0);
  assert.equal(walletAfterFailure.exactBalance.toString(), walletBefore.exactBalance.toString());
  assert.deepEqual(ledgerAfterFailure.map((row) => row.id), ledgerBefore.map((row) => row.id));

  const settledEvidence = {
    outcome: "SETTLED",
    providerReference: `refund-settled-${suffix}`,
    providerTransactionNo: `refund-txn-settled-${suffix}`,
  };
  const settledResult = await request(`/api/merchant/refund-requests/${requestId}/reconcile`, "POST", merchantAToken, settledEvidence);
  assert.equal(settledResult.response.status, 200);
  assert.equal(settledResult.json.refundRequest.status, "COMPLETED");
  assert.equal(settledResult.json.manualReconciliationRequired, false);
  assert.equal(settledResult.json.refund.providerReference, settledEvidence.providerReference);
  assert.equal(settledResult.json.order.status, "REFUNDED");
  const successAttempt = await prisma.refundReconciliationAttempt.findUniqueOrThrow({ where: { id: settledResult.json.reconciliationAttempt.id } });
  const completedRefund = await prisma.orderRefund.findUniqueOrThrow({ where: { orderId } });
  assert.equal(successAttempt.outcome, "SETTLED");
  assert.equal(completedRefund.providerReference, settledEvidence.providerReference);
  assert.equal(completedRefund.status, "COMPLETED");
  const completedLedger = await prisma.pointTransaction.findMany({ where: { orderId } });
  const completedWallet = await prisma.loyaltyWallet.findUniqueOrThrow({ where: { id: walletBefore.id } });
  const earningReversals = completedLedger.filter((entry) => entry.type === "EARN_REVERSAL");
  assert.equal(earningReversals.length, 1);
  assert.equal(
    completedWallet.netLifetimeEarned.add(earningReversals[0].delta.abs()).toString(),
    walletBefore.netLifetimeEarned.toString(),
  );
  const duplicateSettlement = await request(`/api/merchant/refund-requests/${requestId}/reconcile`, "POST", merchantAToken, settledEvidence);
  assert.equal(duplicateSettlement.response.status, 200);
  assert.equal(duplicateSettlement.json.refund.id, settledResult.json.refund.id);
  assert.equal(await prisma.refundReconciliationAttempt.count({ where: { refundRequestId: requestId } }), 2);
  assert.equal(await prisma.orderRefund.count({ where: { orderId } }), 1);
  assert.equal((await prisma.pointTransaction.findMany({ where: { orderId } })).filter((entry) => entry.type === "EARN_REVERSAL").length, 1);

  const historicalOrderResponse = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
  });
  const historicalOrderId = historicalOrderResponse.json.order.id as number;
  await request(`/api/orders/${historicalOrderId}/pay`, "POST", memberAToken);
  await prisma.order.update({ where: { id: historicalOrderId }, data: { paymentProvider: "VNPAY", paymentProviderReference: `old-${suffix}` } });
  const historicalRequestResponse = await request(
    `/api/orders/${historicalOrderId}/refund-request`,
    "POST",
    memberAToken,
    { reason: "Legacy completed request" },
  );
  const historicalRequestId = historicalRequestResponse.json.refundRequest.id as number;
  await prisma.refundRequest.update({
    where: { id: historicalRequestId },
    data: { status: "COMPLETED" },
  });
  await prisma.order.update({ where: { id: historicalOrderId }, data: { status: "REFUNDED" } });
  const historicalReplay = await request(
    `/api/merchant/refund-requests/${historicalRequestId}/approve`,
    "POST",
    merchantAToken,
    {},
  );
  assert.equal(historicalReplay.response.status, 200);
  assert.equal(historicalReplay.json.manualReconciliationRequired, true);
  assert.equal(historicalReplay.json.refund, undefined);
  assert.equal(historicalReplay.json.refundRequest.status, "COMPLETED");
  assert.equal(await prisma.orderRefund.count({ where: { orderId: historicalOrderId } }), 0);
});
