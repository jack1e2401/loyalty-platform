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
const merchantAEmail = `recon-merchant-a-${suffix}@test.local`;
const merchantBEmail = `recon-merchant-b-${suffix}@test.local`;
const memberAEmail = `recon-member-a-${suffix}@test.local`;
const fixtureEmails = [merchantAEmail, merchantBEmail, memberAEmail];

let server: Server | undefined;
let baseUrl: string;
let merchantAId: number;
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
  memberAId = memberA.id;

  const [merchantA, merchantB] = await Promise.all([
    prisma.merchant.create({ data: { ownerId: ownerA.id, name: "Merchant A", slug: `recon-a-${suffix}` } }),
    prisma.merchant.create({ data: { ownerId: ownerB.id, name: "Merchant B", slug: `recon-b-${suffix}` } }),
  ]);
  merchantAId = merchantA.id;

  await prisma.loyaltyRule.create({
    data: { merchantId: merchantA.id, vndPerPoint: 10000, isActive: true },
  });

  await prisma.loyaltyTier.create({
    data: { merchantId: merchantA.id, level: "default", name: "Default", minLifetimePoints: 0, multiplier: "1.00" },
  });

  const product = await prisma.product.create({
    data: {
      merchantId: merchantA.id,
      name: "Recon Coffee",
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
        eventRef: `recon-initial-stock-${product.id}-${suffix}`,
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
  await prisma.refundReconciliationAttempt.deleteMany({ where: { refundRequest: { merchantId: { in: merchantIds } } } });
  await prisma.refundRequest.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.orderRefund.deleteMany({ where: { requestedById: { in: userIds } } });
  await prisma.pointTransaction.deleteMany({ where: { wallet: { membership: { merchantId: { in: merchantIds } } } } });
  await prisma.loyaltyWallet.deleteMany({ where: { membership: { merchantId: { in: merchantIds } } } });
  await prisma.orderItem.deleteMany({ where: { order: { merchantId: { in: merchantIds } } } });
  await prisma.orderRequest.deleteMany({ where: { order: { merchantId: { in: merchantIds } } } });
  await prisma.order.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.merchantMembership.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.inventoryBalance.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyTier.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyRule.deleteMany({ where: { merchantId: { in: merchantIds } } });
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

  const persistedOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const persistedRequest = await prisma.refundRequest.findUniqueOrThrow({ where: { orderId } });
  const walletAfter = await prisma.loyaltyWallet.findUniqueOrThrow({ where: { id: walletBefore.id } });
  const ledgerAfter = await prisma.pointTransaction.findMany({ where: { orderId }, orderBy: { id: "asc" } });
  const inventoryAfter = await prisma.inventoryBalance.findFirstOrThrow({
    where: { merchantId: merchantAId, productId: productAId },
  });
  assert.equal(persistedOrder.status, "PAID");
  assert.equal(persistedOrder.paymentProvider, "VNPAY");
  assert.equal(persistedRequest.status, "PROCESSING");
  assert.equal(await prisma.orderRefund.count({ where: { orderId } }), 0);
  assert.equal(walletAfter.exactBalance.toString(), walletBefore.exactBalance.toString());
  assert.deepEqual(ledgerAfter.map((row) => row.id), ledgerBefore.map((row) => row.id));
  assert.equal(inventoryAfter.onHandQuantity, inventoryBefore.onHandQuantity);

  const failedEvidence = {
    outcome: "FAILED",
    providerReference: `refund-failed-${suffix}`,
    providerTransactionNo: `refund-txn-failed-${suffix}`,
    failureReason: "Provider declined the refund",
  };
  const otherMerchant = await request(`/api/merchant/refund-requests/${requestId}/reconcile`, "POST", merchantBToken, failedEvidence);
  assert.equal(otherMerchant.response.status, 404);

  const failedResult = await request(`/api/merchant/refund-requests/${requestId}/reconcile`, "POST", merchantAToken, failedEvidence);
  assert.equal(failedResult.response.status, 200);
  assert.equal(failedResult.json.refundRequest.status, "PROCESSING");
  assert.equal(failedResult.json.reconciliationAttempt.outcome, "FAILED");

  const duplicateFailure = await request(`/api/merchant/refund-requests/${requestId}/reconcile`, "POST", merchantAToken, failedEvidence);
  assert.equal(duplicateFailure.response.status, 200);
  assert.equal(duplicateFailure.json.reconciliationAttempt.id, failedResult.json.reconciliationAttempt.id);

  const settledEvidence = {
    outcome: "SETTLED",
    providerReference: `refund-settled-${suffix}`,
    providerTransactionNo: `refund-txn-settled-${suffix}`,
  };
  const settledResult = await request(`/api/merchant/refund-requests/${requestId}/reconcile`, "POST", merchantAToken, settledEvidence);
  assert.equal(settledResult.response.status, 200);
  assert.equal(settledResult.json.refundRequest.status, "COMPLETED");
  assert.equal(settledResult.json.order.status, "REFUNDED");
  assert.equal(settledResult.json.refund.providerReference, settledEvidence.providerReference);

  const completedRefund = await prisma.orderRefund.findUniqueOrThrow({ where: { orderId } });
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
  assert.equal(await prisma.orderRefund.count({ where: { orderId } }), 1);
});
