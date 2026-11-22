# Single merchant installation

## Goal

Run one isolated IncomSG application and database per merchant. `Merchant` remains the installation root for storefront, catalog, orders, loyalty, and reporting. Merchant ownership is created by an idempotent deployment bootstrap; members still register locally.

## Scope

- Remove platform Admin routes, pages, navigation, APIs, moderation/application schemas, and Admin/demo seed data.
- Remove merchant application registration, review, and status flows.
- Remove VNPay configuration, request/callback/IPN code, payment-attempt reservation state, and VNPay-only tests/docs. Keep the existing Mock `POST /api/orders/:id/pay` settlement path and its inventory, voucher, points, tier, challenge, and refund effects.
- Keep merchant CMS, member registration/storefront, orders/checkout, and merchant-final refund request/review. Mock refunds record synthetic settlement only; they do not move real money.
- Drop platform commission fee models and views while retaining order and merchant sales analytics/history.
- Bootstrap one configured Merchant owner, singleton Merchant, storefront defaults, tiers, and loyalty rule/policy. No Admin, demo member, order, or commerce seed data.
- Implement the owner-approved expanded loyalty/member scope (2026-11-22): dynamic merchant-defined tiers with one non-removable default, points-or-spend qualification, editable benefits and presentation, annual reset settings, optional tier maintenance spend, and member profile fields (`name`, `phone`, `address`, `birthDate`) plus merchant-scoped tags. Member-owned profile fields are editable by that member and readable only through the installation's authenticated Merchant Customer 360; tags are managed by that Merchant. No profile details appear in public storefronts.
- Preserve the seven-day Merchant overview. Analytics keep the existing paid-at Vietnam-time semantics: count `PAID` and `REFUND_PENDING`, show `REFUNDED` separately, and label the measure without calling it net revenue. Keep the current analytics filters and day/month resolution; do not add export, drilldown, source, branch, payment-method filters, cost, or profit.
- Keep points-for-voucher redemption and current catalog/inventory. Defer promo/campaign, merchant/POS order entry, partial refunds, merchant-initiated cancellation, barcodes, variants, cost, and oversell behavior.
- Provisional U05 idempotency assumption for owner review: a request key is scoped to member+merchant and retained for the created order's lifetime; replaying the same key and payload returns the same order, while a different payload for the same key returns `409`.
- Add forward-only migration(s) that remove obsolete platform/VNPay schema and preserve existing order, refund, and ledger history. Never edit applied migrations; runtime verification uses only the dedicated local test database.

## Acceptance evidence

- Source and docs contain no active Admin/application or VNPay routes and no platform commission client/model dependencies.
- Mock payment still calls the existing order settlement implementation; merchant refund review remains merchant-authoritative and idempotent.
- Merchant loyalty configuration accepts a variable number of tiers, protects the default tier, persists qualification mode and tier display/benefit fields, and resets tier qualification progress without changing the redeemable wallet balance.
- Annual tier reset is idempotent by merchant and cycle year, supports one-tier-down or a selected target, preserves wallet points, and can retain a tier when its configured maintenance spend is met.
- Member profile API/UI permits only the signed-in member to edit their own named profile fields; merchant tags are merchant-installation scoped; merchant Customer 360 only reveals profile data for that installation's existing membership; public storefronts reveal none of those fields.
- Checkout request idempotency matches the provisional member+merchant/key contract above; payment remains Mock and continues to settle inventory, voucher, loyalty, tier, challenge, and refund effects.
- Bootstrap validates owner configuration, is safe to rerun, and refuses an installation containing a conflicting Merchant root.
- Prisma schema and additive/forward-only SQL migration agree; the U01–U09 runtime matrix records actual UI, API, and persisted state plus alternates and deliberate CNV deviations.
- Keep the UC follow-up as a draft stacked on the single-merchant foundation PR. After foundation PR #1 is reviewed and merged to `main`, retarget the follow-up to `main`; request independent PR Reviewer review and recheck before any merge.

## Owner decisions and implementation calls

| Decision | Approved behavior | Implementation call to verify |
| --- | --- | --- |
| Tier basis and reset | Dynamic tiers; choose points or paid spend; configured annual date; reset one tier down or to a selected tier; reset qualification progress to the target while preserving redeemable points; optional maintenance spend by tier. | Default tier is permanent and first. Reset runs atomically once per merchant/year. A selected target never promotes a member above their current tier. February 29 reset runs on February 28 in non-leap years. |
| Member profile | Add name, phone, address, birth date, and tags. | Member edits name/phone/address/birth date on their own profile. Tags belong to this installation's membership and are edited by its Merchant. Merchant reads profile fields only on its authenticated Customer 360; public pages never expose them. |
| U05 duplicate submit | Keep the member checkout flow and Mock payment. | Provisional member+merchant-scoped idempotency key, same-payload replay returns same order, changed payload returns `409`, key lifetime equals the order lifetime. Owner review remains open. |
| Dashboard/reporting | Seven-day dashboard; paidAt in Vietnam time; `PAID` + `REFUND_PENDING`, `REFUNDED` separate; current filters/resolution. | KPI labels describe paid/pending/refunded amounts and never call a measure “net revenue”. |

## CNV guide cross-check and implementation validation

The external audit notes in `D:\.Learn\IncomSG-docs\usecases` were read in place and not copied into this repository. Current public CNV URLs for U01–U09 were reopened on 2026-11-23. Their merchant/POS flows are comparison references; approved IncomSG behavior and deliberate deviations are recorded in [the U01–U09 validation matrix](../verification/2026-11-23-uc-flow-matrix.md).

**Environment checkpoint:** the backend datasource was verified in memory as `127.0.0.1:3306/incomsg_testdb_cf91d4bc9614`; `apps/backend/.env` is ignored. The dedicated DB has 28 migrations applied/up to date and the bootstrap seed completed and reran. `GET /api/health/db` returned HTTP 200/status `ok`. No shared DB access occurred.

**Code checks:** root `npm run typecheck` and `npm run build` passed. Backend unit tests passed 79/79 and backend integration tests passed 80/80 against the dedicated DB. The complete frontend suite passed 172/172 across 28 files when invoked with the repository-local Vitest binary. `npm run test:db` could not launch because the nested npm command resolved the broken machine-wide npm CLI; equivalent migration/generate/tsx steps ran using worktree-local binaries. Full runtime flow details, alternates, and exact test outcomes are in the validation matrix.
