# Loyalty Policy Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Present the current loyalty policy and immutable prior versions on the merchant policy page, with complete forward snapshots and confirmation before persisted changes.

**Architecture:** Add nullable snapshot fields to `LoyaltyPolicyVersion`, populate them transactionally when publishing new versions, and expose them through the existing history endpoint. The ledger is the default entry; explicit new/edit actions open one shared `/config?mode=...` form, and every confirmed save appends a version.

**Tech Stack:** Prisma/MySQL, Express services/repository, TypeScript/React, Radix Dialog, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-loyalty-policy-ledger-design.md`

## Global Constraints

- Published versions are immutable; a changed current policy creates the next version.
- Existing historical rows with missing snapshots stay explicitly incomplete; never infer their values from mutable current config.
- Use forward-only Prisma migrations; never reset the database.
- User-initiated persisted changes require an accessible confirmation modal; cancel leaves persisted state unchanged.
- Preserve merchant isolation, order policy references, wallet balances, and ledger history.
- Do not add decorative stock/generated imagery or dependencies.

## Review Focus

- Existing legacy version rows must return nullable missing snapshot fields without breaking deserialization.
- New version publication must snapshot qualification and reset settings atomically with tiers/rule updates.
- An unchanged regular save must not create a version; explicit new-policy publication must create exactly one.
- Cancelling publish/reset confirmation must issue no write.
- Current policy fields must be merchant-scoped and history must not display another merchant's data.

---

### Task 1: Snapshot policy settings in the database and API

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/<timestamp>_loyalty_policy_settings_snapshot/migration.sql`
- Modify: `apps/backend/src/modules/loyalty/program/loyalty.config.ts`
- Modify: `apps/frontend/src/api/contracts/loyalty.ts`
- Test: `tests/backend/integration/inventory-management.integration.test.ts`

**Interfaces:**
- Add nullable snapshot fields `qualificationMode`, `resetEnabled`, `resetMonth`, `resetDay`, `resetStrategy`, `resetTargetLevel` to `LoyaltyPolicyVersion` and history DTO. Nullable values mean the data was not recorded for that version.
- History GET returns those fields as stored, including `null`; it must not fall back to `LoyaltyRule`.

- [ ] Add Prisma migration with nullable columns and no data rewrite.
- [ ] Extend publish creation to save all six settings in the same serializable transaction as the rule/tier update.
- [ ] Add integration assertions: new version returns exact snapshot; old version values remain unchanged; unchanged config does not append a version; merchant B cannot see A's version.
- [ ] Generate Prisma client and run focused typecheck/tests if local dependencies permit.

### Task 2: Build the policy register and detail presentation

**Files:**
- Modify: `apps/frontend/src/features/merchant/MerchantLoyaltyHistory.tsx`
- Modify: `apps/frontend/src/features/merchant/backend/BackendMerchantLoyaltyPage.tsx`
- Modify: `apps/frontend/src/layouts/BackendConsoleLayout.tsx` only if a route label/link must change
- Modify: `tests/frontend/unit/loyalty-policy-history-ui.test.tsx`

**Interfaces:**
- `MerchantLoyaltyHistory` accepts versions and the live config, marks current version, displays current policy summary plus prior timeline, and expands version details.
- Historical qualification/reset details display from snapshot only; null legacy fields display an unavailable-history message.
- Current detail links to `/merchant/loyalty/config?mode=edit`; creating links to `/config?mode=new`. Direct `/config` visits redirect to the ledger. The sidebar policy entry points to `/history`.

- [ ] Add current-version visual header, create action and compact timeline, using tier colors/thresholds/multipliers as the distinctive visual treatment; stack rank track as rows at mobile width.
- [ ] Show qualification mode and reset settings from snapshot; show an explicit unavailable state for null historical fields.
- [ ] Add UI tests for current vs prior read-only presentation and null legacy snapshots.
- [ ] Run the focused frontend UI test.

### Task 3: Confirm persisted writes before publishing or resetting

**Files:**
- Modify: `apps/frontend/src/features/merchant/backend/BackendMerchantLoyaltyPage.tsx`
- Test: `tests/frontend/unit/loyalty-policy-history-ui.test.tsx` or a focused merchant loyalty config UI test

**Interfaces:**
- Reuse `ConfirmActionDialog`.
- Form submit opens confirmation; confirmation invokes the existing PUT API with `publishAsNewVersion: true` in new mode and refreshes current config and policy history.
- Reset execution uses the same dialog before POST; browser-native `window.confirm` is not used.

- [ ] Add publish confirmation that says changes create a new immutable policy version.
- [ ] Add reset confirmation and ensure cancel sends no request.
- [ ] Verify confirm submits exactly once and refreshes the new current version.
- [ ] Run frontend typecheck and relevant unit tests; run MySQL integration tests only against the migrated local test DB.

## Review and commit

- [ ] Review `git diff --check` and targeted diff; preserve all unrelated working-tree changes.
- [ ] Verify Prisma migration status and do not reset the database.
- [ ] Commit only this coherent feature slice after its checks pass; do not push or deploy.
