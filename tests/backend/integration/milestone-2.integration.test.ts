import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");

const [{ app }, { prisma }, { hashPassword }] = await Promise.all([
  import("../../../apps/backend/src/app.js"),
  import("../../../apps/backend/src/lib/prisma.js"),
  import("../../../apps/backend/src/lib/password.js"),
]);
const { hashRefreshToken } = await import("../../../apps/backend/src/modules/platform/auth/refresh-session.js");

const suffix = randomUUID();
const memberEmail = `member-${suffix}@test.local`;
const refreshEmail = `refresh-${suffix}@test.local`;
let server: Server;
let baseUrl: string;

before(async () => {
  await prisma.user.create({
    data: {
      email: refreshEmail,
      passwordHash: await hashPassword("refresh-session-password"),
      role: "MEMBER",
      accountStatus: "ACTIVE",
    },
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.user.deleteMany({ where: { email: { in: [memberEmail, refreshEmail] } } });
  await prisma.$disconnect();
});

test("member registers and logs in", async () => {
  const registration = await fetch(`${baseUrl}/api/auth/register/member`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: memberEmail, password: "member-password-123" }),
  });
  const registered = await registration.json();

  assert.equal(registration.status, 201);
  assert.equal(registered.user.email, memberEmail);
  assert.equal(registered.user.role, "MEMBER");
  assert.equal(registered.user.isActive, true);
  assert.equal("passwordHash" in registered.user, false);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: memberEmail, password: "member-password-123" }),
  });
  const authenticated = await login.json();
  assert.equal(login.status, 200);
  assert.equal(typeof authenticated.accessToken, "string");
  assert.equal(authenticated.user.role, "MEMBER");
});

test("login rotates refresh sessions and rejects token reuse", async () => {
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: refreshEmail, password: "refresh-session-password" }),
  });
  assert.equal(login.status, 200);
  const originalToken = (login.headers.get("set-cookie") ?? "").match(/incomsg_refresh=([^;]+)/)?.[1];
  assert.ok(originalToken);

  const firstRefresh = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: "POST",
    headers: { Cookie: `incomsg_refresh=${originalToken}` },
  });
  assert.equal(firstRefresh.status, 200);
  const rotatedToken = (firstRefresh.headers.get("set-cookie") ?? "").match(/incomsg_refresh=([^;]+)/)?.[1];
  assert.ok(rotatedToken);
  assert.notEqual(rotatedToken, originalToken);

  const replay = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: "POST",
    headers: { Cookie: `incomsg_refresh=${originalToken}` },
  });
  assert.equal(replay.status, 401);
  const session = await prisma.refreshSession.findUnique({ where: { tokenHash: hashRefreshToken(rotatedToken) } });
  assert.ok(session?.revokedAt);
});

test("merchant application and platform admin APIs are not mounted", async () => {
  const [application, admin] = await Promise.all([
    fetch(`${baseUrl}/api/auth/register/merchant`, { method: "POST" }),
    fetch(`${baseUrl}/api/admin/dashboard`),
  ]);
  assert.equal(application.status, 404);
  assert.equal(admin.status, 404);
});
