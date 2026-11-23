import assert from "node:assert/strict";
import { test } from "node:test";
import { isQualificationContributionInCurrentCycle } from "../../../../../apps/backend/src/modules/loyalty/program/loyalty.cycle.js";

test("refund from a pre-reset cycle does not reverse current qualification progress", () => {
  assert.equal(isQualificationContributionInCurrentCycle(new Date("2025-12-31T18:00:00.000Z"), new Date("2026-03-01T00:00:00.000Z")), false);
});

test("refund from the current reset cycle still reverses qualification progress", () => {
  assert.equal(isQualificationContributionInCurrentCycle(new Date("2026-03-01T00:00:00.000Z"), new Date("2026-03-01T00:00:00.000Z")), true);
});

test("refund before the reset date in its calendar year belongs to the prior cycle", () => {
  assert.equal(isQualificationContributionInCurrentCycle(new Date("2026-02-28T16:00:00.000Z"), new Date("2026-03-01T00:00:00.000Z")), false);
});
