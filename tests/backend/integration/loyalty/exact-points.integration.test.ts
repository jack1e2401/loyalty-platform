import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import {
  assertLedger, cleanup, createMember, createOrder, createShop,
  pay, prisma, Prisma, request, savePolicy, start, wallet, type Wallet,
} from "./exact-points.fixtures.js";
import { runAnnualTierReset } from "../../../../apps/backend/src/modules/loyalty/program/loyalty.tier-reset.js";

before(start);
after(cleanup);

test("checkout idempotency replays the same order and rejects a changed payload", async () => {
  const shop = await createShop("12000", "1.00", 10);
  const member = await createMember();
  const key = randomUUID();
  const body = { productId: shop.productId, quantity: 1 };
  const first = await request<{ order: { id: number } }>("/api/orders", "POST", member.token, body, { "Idempotency-Key": key });
  await prisma.product.update({ where: { id: shop.productId }, data: { status: "HIDDEN" } });
  const replay = await request<{ order: { id: number } }>("/api/orders", "POST", member.token, body, { "Idempotency-Key": key });
  assert.equal(first.status, 201);
  assert.equal(replay.status, 200);
  assert.equal(replay.json.order.id, first.json.order.id);
  const conflict = await request<{ error: string }>("/api/orders", "POST", member.token, { productId: shop.productId, quantity: 2 }, { "Idempotency-Key": key });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.json.error, "IDEMPOTENCY_KEY_CONFLICT");
  assert.equal(await prisma.order.count({ where: { memberId: member.id } }), 1);
  await prisma.product.update({ where: { id: shop.productId }, data: { status: "ACTIVE" } });
  const inventory = await prisma.inventoryBalance.findFirstOrThrow({ where: { merchantId: shop.id, productId: shop.productId, ownerType: "SALE_PRODUCT" } });
  assert.equal(inventory.reservedQuantity, 1);
});

test("annual tier reset persists the effective clamped boundary independently of later config", async () => {
  const shop = await createShop();
  const member = await createMember();
  const membership = await prisma.merchantMembership.create({ data: { memberId: member.id, merchantId: shop.id, qualificationProgress: "250" } });
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => Number(localDate.find((entry) => entry.type === type)?.value);
  const year = part("year");
  const month = part("month");
  const day = part("day");
  await savePolicy(shop, { reset: { enabled: true, month, day, strategy: "ONE_DOWN", targetLevel: null } });
  const now = new Date(Date.UTC(year, month - 1, day, 12));
  const result = await runAnnualTierReset(shop.id, now);
  assert.equal(result.processedCount, 1);
  const expectedBoundary = new Date(Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1000);
  const run = await prisma.tierResetRun.findUniqueOrThrow({ where: { merchantId_cycleYear: { merchantId: shop.id, cycleYear: year } } });
  assert.equal(run.effectiveAt.toISOString(), expectedBoundary.toISOString());
  const updatedMembership = await prisma.merchantMembership.findUniqueOrThrow({ where: { id: membership.id } });
  assert.equal(updatedMembership.lastResetAt?.toISOString(), expectedBoundary.toISOString());
});

test("delayed annual reset preserves qualification earned after its effective boundary", async () => {
  const shop = await createShop("6000");
  const member = await createMember();
  const membership = await prisma.merchantMembership.create({ data: { memberId: member.id, merchantId: shop.id, qualificationProgress: "250" } });
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => Number(localDate.find((entry) => entry.type === type)?.value);
  const year = part("year");
  const month = part("month");
  const day = part("day");
  await savePolicy(shop, { reset: { enabled: true, month, day, strategy: "ONE_DOWN", targetLevel: null } });
  const boundary = new Date(Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1000);
  const order = await pay(shop, member);
  await prisma.order.update({ where: { id: order.id }, data: { paidAt: new Date(boundary.getTime() + 60_000) } });

  await runAnnualTierReset(shop.id, new Date(Date.UTC(year, month - 1, day, 12)));

  const updatedMembership = await prisma.merchantMembership.findUniqueOrThrow({ where: { id: membership.id } });
  assert.equal(updatedMembership.qualificationProgress.toString(), order.earnedPointsExact);
});

