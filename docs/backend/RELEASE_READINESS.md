# Installation Readiness

## Current application model

Each application instance uses a dedicated MySQL database for one merchant. The singleton `Merchant` row is the installation root and is configured with `MERCHANT_NAME` and `MERCHANT_SLUG`. Member identities and their purchase and loyalty history remain in that database.

The merchant owner is provisioned by `npm run db:seed -w apps/backend` using `MERCHANT_OWNER_EMAIL` and `MERCHANT_OWNER_PASSWORD`. The bootstrap refuses a conflicting owner or a database containing more than one merchant. Member registration remains available through the public storefront and `/api/auth/register/member`.

## Commerce behavior

Order creation, stock reservation, Mock settlement, voucher handling, loyalty earning, tier promotion, challenge progress, and merchant-final refund review remain backend-controlled. Refund completion is synthetic: it records a completed order refund and the related loyalty, voucher, and challenge effects; it does not move funds through a payment provider.

The order and refund history fields retain historical statuses and audit details where needed to read existing data. Unresolved legacy `PENDING_ADMIN` refund requests are moved back to `PENDING_MERCHANT` for a fresh merchant decision by the forward migration. Old admin and merchant-application tables, provider attempts, platform commission records, and unconfirmed point reservations are removed by that migration.

## Installation steps

1. Provision a fresh MySQL database for the merchant installation and place its URL in `DATABASE_URL`.
2. Supply the owner and store configuration through deployment secrets or a local ignored `.env` file.
3. Install dependencies, apply migrations, and run the idempotent bootstrap from the repository root.
4. Start the API and frontend; register members through the UI.

Do not run these migrations against the existing shared database. Partitioning shared data into per-merchant databases is a separate operational migration and must preserve each merchant's order, refund, member, and ledger history.

## Validation status for this change

No database commands, database tests, or browser flows were run while preparing this change. Automated checks and PR checks must be reviewed before merge. The current worktree includes a forward-only Prisma migration and updated schema; the migration has not been applied to any database.
