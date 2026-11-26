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
const merchantAEmail = `conc-merchant-a-${suffix}@test.local`;
const memberEmail = `conc-member-${suffix}@test.local`;
const secondMemberEmail = `conc-member-b-${suffix}@test.local`;
let server: Server | undefined;
let baseUrl: string;
let merchantAId: number;
let merchantAToken: string;
let memberToken: string;
let secondMemberToken: string;
let fixturesCreated = false;

before(async () => {
  const [ownerA, member, secondMember] = await Promise.all([
    prisma.user.create({ data: { email: merchantAEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: memberEmail, passwordHash: "fixture", role: "MEMBER" } }),
    prisma.user.create({ data: { email: secondMemberEmail, passwordHash: "fixture", role: "MEMBER" } }),
  ]);
  const merchantA = await prisma.merchant.create({ data: { ownerId: ownerA.id, name: "Conc A", slug: `conc-a-${suffix}` } });
  fixturesCreated = true;
  merchantAId = merchantA.id;
  merchantAToken = await signAccessToken(ownerA.id);
  memberToken = await signAccessToken(member.id);
  secondMemberToken = await signAccessToken(secondMember.id);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  if (!fixturesCreated) return;
  const users = await prisma.user.findMany({ where: { email: { in: [merchantAEmail, memberEmail, secondMemberEmail] } }, select: { id: true } });
  const memberIds = users.filter((user) => user.id !== undefined).map((user) => user.id);
  const memberships = await prisma.merchantMembership.findMany({ where: { memberId: { in: memberIds } }, select: { id: true } });
  const membershipIds = memberships.map((membership) => membership.id);
  await prisma.memberActivity.deleteMany({ where: { membershipId: { in: membershipIds } } });
  const wallets = await prisma.loyaltyWallet.findMany({ where: { membershipId: { in: membershipIds } }, select: { id: true } });
  await prisma.pointTransaction.deleteMany({ where: { walletId: { in: wallets.map((wallet) => wallet.id) } } });
  await prisma.inventoryMovement.deleteMany({ where: { merchantId: merchantAId } });
  await prisma.loyaltyWallet.deleteMany({ where: { membershipId: { in: membershipIds } } });
  await prisma.merchantMembership.deleteMany({ where: { id: { in: membershipIds } } });
  const orders = await prisma.order.findMany({ where: { memberId: { in: memberIds } }, select: { id: true } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orders.map((order) => order.id) } } });
  await prisma.orderRequest.deleteMany({ where: { orderId: { in: orders.map((order) => order.id) } } });
  await prisma.order.deleteMany({ where: { id: { in: orders.map((order) => order.id) } } });
  await prisma.inventoryBalance.deleteMany({ where: { merchantId: merchantAId } });
  await prisma.product.deleteMany({ where: { merchantId: merchantAId } });
  await prisma.loyaltyTier.deleteMany({ where: { merchantId: merchantAId } });
  await prisma.loyaltyRule.deleteMany({ where: { merchantId: merchantAId } });
  await prisma.loyaltyPolicyVersion.deleteMany({ where: { merchantId: merchantAId } });
  await prisma.merchant.deleteMany({ where: { id: merchantAId } });
  await prisma.user.deleteMany({ where: { email: { in: [merchantAEmail, memberEmail, secondMemberEmail] } } });
  await prisma.$disconnect();
});

