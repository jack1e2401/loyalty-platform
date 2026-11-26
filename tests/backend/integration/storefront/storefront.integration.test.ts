import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { after, before, test } from "node:test";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");

const [{ app }, { prisma }, { signAccessToken }, { defaultStorefrontConfig }] = await Promise.all([
  import("../../../../apps/backend/src/app.js"),
  import("../../../../apps/backend/src/lib/prisma.js"),
  import("../../../../apps/backend/src/lib/access-token.js"),
  import("../../../../apps/backend/src/modules/merchants/storefront/storefront.validation.js"),
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

test("merchant storefront saves directly to its public configuration", async () => {
  const memberAccess = await fetch(`${baseUrl}/api/merchant/storefront`, { headers: { authorization: `Bearer ${memberToken}` } });
  assert.equal(memberAccess.status, 403);
  const initialized = await merchantRequest("/api/merchant/storefront");
  assert.equal(initialized.response.status, 200);
  assert.equal(initialized.json.merchant.id, merchantId);
  const config = defaultStorefrontConfig("Installation Store", merchantSlug);
  config.branding.heroTitle = "Cửa hàng của tôi";
  const saved = await merchantRequest("/api/merchant/storefront", "PUT", config);
  assert.equal(saved.response.status, 200);
  const publicStore = await fetch(`${baseUrl}/api/public/stores/${merchantSlug}`);
  assert.equal(publicStore.status, 200);
  const content = await publicStore.json() as { config: { branding: { heroTitle: string } } };
  assert.equal(content.config.branding.heroTitle, "Cửa hàng của tôi");
  assert.equal((await merchantRequest("/api/merchant/storefront")).json.config.branding.heroTitle, "Cửa hàng của tôi");
  const invalid = { ...config, featuredProductIds: [2147483647] };
  assert.equal((await merchantRequest("/api/merchant/storefront", "PUT", invalid)).response.status, 400);
  assert.equal((await merchantRequest("/api/merchant/storefront")).json.config.branding.heroTitle, "Cửa hàng của tôi");
  const removed = await fetch(`${baseUrl}/api/merchant/storefront/versions`, { headers: { authorization: `Bearer ${ownerToken}` } });
  assert.equal(removed.status, 404);
});

test("profile updates remain authoritative when the appearance is saved", async () => {
  const profilePath = "/api/merchant/storefront/profile";
  const statePath = "/api/merchant/storefront";
  const previous = await merchantRequest(statePath);
  const initial = await merchantRequest(profilePath);
  assert.equal(initial.response.status, 200);
  assert.deepEqual(initial.json.counts, { members: 0, monthlyOrders: 0, activeProducts: 0 });
  const invalid = await merchantRequest(profilePath, "PUT", { name: "" });
  assert.equal(invalid.response.status, 400);

  const forbidden = await fetch(`${baseUrl}${profilePath}`, {
    method: "PUT",
    headers: { authorization: `Bearer ${memberToken}`, "content-type": "application/json" },
    body: JSON.stringify({ name: "Other name" }),
  });
  assert.equal(forbidden.status, 403);

  const openingHours = Array.from({ length: 7 }, (_, index) => ({
    day: index + 1, closed: false, openTime: "08:00", closeTime: "18:00",
  }));
  const saved = await merchantRequest(profilePath, "PUT", {
    name: "Cửa hàng cập nhật",
    slug: "ignored",
    logoUrl: "/uploads/store-logo.webp",
    contactPhone: "0901234567",
    openingHours,
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.json.merchant.slug, merchantSlug);

  async function readPublic() {
    const response = await fetch(`${baseUrl}/api/public/stores/${merchantSlug}`);
    assert.equal(response.status, 200);
    return response.json();
  }

  const current = await readPublic();
  assert.equal(current.merchant.name, "Cửa hàng cập nhật");
  assert.equal(current.config.branding.contactPhone, "0901234567");
  assert.deepEqual(current.config.branding.openingHours, openingHours);

  const appearance = previous.json.config;
  appearance.branding.heroTitle = "Giao diện mới";
  const updated = await merchantRequest(statePath, "PUT", appearance);
  assert.equal(updated.response.status, 200);
  const refreshed = await readPublic();
  assert.equal(refreshed.config.branding.heroTitle, "Giao diện mới");
  assert.equal(refreshed.merchant.name, current.merchant.name);
  assert.equal(refreshed.config.branding.logoUrl, "/uploads/store-logo.webp");
  assert.deepEqual(refreshed.config.branding.openingHours, openingHours);
});