test("member profile persists private contact fields", async () => {
  const shop = await createShop();
  const member = await createMember();
  const joined = await request(`/api/member/merchants/${shop.id}/membership`, "POST", member.token);
  assert.equal(joined.status, 200);
  const updated = await request<{ profile: { id: number; name: string; phone: string; address: string; birthDate: string } }>("/api/member/profile", "PATCH", member.token, {
    name: "Flow Member", phone: "+84900000000", address: "District 1", birthDate: "1994-06-15",
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.profile.id, member.id);
  assert.deepEqual({ name: updated.json.profile.name, phone: updated.json.profile.phone, address: updated.json.profile.address, birthDate: updated.json.profile.birthDate }, { name: "Flow Member", phone: "+84900000000", address: "District 1", birthDate: "1994-06-15" });
  const invalid = await request("/api/member/profile", "PATCH", member.token, { birthDate: "2024-02-31" });
  assert.equal(invalid.status, 400);
  const detail = await request<{ customer: Record<string, unknown> }>(`/api/merchant/customers/${member.id}`, "GET", shop.token);
  assert.equal(detail.status, 200);
  assert.equal("tags" in detail.json.customer, false);
});

async function createDiscountDefinition(shop: { token: string }, title: string, discountAmount: string) {
  const created = await request<{ definition: { id: number } }>("/api/merchant/vouchers", "POST", shop.token, {
    type: "DISCOUNT",
    title,
    pointsCost: 1,
    discountAmount,
    initialQuantity: 10,
  });
  assert.equal(created.status, 201);
  return created.json.definition;
}

test("two 0.6 payments persist 1.2 exact points and expose one spendable point", async () => {
  const shop = await createShop();
  const member = await createMember();
  const empty = await wallet(shop, member);
  assert.equal(empty.exactBalance, "0");
  assert.equal(empty.fractionalCarry, "0");
  assert.equal(empty.pointDebt, "0");
  const first = await pay(shop, member);
  assert.equal(first.earnedPoints, 0);
  assert.equal(first.earnedPointsExact, "0.6");
  assert.equal((await wallet(shop, member)).availablePoints, 0);
  await pay(shop, member);
  const result = await wallet(shop, member);
  assert.equal(result.exactBalance, "1.2");
  assert.equal(result.availablePoints, 1);
  assert.equal(result.fractionalCarry, "0.2");
  assert.equal(result.netLifetimeEarned, "1.2");
  assert.equal(result.lifetimeEarnedPoints, 1);
  assert.equal(result.pointDebt, "0");
  assert.deepEqual(result.transactions.map(({ delta }) => delta), ["0.6", "0.6"]);
  assert.deepEqual(result.transactions.map(({ balanceAfter }) => balanceAfter), ["1.2", "0.6"]);
  assert.deepEqual(result.transactions.map(({ availablePointsAfter }) => availablePointsAfter), [1, 0]);
  assert.deepEqual(result.transactions.map(({ fractionalCarryAfter }) => fractionalCarryAfter), ["0.2", "0.6"]);
  assert.ok(result.transactions.every(({ pointDebtAfter }) => pointDebtAfter === "0"));
  await assertLedger(shop, member, "1.2");
  const receipt = await request<{ order: { earnedPointsExact: string } }>(`/api/member/orders/${first.id}`, "GET", member.token);
  assert.equal(receipt.status, 200);
  assert.equal(receipt.json.order.earnedPointsExact, "0.6");
});

test("fractional earning rounds HALF_UP once at 12 decimal places and persists that exact credit", async () => {
  const shop = await createShop("1");
  const member = await createMember();
  await savePolicy(shop, { rate: 128000000 });
  assert.equal((await pay(shop, member)).earnedPointsExact, "0.000000007813");
  assert.equal((await wallet(shop, member)).fractionalCarry, "0.000000007813");
  await assertLedger(shop, member, "0.000000007813");
  const thirds = await createShop("1");
  await savePolicy(thirds, { rate: 3 });
  for (let index = 0; index < 3; index++) {
    assert.equal((await pay(thirds, member)).earnedPointsExact, "0.333333333333");
  }
  const result = await wallet(thirds, member);
  assert.equal(result.exactBalance, "0.999999999999");
  assert.equal(result.availablePoints, 0);
  await assertLedger(thirds, member, "0.999999999999");
});

test("earning applies the multiplier before rounding and preserves carry across policy changes", async () => {
  const shop = await createShop("6000", "1.50");
  const member = await createMember();
  assert.equal((await pay(shop, member)).earnedPointsExact, "0.9");
  await savePolicy(shop, { rate: 20000, silverThreshold: 1 });
  assert.equal((await wallet(shop, member)).exactBalance, "0.9");
  assert.equal((await pay(shop, member)).earnedPointsExact, "0.3");
  assert.equal((await wallet(shop, member)).tier, "silver");
  assert.equal((await pay(shop, member)).earnedPointsExact, "0.45");
  const result = await wallet(shop, member);
  assert.equal(result.exactBalance, "1.65");
  assert.equal(result.fractionalCarry, "0.65");
  await assertLedger(shop, member, "1.65");
});

test("one member's fractional wallets stay isolated by merchant and member", async () => {
  const shopA = await createShop();
  const shopB = await createShop("3000");
  const member = await createMember();
  const other = await createMember();
  await pay(shopA, member);
  await pay(shopB, member);
  assert.equal((await wallet(shopA, member)).exactBalance, "0.6");
  assert.equal((await wallet(shopB, member)).exactBalance, "0.3");
  assert.equal((await wallet(shopA, other)).exactBalance, "0");
  assert.deepEqual((await wallet(shopB, other)).transactions, []);
  await assertLedger(shopA, member, "0.6");
  await assertLedger(shopB, member, "0.3");
});

test("inactive earning records zero without discarding a previously earned fraction", async () => {
  const shop = await createShop();
  const member = await createMember();
  await pay(shop, member);
  await savePolicy(shop, { active: false });
  assert.equal((await pay(shop, member)).earnedPointsExact, "0");
  const result = await wallet(shop, member);
  assert.equal(result.exactBalance, "0.6");
  assert.equal(result.netLifetimeEarned, "0.6");
  assert.equal(result.transactions[0]?.delta, "0");
  await assertLedger(shop, member, "0.6");
});

test("discounted earning uses the persisted net amount", async () => {
  const shop = await createShop("6000", "1.50");
  const member = await createMember();
  const membership = await prisma.merchantMembership.create({ data: { memberId: member.id, merchantId: shop.id } });
  const definition = await prisma.voucherDefinition.create({ data: { merchantId: shop.id, type: "DISCOUNT", title: "Discount", pointsCost: 1, discountAmount: "2000" } });
  const voucher = await prisma.memberVoucher.create({ data: { membershipId: membership.id, definitionId: definition.id, snapshotType: "DISCOUNT", snapshotTitle: "Discount", snapshotPointsCost: 1, snapshotDiscountAmount: "2000" } });
  const paid = await pay(shop, member, voucher.id);
  assert.equal(paid.total, "4000");
  assert.equal(paid.earnedPointsExact, "0.6");
  assert.equal((await prisma.memberVoucher.findUniqueOrThrow({ where: { id: voucher.id } })).status, "USED");
  await assertLedger(shop, member, "0.6");
});

test("concurrent fractional payments serialize exact balances and duplicate payment cannot credit again", async () => {
  const shop = await createShop();
  const member = await createMember();
  const orders = await Promise.all([createOrder(shop, member), createOrder(shop, member)]);
  const results = await Promise.all(orders.map(({ id }) => request(`/api/orders/${id}/pay`, "POST", member.token)));
  assert.deepEqual(results.map(({ status }) => status), [200, 200]);
  const again = await request<{ error: string }>(`/api/orders/${orders[0]!.id}/pay`, "POST", member.token);
  assert.equal(again.status, 409);
  assert.equal(again.json.error, "ORDER_ALREADY_PAID");
  const stored = await assertLedger(shop, member, "1.2");
  assert.equal(stored.transactions.length, 2);
  assert.equal(stored.netLifetimeEarned.toString(), "1.2");
});

test("integer redemption keeps carry and lifetime while concurrent redemption cannot overspend", async () => {
  const shop = await createShop();
  const member = await createMember();
  await pay(shop, member);
  await pay(shop, member);
  const definition = await createDiscountDefinition(shop, "One point", "1000");
  const redemptions = await Promise.all([0, 1].map((i) => request<{ wallet: Wallet }>(
    `/api/member/vouchers/${definition.id}/redeem`,
    "POST",
    member.token,
    undefined,
    { "Idempotency-Key": `concurrent-spend-${i}-${randomUUID()}` },
  )));
  assert.deepEqual(redemptions.map(({ status }) => status).sort(), [201, 409]);
  const result = redemptions.find(({ status }) => status === 201)!.json.wallet;
  assert.equal(result.exactBalance, "0.2");
  assert.equal(result.availablePoints, 0);
  assert.equal(result.fractionalCarry, "0.2");
  assert.equal(result.netLifetimeEarned, "1.2");
  assert.equal(result.lifetimeEarnedPoints, 1);
  assert.equal(result.pointDebt, "0");
  const persisted = await assertLedger(shop, member, "0.2");
  assert.equal(persisted.transactions.at(-1)?.delta.toString(), "-1");
  assert.equal(persisted.netLifetimeEarned.toString(), "1.2");
  assert.equal((await wallet(shop, member)).fractionalCarry, "0.2");
});

test("redemption requires valid non-empty Idempotency-Key <= 128 chars", async () => {
  const shop = await createShop();
  const member = await createMember();
  await pay(shop, member);
  await pay(shop, member);
  const definition = await createDiscountDefinition(shop, "One point", "1000");

  // Missing header
  const missing = await request(`/api/member/vouchers/${definition.id}/redeem`, "POST", member.token);
  assert.equal(missing.status, 400);

  // Empty string
  const empty = await request(`/api/member/vouchers/${definition.id}/redeem`, "POST", member.token, undefined, { "Idempotency-Key": "" });
  assert.equal(empty.status, 400);

  // Whitespace only
  const whitespace = await request(`/api/member/vouchers/${definition.id}/redeem`, "POST", member.token, undefined, { "Idempotency-Key": "   " });
  assert.equal(whitespace.status, 400);

  // Overlong (> 128 chars)
  const overlong = await request(`/api/member/vouchers/${definition.id}/redeem`, "POST", member.token, undefined, { "Idempotency-Key": "a".repeat(129) });
  assert.equal(overlong.status, 400);
});

test("same-key retry issues one voucher and one ledger debit, while different-definition key reuse conflicts", async () => {
  const shop = await createShop();
  const member = await createMember();
  await pay(shop, member);
  await pay(shop, member);
  await pay(shop, member); // 1.8 points
  const def1 = await createDiscountDefinition(shop, "Voucher 1", "1000");
  const def2 = await createDiscountDefinition(shop, "Voucher 2", "2000");

  const stableKey = `idem-key-${randomUUID()}`;
  const first = await request<{ voucher: { id: number; title: string }; wallet: Wallet }>(
    `/api/member/vouchers/${def1.id}/redeem`,
    "POST",
    member.token,
    undefined,
    { "Idempotency-Key": stableKey },
  );
  assert.equal(first.status, 201);
  assert.equal(first.json.voucher.title, "Voucher 1");
  const firstVoucherId = first.json.voucher.id;

  // Replay with exact same key and definition
  const replay = await request<{ voucher: { id: number; title: string }; wallet: Wallet }>(
    `/api/member/vouchers/${def1.id}/redeem`,
    "POST",
    member.token,
    undefined,
    { "Idempotency-Key": stableKey },
  );
  assert.equal(replay.status, 201);
  assert.equal(replay.json.voucher.id, firstVoucherId);
  assert.equal(replay.json.voucher.title, "Voucher 1");

  // Verify only 1 voucher exists and only 1 debit in ledger
  const memberVouchers = await prisma.memberVoucher.findMany({ where: { membership: { memberId: member.id, merchantId: shop.id } } });
  assert.equal(memberVouchers.length, 1);
  assert.equal(memberVouchers[0].id, firstVoucherId);

  // Check ledger: 3 EARN (0.6 each = 1.8) + 1 REDEEM_DISCOUNT (-1) = 0.8 balance
  const stored = await assertLedger(shop, member, "0.8");
  const debits = stored.transactions.filter((tx) => tx.type === "REDEEM_DISCOUNT");
  assert.equal(debits.length, 1);
  assert.equal(debits[0].delta.toString(), "-1");
  assert.equal(debits[0].source, "MEMBER_REDEMPTION");
  assert.equal(debits[0].actorId, member.id);
  assert.equal(debits[0].eventRef, `redeem-voucher-${firstVoucherId}`);

  // Reusing same key for DIFFERENT definition returns 409
  const conflict = await request(
    `/api/member/vouchers/${def2.id}/redeem`,
    "POST",
    member.token,
    undefined,
    { "Idempotency-Key": stableKey },
  );
  assert.equal(conflict.status, 409);

  // Concurrent redemptions with the SAME key and definition issue only one voucher
  const concurrentKey = `concurrent-same-${randomUUID()}`;
  const concurrentSame = await Promise.all([0, 1].map(() => request<{ voucher: { id: number }; wallet: Wallet }>(
    `/api/member/vouchers/${def1.id}/redeem`,
    "POST",
    member.token,
    undefined,
    { "Idempotency-Key": concurrentKey },
  )));
  // Wait: balance was 0.8, pointsCost is 1 -> so concurrent with new key would fail if insufficient points.
  // Let's add points first if we want to test concurrent same-key success!
  await pay(shop, member);
  await pay(shop, member); // adds 1.2 points, balance = 2.0
  const concurrentSuccessKey = `concurrent-success-${randomUUID()}`;
  const concurrentBoth = await Promise.all([0, 1].map(() => request<{ voucher: { id: number }; wallet: Wallet }>(
    `/api/member/vouchers/${def2.id}/redeem`,
    "POST",
    member.token,
    undefined,
    { "Idempotency-Key": concurrentSuccessKey },
  )));
  assert.deepEqual(concurrentBoth.map((res) => res.status), [201, 201]);
  assert.equal(concurrentBoth[0].json.voucher.id, concurrentBoth[1].json.voucher.id);
  // Only 1 debit occurred (2.0 - 1 = 1.0)
  await assertLedger(shop, member, "1");
});

test("policy threshold changes select earning tier from exact lifetime instead of a stale membership tier", async () => {
  const shop = await createShop();
  const member = await createMember();
  await pay(shop, member);
  await pay(shop, member);
  assert.equal((await wallet(shop, member)).tier, "default");
  await savePolicy(shop, { silverThreshold: 1 });
  assert.equal((await pay(shop, member)).earnedPointsExact, "0.9");
  assert.equal((await wallet(shop, member)).tier, "silver");
  await assertLedger(shop, member, "2.1");
});
