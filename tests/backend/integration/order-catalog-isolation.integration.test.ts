import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import { HttpError } from "../../../apps/backend/src/lib/http-error.js";
import { readRouteId } from "../../../apps/backend/src/modules/commerce/products/products.validation.js";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");

const [{ app }, { prisma }, { signAccessToken }] = await Promise.all([
  import("../../../apps/backend/src/app.js"),
  import("../../../apps/backend/src/lib/prisma.js"),
  import("../../../apps/backend/src/lib/access-token.js"),
]);

const suffix = randomUUID();
const merchantAEmail = `cat-merchant-a-${suffix}@test.local`;
const merchantBEmail = `cat-merchant-b-${suffix}@test.local`;
const memberEmail = `cat-member-${suffix}@test.local`;
const inactiveMerchantEmail = `cat-inactive-${suffix}@test.local`;
const fixtureEmails = [merchantAEmail, merchantBEmail, memberEmail, inactiveMerchantEmail];

let server: Server | undefined;
let baseUrl: string;
let merchantAId: number;
let inactiveMerchantId: number;
let merchantAToken: string;
let merchantBToken: string;
let memberToken: string;

before(async () => {
  const [merchantAOwner, merchantBOwner, member, inactiveMerchantOwner] = await Promise.all([
    prisma.user.create({ data: { email: merchantAEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: merchantBEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: memberEmail, passwordHash: "fixture", role: "MEMBER" } }),
    prisma.user.create({ data: { email: inactiveMerchantEmail, passwordHash: "fixture", role: "MERCHANT" } }),
  ]);

  const [merchantA, merchantB, inactiveMerchant] = await Promise.all([
    prisma.merchant.create({ data: { ownerId: merchantAOwner.id, name: "Merchant A", slug: `cat-a-${suffix}` } }),
    prisma.merchant.create({ data: { ownerId: merchantBOwner.id, name: "Merchant B", slug: `cat-b-${suffix}` } }),
    prisma.merchant.create({ data: { ownerId: inactiveMerchantOwner.id, name: "Inactive Merchant", slug: `cat-inactive-${suffix}`, isActive: false } }),
  ]);

  merchantAId = merchantA.id;
  inactiveMerchantId = inactiveMerchant.id;
  merchantAToken = await signAccessToken(merchantAOwner.id);
  merchantBToken = await signAccessToken(merchantBOwner.id);
  memberToken = await signAccessToken(member.id);

  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  }
  const users = await prisma.user.findMany({ where: { email: { in: fixtureEmails } }, select: { id: true } });
  const userIds = users.map(({ id }) => id);
  const merchants = await prisma.merchant.findMany({ where: { ownerId: { in: userIds } }, select: { id: true } });
  const merchantIds = merchants.map(({ id }) => id);
  await prisma.inventoryMovement.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.inventoryBalance.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

async function request(path: string, method: string, token?: string, body?: Record<string, unknown>) {
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

test("route IDs reject repeated path parameter values", () => {
  assert.throws(
    () => readRouteId(["12"]),
    (error: unknown) => error instanceof HttpError && error.statusCode === 400,
  );
});

test("merchant manages its own catalog", async () => {
  const created = await request("/api/merchant/products", "POST", merchantAToken, {
    name: "Demo Coffee",
    price: "150000",
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.json.product.kind, "SALE");
  assert.equal(created.json.product.price, "150000");

  const memberCreate = await request("/api/merchant/products", "POST", memberToken, {
    name: "Member Product",
    price: "1000",
  });
  assert.equal(memberCreate.response.status, 403);

  const otherMerchantUpdate = await request(
    `/api/merchant/products/${created.json.product.id}`,
    "PATCH",
    merchantBToken,
    { name: "Not yours" },
  );
  assert.equal(otherMerchantUpdate.response.status, 404);

  const updated = await request(
    `/api/merchant/products/${created.json.product.id}`,
    "PATCH",
    merchantAToken,
    { name: "Demo Coffee Large", price: "160000" },
  );
  assert.equal(updated.response.status, 200);
  assert.equal(updated.json.product.name, "Demo Coffee Large");
  assert.equal(updated.json.product.price, "160000");
});

test("catalog rejects invalid input", async () => {
  const invalidPrice = await request("/api/merchant/products", "POST", merchantAToken, {
    name: "Invalid Coffee",
    price: "0",
  });
  assert.equal(invalidPrice.response.status, 400);
  assert.equal(invalidPrice.json.error, "INVALID_INPUT");

  const emptyPatch = await request("/api/merchant/products/1", "PATCH", merchantAToken, {});
  assert.equal(emptyPatch.response.status, 400);
  assert.equal(emptyPatch.json.error, "INVALID_INPUT");

  const invalidMerchantId = await request("/api/merchants/0/products", "GET");
  assert.equal(invalidMerchantId.response.status, 400);
  assert.equal(invalidMerchantId.json.error, "INVALID_INPUT");
});

test("public catalog filters hidden products", async () => {
  const created = await request("/api/merchant/products", "POST", merchantAToken, {
    name: "Catalog Coffee",
    price: "150000",
  });
  assert.equal(created.response.status, 201);
  const productId = created.json.product.id as number;

  const visible = await request(`/api/merchants/${merchantAId}/products`, "GET");
  assert.ok(visible.json.items.some((product: { id: number }) => product.id === productId));

  const hidden = await request(`/api/merchant/products/${productId}`, "PATCH", merchantAToken, { status: "HIDDEN" });
  assert.equal(hidden.response.status, 200);

  const publicList = await request(`/api/merchants/${merchantAId}/products`, "GET");
  assert.equal(publicList.json.items.some((product: { id: number }) => product.id === productId), false);

  const ownList = await request("/api/merchant/products", "GET", merchantAToken);
  assert.equal(ownList.json.items.find((product: { id: number }) => product.id === productId).status, "HIDDEN");

  const inactiveStore = await request(`/api/merchants/${inactiveMerchantId}/products`, "GET");
  assert.equal(inactiveStore.response.status, 404);
});

test("reward products are visible to the owning merchant and cannot be purchased", async () => {
  const created = await request("/api/merchant/products", "POST", merchantAToken, {
    kind: "REWARD",
    name: "Loyalty Mug",
    description: "A blue ceramic mug",
    imageUrl: "https://example.com/mug.png",
  });
  assert.equal(created.response.status, 201);
  const productId = created.json.product.id as number;
  assert.equal(created.json.product.kind, "REWARD");
  assert.equal(created.json.product.price, "0");
  assert.equal(created.json.product.status, "ACTIVE");
  assert.equal(created.json.product.description, "A blue ceramic mug");
  assert.equal(created.json.product.imageUrl, "https://example.com/mug.png");

  const [own, foreign, publicCatalog, checkout] = await Promise.all([
    request("/api/merchant/products", "GET", merchantAToken),
    request("/api/merchant/products", "GET", merchantBToken),
    request(`/api/merchants/${merchantAId}/products`, "GET"),
    request("/api/orders", "POST", memberToken, { productId, quantity: 1 }),
  ]);
  assert.equal(own.response.status, 200);
  assert.equal(own.json.items.find((product: { id: number }) => product.id === productId)?.kind, "REWARD");
  assert.equal(foreign.response.status, 200);
  assert.equal(foreign.json.items.some((product: { id: number }) => product.id === productId), false);
  assert.equal(publicCatalog.response.status, 200);
  assert.equal(publicCatalog.json.items.some((product: { id: number }) => product.id === productId), false);
  assert.equal(checkout.response.status, 404);
  assert.equal(checkout.json.error, "PRODUCT_NOT_FOUND");
});
