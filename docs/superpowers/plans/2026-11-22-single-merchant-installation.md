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
- Add forward-only migration(s) that remove obsolete platform/VNPay schema and preserve existing order, refund, and ledger history. Do not run database commands or edit applied migrations.

## Acceptance evidence

- Source and docs contain no active Admin/application or VNPay routes and no platform commission client/model dependencies.
- Mock payment still calls the existing order settlement implementation; merchant refund review remains merchant-authoritative and idempotent.
- Bootstrap validates owner configuration, is safe to rerun, and refuses an installation containing a conflicting Merchant root.
- Prisma schema and additive/forward-only SQL migration agree; no tests or database commands run unless a repository acceptance check explicitly requires them.
- Open a PR targeting `main`; inspect PR checks and review feedback, then request independent PR Reviewer review only after the affected-flow checks. Do not merge before review and recheck.

## CNV guide cross-check (source-level, 2026-11-22)

Read the corresponding external audit notes under `D:\.Learn\IncomSG-docs\usecases` without copying or editing them. Re-opened the current public CNV pages below on 2026-11-22. CNV's merchant/POS steps are references only; they are not IncomSG policies.

| Guide and actor/starting state | Steps and source-level expected vs. actual behavior | Alternate branches and evidence | Result |
| --- | --- | --- | --- |
| [U01 Dashboard](https://huongdan.cnvloyalty.com/tinh-nang/tong-quan) · CNV merchant/operator on the overview. IncomSG actor: signed-in active `MERCHANT` owner with a singleton installation Merchant. | CNV opens overview and can follow “Xem báo cáo”. IncomSG `/merchant` remains behind `RequireRole("MERCHANT")`; `MerchantOverview` reads own store, products, and merchant orders and renders the revenue chart. Platform-admin dashboard/routes are removed. | Missing store shows an empty state; request errors show retry. Existing dashboard is an overview of saved store/product/order responses, not CNV's full profitability dashboard. Definitions: `apps/frontend/src/app/App.tsx`, `BackendMerchantOverviewPage.tsx`, `apps/backend/src/modules/merchants/profile/merchant.routes.ts`, `apps/backend/src/modules/commerce/orders/orders.routes.ts`. No browser or persisted-state observation was made. | Source mapping: pass. Runtime: blocked/unverified. |
| [U05 Create order](https://huongdan.cnvloyalty.com/tinh-nang/don-hang/tat-ca-don-hang/tao-don-hang) · CNV merchant/admin creates an order for a customer. IncomSG actor: signed-in local `MEMBER`, active same-store products, cart ready. | CNV selects channel/customer/products/discount/payment. Deliberate actor/workflow deviation: IncomSG member self-checkout creates a backend `PENDING` order, then member chooses Mock payment; successful persisted response is `PAID` with `paidAt`, consumed inventory/voucher, loyalty ledger/tier and challenge processing. No shipping or real provider payment is used. | Invalid/mixed-store products or unavailable inventory/voucher are backend-rejected; expired reservation cancels/releases holds; duplicate payment is not settled again. Existing definitions: `tests/backend/integration/milestone-3.integration.test.ts` (owner/pay) and `milestone-3-4-lifecycle-refund.integration.test.ts` (reservation/voucher); runtime DB state not observed. | Source mapping: pass. Runtime: blocked/unverified. |
| [U06 Cancel order](https://huongdan.cnvloyalty.com/tinh-nang/don-hang/tat-ca-don-hang/huy-don-hang) · CNV merchant cancels from all-orders, specifies reason/returns and may refund money. IncomSG actor: member has a `PAID` order and submitted a refund request; merchant owner reviews it. | Deliberate deviation: IncomSG preserves the request → merchant approve/reject path, not CNV's cancel/partial-money-return workflow. Approval writes `OrderRefund.COMPLETED`, order `REFUNDED`, reverses order points/challenge effects and restores eligible voucher in one transaction; it is synthetic and transfers no money. Rejection leaves order `PAID`, records merchant reason, and makes no refund/ledger reversal. | Wrong merchant cannot preview/decide; unpaid or duplicate requests are rejected; duplicate approval is idempotent; exact reversal/debt/tier/voucher behavior has integration test definitions in `tests/backend/integration/milestone-3-4-lifecycle-refund.integration.test.ts` and challenge refund gate in `v4-challenges-and-refunds.integration.test.ts`. `refunds.complete.ts` is the persisted-state implementation. No database/browser result was observed. | Source mapping: pass. Runtime: blocked/unverified. |
| [U07 Add product](https://huongdan.cnvloyalty.com/tinh-nang/san-pham/them-san-pham) · CNV merchant creates product and stock. IncomSG actor: signed-in merchant owner. | The guide's product/catalog/inventory context maps to the preserved merchant CMS at `/merchant/products` and `/merchant/inventory/:kind/:id`; API endpoints are merchant-role guarded and inventory operations record movements. No barcode, variants, shipping or untracked-stock parity is inferred. | Test definitions include the `merchant manages its own catalog` integration case, `v4-storefront.integration.test.ts` initialization/save/publish, and frontend `merchant-cms.test.tsx`. No write was executed, so there is no persisted result. | Source mapping: pass. Runtime: blocked/unverified. |

**Runtime status:** no business flow is claimed as passed. `apps/backend/.env`, `apps/frontend/.env`, `node_modules`, and a dedicated isolated database are absent in this worktree. `npm ci` failed before installing dependencies with `Cannot find module 'C:\\nvm4w\\nodejs\\node_modules\\npm\\bin\\npm-prefix.js'`; no tests, typecheck, app launch, database command, or browser flow ran. The shared database was not accessed.