async function request(path: string, method: string, token?: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
      ...(method === "POST" && path === "/api/orders" ? { "Idempotency-Key": randomUUID() } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { response, json: await response.json() as Record<string, any> };
}

test("only one concurrent payment of the same order earns points once", async () => {
  const walletBefore = await request(`/api/member/merchants/${merchantAId}/wallet`, "GET", memberToken);
  const product = await request("/api/merchant/products", "POST", merchantAToken, { name: "Concurrent Same", price: "200000", initialQuantity: 10 });
  const order = await request("/api/orders", "POST", memberToken, { productId: product.json.product.id, quantity: 1 });
  const responses = await Promise.all([
    request(`/api/orders/${order.json.order.id}/pay`, "POST", memberToken),
    request(`/api/orders/${order.json.order.id}/pay`, "POST", memberToken),
  ]);
  assert.deepEqual(responses.map((result) => result.response.status).sort(), [200, 409]);
  const wallet = await request(`/api/member/merchants/${merchantAId}/wallet`, "GET", memberToken);
  assert.equal(wallet.json.wallet.availablePoints, walletBefore.json.wallet.availablePoints + 20);
  assert.equal(wallet.json.wallet.transactions.filter((transaction: { orderId: number }) => transaction.orderId === order.json.order.id).length, 1);
});

test("concurrent paid orders serialize the wallet balance and preserve member isolation", async () => {
  const walletBefore = await request(`/api/member/merchants/${merchantAId}/wallet`, "GET", memberToken);
  const product = await request("/api/merchant/products", "POST", merchantAToken, { name: "Concurrent Different", price: "200000", initialQuantity: 10 });
  const [first, second] = await Promise.all([
    request("/api/orders", "POST", memberToken, { productId: product.json.product.id, quantity: 1 }),
    request("/api/orders", "POST", memberToken, { productId: product.json.product.id, quantity: 1 }),
  ]);
  const payments = await Promise.all([
    request(`/api/orders/${first.json.order.id}/pay`, "POST", memberToken),
    request(`/api/orders/${second.json.order.id}/pay`, "POST", memberToken),
  ]);
  assert.deepEqual(payments.map((result) => result.response.status), [200, 200]);
  const wallet = await request(`/api/member/merchants/${merchantAId}/wallet`, "GET", memberToken);
  assert.equal(wallet.json.wallet.availablePoints, walletBefore.json.wallet.availablePoints + 40);
  assert.equal(wallet.json.wallet.lifetimeEarnedPoints, walletBefore.json.wallet.lifetimeEarnedPoints + 40);
  const orderIds = new Set([first.json.order.id, second.json.order.id]);
  const balances = wallet.json.wallet.transactions.filter((transaction: { orderId: number }) => orderIds.has(transaction.orderId)).map((transaction: { balanceAfter: string }) => transaction.balanceAfter).sort((a: string, b: string) => Number(a) - Number(b));
  assert.deepEqual(balances, [String(walletBefore.json.wallet.availablePoints + 20), String(walletBefore.json.wallet.availablePoints + 40)]);

  const foreignPay = await request(`/api/orders/${first.json.order.id}/pay`, "POST", secondMemberToken);
  assert.equal(foreignPay.response.status, 404);
  const foreignWallet = await request(`/api/member/merchants/${merchantAId}/wallet`, "GET", secondMemberToken);
  assert.equal(foreignWallet.json.wallet.availablePoints, 0);
  assert.equal(foreignWallet.json.wallet.tier, "UNRANKED");
  assert.deepEqual(foreignWallet.json.wallet.transactions, []);
});

test("rejects a paid order that would overflow the stored points balance", async () => {
  const product = await request("/api/merchant/products", "POST", merchantAToken, { name: "Overflow", price: "200000", initialQuantity: 10 });
  const order = await request("/api/orders", "POST", memberToken, { productId: product.json.product.id, quantity: 1 });
  const membership = await prisma.merchantMembership.findUniqueOrThrow({ where: { memberId_merchantId: { memberId: (await prisma.user.findUniqueOrThrow({ where: { email: memberEmail } })).id, merchantId: merchantAId } } });
  const wallet = await prisma.loyaltyWallet.findUniqueOrThrow({ where: { membershipId: membership.id } });
  await prisma.loyaltyWallet.update({ where: { id: wallet.id }, data: { exactBalance: 2147483647, netLifetimeEarned: 2147483647 } });
  const paid = await request(`/api/orders/${order.json.order.id}/pay`, "POST", memberToken);
  assert.equal(paid.response.status, 409);
  assert.equal(paid.json.error, "LOYALTY_LIMIT_EXCEEDED");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.json.order.id } })).status, "PENDING");
});

test("rejects an order whose earned points exceed the stored Int range", async () => {
  const product = await request("/api/merchant/products", "POST", merchantAToken, {
    name: "Too Many Points",
    price: "999999999999999",
    initialQuantity: 10,
  });
  const order = await request("/api/orders", "POST", memberToken, { productId: product.json.product.id, quantity: 1 });
  const paid = await request(`/api/orders/${order.json.order.id}/pay`, "POST", memberToken);
  assert.equal(paid.response.status, 409);
  assert.equal(paid.json.error, "LOYALTY_LIMIT_EXCEEDED");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.json.order.id } })).status, "PENDING");
});
