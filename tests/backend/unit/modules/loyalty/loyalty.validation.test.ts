import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../../../../../apps/backend/src/lib/http-error.js";
import { parseConfig } from "../../../../../apps/backend/src/modules/loyalty/program/loyalty.validation.js";

const config = {
  vndPerPoint: 10000,
  isActive: true,
  qualificationMode: "POINTS",
  tiers: [
    { level: "default", name: "Mặc định", minLifetimePoints: 0, multiplier: "1.00", benefits: [], iconUrl: null, color: "#335E3D", maintenanceSpendVnd: null },
    { level: "silver", name: "Bạc", minLifetimePoints: 100, multiplier: "1.20", benefits: ["Ưu đãi riêng"], iconUrl: null, color: "#7A8B99", maintenanceSpendVnd: "1000000" },
    { level: "gold", name: "Vàng", minLifetimePoints: 500, multiplier: "1.50", benefits: [], iconUrl: null, color: "#B08D35", maintenanceSpendVnd: null },
  ],
};
const defaultReset = { enabled: false, day: 1, month: 1, targetPoints: 0, strategy: "ONE_DOWN", targetLevel: null };

test("accepts a variable number of named loyalty tiers and valid point rate", () => {
  const parsed = parseConfig(config);
  assert.equal(parsed.qualificationMode, "POINTS");
  assert.equal(parsed.tiers.length, 3);
  assert.equal(parsed.tiers[0]?.level, "default");
  assert.equal(parsed.tiers[2]?.minLifetimePoints, 500);
  assert.deepEqual(parsed.reset, defaultReset);
});

test("accepts explicit publish-as-new-version intent and rejects invalid intent values", () => {
  assert.equal(parseConfig({ ...config, publishAsNewVersion: true }).publishAsNewVersion, true);
  assert.equal(parseConfig({ ...config, publishAsNewVersion: false }).publishAsNewVersion, undefined);
  assert.throws(() => parseConfig({ ...config, publishAsNewVersion: "yes" }), HttpError);
});

test("accepts spend-qualified dynamic tiers and keeps qualification mode in the config", () => {
  const { minLifetimePoints: _defaultPoints, ...defaultTier } = config.tiers[0];
  const { minLifetimePoints: _silverPoints, ...silverTier } = config.tiers[1];
  const spendConfig = {
    ...config,
    qualificationMode: "SPEND",
    tiers: [
      { ...defaultTier, minSpendVnd: "0" },
      { ...silverTier, minSpendVnd: "5000000" },
    ],
  };
  const parsed = parseConfig(spendConfig);
  assert.equal(parsed.qualificationMode, "SPEND");
  assert.equal(parsed.tiers.length, 2);
  assert.equal(parsed.tiers[1]?.minSpendVnd, "5000000");
  assert.deepEqual(parsed.reset, defaultReset);
});

test("rejects invalid tier order, multiplier, duplicate code, or removed default", () => {
  const invalidInputs = [
    { ...config, vndPerPoint: 0 },
    { ...config, tiers: config.tiers.slice(1) },
    { ...config, tiers: config.tiers.map((tier, index) => ({ ...tier, minLifetimePoints: [0, 500, 100][index] })) },
    { ...config, tiers: config.tiers.map((tier, index) => index === 0 ? { ...tier, multiplier: "0.00" } : tier) },
    { ...config, tiers: config.tiers.map((tier, index) => index === 0 ? { ...tier, multiplier: "1.2" } : tier) },
    { ...config, tiers: config.tiers.map((tier, index) => index === 2 ? { ...tier, level: "silver" } : tier) },
    { ...config, tiers: config.tiers.map((tier, index) => index === 0 ? { ...tier, minLifetimePoints: 1 } : tier) },
    { ...config, qualificationMode: "CAMPAIGN" },
  ];
  for (const input of invalidInputs) {
    assert.throws(() => parseConfig(input), (error: unknown) => error instanceof HttpError && error.statusCode === 400);
  }
});

test("rejects values outside signed MySQL Int range", () => {
  assert.throws(() => parseConfig({ ...config, vndPerPoint: 2147483648 }), HttpError);
  assert.throws(() => parseConfig({
    ...config,
    tiers: config.tiers.map((tier, index) => index === 2 ? { ...tier, minLifetimePoints: 2147483648 } : tier),
  }), HttpError);
});
