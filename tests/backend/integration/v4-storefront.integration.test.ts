import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { after, before, test } from "node:test";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");

const [{ app }, { prisma }, { signAccessToken }, { defaultStorefrontConfig }] = await Promise.all([
  import("../../../apps/backend/src/app.js"),
  import("../../../apps/backend/src/lib/prisma.js"),
  import("../../../apps/backend/src/lib/access-token.js"),
  import("../../../apps/backend/src/modules/merchants/storefront/storefront.validation.js"),
]);

const suffix = randomUUID();
let server: Server;
let baseUrl = "";
let merchantId = 0;
let merchantSlug = "";
let ownerToken = "";
let memberToken = "";

before(async () => {
  const [owner, member] = await Promise.all([
    prisma.user.create({ data: { email: `store-owner-${suffix}@test.local`, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: `store-member-${suffix}@test.local`, passwordHash: "fixture", role: "MEMBER" } }),
  ]);
  merchantSlug = `store-${suffix.slice(0, 8)}`;
  const merchant = await prisma.merchant.create({ data: { ownerId: owner.id, name: "Installation Store", slug: merchantSlug } });
  merchantId = merchant.id;
  [ownerToken, memberToken] = await Promise.all([signAccessToken(owner.id), signAccessToken(member.id)]);

  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.storefrontConfigVersion.deleteMany({ where: { merchantId } });
  await prisma.storefrontDraft.deleteMany({ where: { merchantId } });
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { ownerId: true } });
  await prisma.merchant.deleteMany({ where: { id: merchantId } });
  if (merchant) await prisma.user.deleteMany({ where: { id: merchant.ownerId } });
  await prisma.user.deleteMany({ where: { email: `store-member-${suffix}@test.local` } });
  await prisma.$disconnect();
});

async function merchantRequest(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${ownerToken}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { response, json: await response.json() as Record<string, any> };
}

test("merchant storefront initializes, saves, and publishes for its installation", async () => {
  const memberAccess = await fetch(`${baseUrl}/api/merchant/storefront/preview`, {
    headers: { authorization: `Bearer ${memberToken}` },
  });
  assert.equal(memberAccess.status, 403);

  const initialized = await merchantRequest("/api/merchant/storefront");
  assert.equal(initialized.response.status, 200);
  assert.equal(initialized.json.merchant.id, merchantId);
  assert.equal(initialized.json.published.version, 1);

  const draft = defaultStorefrontConfig("Installation Store", merchantSlug);
  draft.branding.heroTitle = "Cửa hàng của tôi";
  const saved = await merchantRequest("/api/merchant/storefront/draft", "PUT", draft);
  assert.equal(saved.response.status, 200);

  const preview = await merchantRequest("/api/merchant/storefront/preview");
  assert.equal(preview.response.status, 200);
  assert.equal(preview.json.config.branding.heroTitle, "Cửa hàng của tôi");

  const published = await merchantRequest("/api/merchant/storefront/publish", "POST", { note: "Cập nhật giao diện" });
  assert.equal(published.response.status, 201);
  assert.equal(published.json.published.version, 2);

  const publicStore = await fetch(`${baseUrl}/api/public/stores/${merchantSlug}`);
  assert.equal(publicStore.status, 200);
  const content = await publicStore.json() as { config: { branding: { heroTitle: string } }; version: { version: number } };
  assert.equal(content.config.branding.heroTitle, "Cửa hàng của tôi");
  assert.equal(content.version.version, 2);
});
