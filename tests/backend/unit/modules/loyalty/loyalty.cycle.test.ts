import assert from "node:assert/strict";
import { test } from "node:test";
import { isQualificationContributionInCurrentCycle } from "../../../../../apps/backend/src/modules/loyalty/program/loyalty.cycle.js";

test("only reverses qualification contributions on or after the persisted reset boundary", () => {
  const effectiveReset = new Date("2026-07-01T00:00:00.000Z");
  assert.equal(isQualificationContributionInCurrentCycle(new Date("2026-03-01T12:00:00.000Z"), effectiveReset), false);
  assert.equal(isQualificationContributionInCurrentCycle(effectiveReset, effectiveReset), true);
  assert.equal(isQualificationContributionInCurrentCycle(new Date("2026-08-01T12:00:00.000Z"), effectiveReset), true);
});

test("uses the clamped persisted boundary for a non-leap February reset", () => {
  const effectiveReset = new Date("2026-02-27T17:00:00.000Z");
  assert.equal(isQualificationContributionInCurrentCycle(new Date("2026-02-27T16:59:59.999Z"), effectiveReset), false);
  assert.equal(isQualificationContributionInCurrentCycle(effectiveReset, effectiveReset), true);
});

test("keeps legacy contribution reversal enabled when no reset boundary was recorded", () => {
  assert.equal(isQualificationContributionInCurrentCycle(new Date("2026-03-01T00:00:00.000Z"), null), true);
});
