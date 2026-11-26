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
const merchantAEmail = `can-merchant-a-${suffix}@test.local`;
const memberAEmail = `can-member-a-${suffix}@test.local`;
const fixtureEmails = [merchantAEmail, memberAEmail];

let server: Server | undefined;
let baseUrl: string;
let merchantAId: number;
let memberAId: number;
let merchantAToken: string;
let memberAToken: string;
let productAId: number;

before(async () => {
  const [ownerA, memberA] = await Promise.all([
    prisma.user.create({ data: { email: merchantAEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: memberAEmail, passwordHash: "fixture", role: "MEMBER" } }),
  ]);
  memberAId = memberA.id;

  const merchantA = await prisma.merchant.create({
    data: { ownerId: ownerA.id, name: "Merchant Cancel", slug: `can-a-${suffix}` },
  });
  merchantAId = merchantA.id;

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
        eventRef: `can-initial-stock-${product.id}-${suffix}`,
      },
    });
  });

  merchantAToken = await signAccessToken(ownerA.id);
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
  await prisma.reservation.deleteMany({ where: { order: { merchantId: { in: merchantIds } } } });
  await prisma.memberVoucher.deleteMany({ where: { membership: { merchantId: { in: merchantIds } } } });
  await prisma.voucherDefinition.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.orderItem.deleteMany({ where: { order: { merchantId: { in: merchantIds } } } });
  await prisma.orderRequest.deleteMany({ where: { order: { merchantId: { in: merchantIds } } } });
  await prisma.order.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.merchantMembership.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.inventoryBalance.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
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

test("1. cancel paid rejection: cannot cancel a paid order", async () => {
  const created = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
  });
  assert.equal(created.response.status, 201);
  const orderId = created.json.order.id;

  const paid = await request(`/api/orders/${orderId}/pay`, "POST", memberAToken);
  assert.equal(paid.response.status, 200);

  const cancelled = await request(`/api/orders/${orderId}/cancel`, "POST", memberAToken);
  assert.equal(cancelled.response.status, 409);
  assert.equal(cancelled.json.error, "ORDER_NOT_CANCELLABLE");
  assert.equal(cancelled.json.orderStatus, "PAID");
});

test("2. pending cancel voucher release: safe cancel releases discount voucher for reuse", async () => {
  const def = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "DISCOUNT",
    title: "10k off",
    pointsCost: 10,
    discountAmount: "10000",
  });
  assert.equal(def.response.status, 201);

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

  const orderRes = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
    voucherId: voucher.id,
  });
  assert.equal(orderRes.response.status, 201);
  const orderId = orderRes.json.order.id;

  const vouchersBefore = await request(`/api/member/merchants/${merchantAId}/vouchers`, "GET", memberAToken);
  const vBefore = vouchersBefore.json.vouchers.find((v: any) => v.id === voucher.id);
  assert.equal(vBefore.reserved, true);

  const cancelRes = await request(`/api/orders/${orderId}/cancel`, "POST", memberAToken);
  assert.equal(cancelRes.response.status, 200);
  assert.equal(cancelRes.json.order.status, "CANCELLED");
  assert.equal(cancelRes.json.voucherReleased, true);

  const vouchersAfter = await request(`/api/member/merchants/${merchantAId}/vouchers`, "GET", memberAToken);
  const vAfter = vouchersAfter.json.vouchers.find((v: any) => v.id === voucher.id);
  assert.equal(vAfter.status, "AVAILABLE");
  assert.equal(vAfter.reserved, false);

  const newOrder = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
    voucherId: voucher.id,
  });
  assert.equal(newOrder.response.status, 201);
  assert.equal(newOrder.json.order.discountAmount, "10000");

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

  const order2 = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
    voucherId: voucher.id,
  });
  assert.equal(order2.response.status, 409);
  assert.equal(order2.json.error, "VOUCHER_ALREADY_RESERVED");
});

test("4. pending orders remain cancellable and report canCancel true", async () => {
  const created = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
  });
  const orderId = created.json.order.id;
  const memberOrder = await request(`/api/member/orders/${orderId}`, "GET", memberAToken);
  assert.equal(memberOrder.response.status, 200);
  assert.equal(memberOrder.json.order.status, "PENDING");
  assert.equal(memberOrder.json.order.actions.canCancel, true);
});
