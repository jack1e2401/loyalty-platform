import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveResetTier } from "../../../../../apps/backend/src/modules/loyalty/program/loyalty.tier-reset.domain.js";

const tiers = [
  { id: 1, level: "default", minLifetimePoints: 0, minSpendVnd: "0", maintenanceSpendVnd: null, sortOrder: 0 },
  { id: 2, level: "silver", minLifetimePoints: 100, minSpendVnd: "1000000", maintenanceSpendVnd: "500000", sortOrder: 1 },
  { id: 3, level: "gold", minLifetimePoints: 500, minSpendVnd: "5000000", maintenanceSpendVnd: "2000000", sortOrder: 2 },
  { id: 4, level: "platinum", minLifetimePoints: 1000, minSpendVnd: "10000000", maintenanceSpendVnd: "5000000", sortOrder: 3 },
];

test("resets one tier down and sets qualification progress to the target tier baseline", () => {
  const result = resolveResetTier({
    currentTierId: 4,
    tiers,
    mode: "DOWN_ONE",
    qualificationMode: "POINTS",
    cycleSpendVnd: "0",
    maintenanceEnabled: false,
  });
  assert.deepEqual(result, { tierId: 3, progress: "500" });
});

test("ONE_DOWN follows configured sort order when tier ids were created in another order", () => {
  const reordered = [
    { ...tiers[0]!, id: 40, sortOrder: 0 },
    { ...tiers[1]!, id: 30, sortOrder: 1 },
    { ...tiers[2]!, id: 20, sortOrder: 2 },
    { ...tiers[3]!, id: 10, sortOrder: 3 },
  ];
  const result = resolveResetTier({
    currentTierId: 10,
    tiers: reordered,
    mode: "DOWN_ONE",
    qualificationMode: "POINTS",
    cycleSpendVnd: "0",
    maintenanceEnabled: false,
  });
  assert.deepEqual(result, { tierId: 20, progress: "500" });
});

test("resets to a selected tier without promoting a lower current tier", () => {
  const down = resolveResetTier({
    currentTierId: 3,
    tiers,
    mode: "TO_TIER",
    targetTierId: 2,
    qualificationMode: "SPEND",
    cycleSpendVnd: "0",
    maintenanceEnabled: false,
  });
  const noPromotion = resolveResetTier({
    currentTierId: 2,
    tiers,
    mode: "TO_TIER",
    targetTierId: 3,
    qualificationMode: "SPEND",
    cycleSpendVnd: "0",
    maintenanceEnabled: false,
  });
  assert.deepEqual(down, { tierId: 2, progress: "1000000" });
  assert.deepEqual(noPromotion, { tierId: 2, progress: "1000000" });
});

test("maintenance spend retains a tier and preserves its qualification baseline", () => {
  const retained = resolveResetTier({
    currentTierId: 3,
    tiers,
    mode: "DOWN_ONE",
    qualificationMode: "SPEND",
    cycleSpendVnd: "2000000",
    maintenanceEnabled: true,
  });
  const dropped = resolveResetTier({
    currentTierId: 3,
    tiers,
    mode: "DOWN_ONE",
    qualificationMode: "SPEND",
    cycleSpendVnd: "1999999",
    maintenanceEnabled: true,
  });
  assert.deepEqual(retained, { tierId: 3, progress: "5000000" });
  assert.deepEqual(dropped, { tierId: 2, progress: "1000000" });
});
