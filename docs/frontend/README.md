# IncomSG Frontend

React, TypeScript, Vite, Tailwind CSS, Radix UI, and React Router power the merchant CMS, member storefront, and authenticated member account flows. Each running app connects to the backend and database for one merchant installation.

## Experiences

| Role | Features |
| --- | --- |
| Merchant owner | Storefront CMS, catalog and inventory, orders, loyalty settings, events, challenges, analytics, and member refund review. |
| Member | Public storefront, member registration, checkout, Mock payment, order history, wallet, vouchers, rewards, and challenges. |

Payment and loyalty outcomes come from backend responses. Mock refunds complete synthetically and update order, wallet, voucher, and challenge records without moving real money.

## Local development

Use Node.js 22.12 or newer and create `apps/frontend/.env` from [.env.example](../../apps/frontend/.env.example). Set `VITE_API_BASE_URL` to the backend URL and `VITE_API_MODE=http` for the installation-backed app.

From the repository root:

```sh
npm ci
npm run dev:frontend
```

Open `http://localhost:5173`. A merchant owner account is provisioned by the backend installation bootstrap; members register through the app.

## Source map

- [src/app](../../apps/frontend/src/app) and [src/layouts](../../apps/frontend/src/layouts) define routes and navigation.
- [src/features](../../apps/frontend/src/features) contains merchant, member, storefront, and authentication experiences.
- [src/api](../../apps/frontend/src/api) contains backend clients and API contracts.
- [tests/frontend](../../tests/frontend) contains unit and browser test sources.
