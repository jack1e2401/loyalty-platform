# Local UI Demo Dataset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the isolated local installation with realistic, repeatable demo data so the merchant CMS and member Mini App can be tested in the UI.

**Architecture:** Use a local-only Prisma seed script, separate from the production bootstrap seed. It verifies the MySQL host, database name, and target merchant before writes, and upserts only records identified as demo data. Preserve unrelated integration fixtures in the same local database.

**Tech Stack:** Prisma 7, TypeScript, MySQL 8, existing Vite frontend and Express backend.

**Spec:** Current owner request in Orca chat (2026-11-23): seed a full test dataset, enrich store information, and use real photos.

## Global Constraints

- Do not add sample commerce data to `apps/backend/prisma/seed.ts`.
- Only write to MySQL on `localhost`/`127.0.0.1:3306` when the database name starts with `incomsg_testdb_`, and only to the merchant selected by `MERCHANT_SLUG`.
- Do not truncate tables or modify records belonging to other merchants or existing integration fixtures.
- Use real photo URLs from Unsplash pages; do not generate or invent image URLs.
- Keep all demo records clearly identifiable and safe to upsert on rerun.

## Review Focus

- Wrong database/merchant selection: refuse writes unless both local DB and demo merchant match the exact guard.
- Rerun behavior: upsert stable demo identifiers and keep record counts stable on the second run.
- Loyalty and order consistency: seeded wallets, point ledger, tiers, and paid Mock orders must agree.
- Storefront validation: seven opening-hour entries and remote image URLs must satisfy existing config validation.
- Demo isolation: no deletes, truncates, or writes to unrelated merchant fixtures.

---

### Task 1: Build a scoped local-only demo seed

**Files:**
- Create: `apps/backend/prisma/demo-seed.ts`
- Modify: `apps/backend/package.json` (`db:seed:demo`)

**Interfaces:**
- Consumes: existing Prisma client, `hashPassword`, and storefront config types.
- Produces: idempotent demo catalogue, inventory, storefront configuration, event/challenge data, member accounts, loyalty balances/ledger, sample orders, and one pending merchant refund request for merchant `isolated-test-merchant`.

- [x] Verify target is a localhost test database, `MERCHANT_NAME=Hikari Coffee`, and the configured merchant slug before opening a write transaction.
- [x] Upsert demo rows by stable email, SKU, category slug, voucher title, challenge title, and event slug; never delete rows outside those demo identifiers.
- [x] Publish a complete Hikari Coffee storefront configuration with real Unsplash images, contact/address/opening hours, featured products, and visible sections.
- [x] Seed representative inventory, tiers, member balances/ledger, vouchers, challenges, a future event, PAID/PENDING orders, and a pending merchant refund request with consistent foreign keys.
- [x] Run the script repeatedly and confirm demo counts stay stable and each seeded ledger sums to its wallet balance.
- [x] Inspect the public storefront in the local browser and verify CMS records through merchant-scoped database queries. A new CMS browser tab redirected to login; no login was automated.
