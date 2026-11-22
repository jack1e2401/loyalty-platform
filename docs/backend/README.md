# IncomSG Backend

The backend serves one merchant installation backed by its own MySQL database. `Merchant` is the installation root that owns the storefront, catalog, orders, loyalty configuration, and refund requests. Member accounts and their order and loyalty history stay local to that installation.

The API uses Express, TypeScript, Prisma, and MySQL. Member registration is public; the merchant owner is provisioned by the installation bootstrap. There is no platform administrator or merchant application workflow.

## Local setup

Use Node.js 22.12 or newer. Create `apps/backend/.env` from [.env.example](../../apps/backend/.env.example), set a unique local database in `DATABASE_URL`, and configure the bootstrap owner, store name, slug, and password from local secrets. Never reuse a shared multi-merchant database for an installation.

From the repository root:

```sh
npm ci
npm run db:migrate -w apps/backend -- --config prisma7.config.ts
npm run db:seed -w apps/backend
npm run dev:backend
```

`db:seed` is an idempotent installation bootstrap. It creates one merchant owner, one `Merchant`, the default storefront, and the baseline loyalty policy. It does not create members, orders, products, or demo data. If the database already contains multiple merchants or a conflicting owner, bootstrap stops without changing roles or records.

The API listens on `http://localhost:3000` by default. Member orders are paid through the backend-authoritative Mock flow; a successful response means the order and its inventory, voucher, points, tier, and challenge effects committed. Mock refunds are synthetic ledger and order updates and do not move real money.

## Database integration checks

`npm run test:db` targets only the local `incomsg-test` database. Create a separate test database and configure `TEST_DATABASE_URL` if needed; never point integration tests at the installation database. The test script applies committed migrations before running integration tests.

## Source map

| Module | Responsibility |
| --- | --- |
| `loyalty` | Loyalty policy, tiers, wallets, ledger, vouchers, and challenges. |
| `commerce` | Catalog, inventory, orders, Mock settlement, and merchant-final refund requests. |
| `merchants` | Merchant profile, storefront, CMS, and events. |
| `reporting` | Merchant sales analytics and customer views. |
| `platform` | Member and merchant-owner authentication, health checks, and media handling. |

Order settlement and Mock refund completion coordinate their business effects inside Prisma transactions. See [schema and migrations](../../apps/backend/prisma) and [the app route registry](../../apps/backend/src/app.ts).
