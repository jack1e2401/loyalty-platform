import assert from "node:assert/strict";
import { test } from "node:test";
import { readBootstrapConfig } from "../../../../../apps/backend/prisma/bootstrap-config.js";

const baseConfig = {
  MERCHANT_OWNER_EMAIL: "owner@example.test",
  MERCHANT_OWNER_PASSWORD: "valid-bootstrap-password",
  MERCHANT_NAME: "Test merchant",
  MERCHANT_SLUG: "test-merchant",
};

test("bootstrap accepts a password up to the login API limit", () => {
  assert.equal(
    readBootstrapConfig({
      ...baseConfig,
      MERCHANT_OWNER_PASSWORD: "x".repeat(128),
    }).password.length,
    128,
  );
});

test("overlong bootstrap password is rejected before bootstrap configuration is returned", () => {
  assert.throws(
    () =>
      readBootstrapConfig({
        ...baseConfig,
        MERCHANT_OWNER_PASSWORD: "x".repeat(129),
      }),
    /MERCHANT_OWNER_PASSWORD must have at most 128 characters/,
  );
});
