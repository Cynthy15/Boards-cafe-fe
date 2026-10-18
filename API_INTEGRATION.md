# Boards Café API integration

The frontend connects to the live OpenAPI v1 service at `https://boards-cafe-api.onrender.com/api/v1` by default. Override it with `NEXT_PUBLIC_API_BASE_URL` when deploying against another environment. The published schema at `/api/v1/schema/` was rechecked on 17 October 2026; the client routes and request bodies use that contract.

## Session handling

- Sign-in posts `{ email, password }` to `POST /auth/login/`.
- The client reads the API's `{ success, message, data }` envelope, stores both JWT tokens, then gets the signed-in profile from `GET /auth/me/`.
- An expired access token is refreshed once through `POST /auth/token/refresh/` and the rotated refresh token is persisted.
- Logging out calls `POST /auth/token/blacklist/` when possible and removes both tokens locally.

## Live screens

These screens read and write live API resources after a user signs in with an account that has the relevant permissions:

- Dashboard summary, recent orders, transaction counts, and top product/expense/supplier breakdowns (the dashboard requests a custom range from 2000-01-01 through today, rather than the API default of today only)
- Business details and receipt preferences
- Tables, through the floor-free business table API
- Payment methods
- Staff accounts and active roles
- Staff account editing, deactivation/reactivation, and direct permission grants
- Role and permission management (roles and available permissions both load from the API)
- Vendors (the API's supplier resource)
- Inventory categories
- Menu products and their menu categories
- Recipes, each linked to one menu product and one or more inventory items
- Draft orders, including server-provided available tables, service type, guest count, and optional customer reference
- Completed sales: the sales screen creates an order, submits it, and records a completed payment; the table lists completed API-backed sales only
- Purchases: the purchases screen loads active suppliers and inventory items, creates or updates a draft purchase order, submits it, and records received stock through the API
- Expenses and expense categories (a new category is created through the API when its name has not been used before)
- Production runs, including raw-material input and waste, in-progress runs, completion, and finished-product inventory balances
- Auditable finished-product stock corrections from Products, using `POST /inventory/product-stock-adjustments/`
- Reports overview, sales report, and operations report (backed by the sales, expenses, purchases, and inventory report endpoints)

## Server-owned reporting contract

The reporting views do not derive financial totals from paginated orders, purchases,
or stock movements. Once the matching API deployment is available, they request one
authoritative report per screen, always scoped to the signed-in business and with an
`Africa/Kigali` reporting timezone:

- Daily summary: `GET /reports/daily-summary/`
- Sales performance: `GET /reports/sales/` (the existing route remains supported)
- Inventory reorder and movement history: `GET /reports/inventory/reorder/` and
  `GET /reports/inventory/movements/`
- Production and waste: `GET /reports/production/`
- Purchasing and suppliers: `GET /reports/purchases/` (the existing route remains
  supported) or `GET /reports/purchasing-suppliers/`
- True P&L: `GET /reports/profit-loss/`
- Audit and fiscal/EBM compliance: `GET /reports/audit/` and
  `GET /reports/tax-compliance/`

The P&L view deliberately displays the backend's recognized COGS rather than using
purchase commitments as an expense. It also shows the backend-selected valuation
method and any report warnings without recalculating those figures in the browser.
The client honors a `Retry-After` response header when it retries a throttled report
request.

## Transaction and dashboard flow

- A completed sale follows the API's required lifecycle: `POST /sales/orders/`, `POST /sales/orders/{id}/submit/`, then `POST /finance/payments/`. The API derives the completed payment and paid-order status; the browser does not send a status field that is absent from the published payment request.
- A purchase follows the API's required lifecycle: `POST /purchasing/purchases/`, `POST /purchasing/purchases/{id}/submit/`, then `POST /purchasing/purchases/{id}/receive/` when stock arrives.
- An expense is created, edited, or deleted with the `/finance/expenses/` resource. Categories use `/finance/expense-categories/`.
- Recipes are created through `POST /recipes/`, followed by documented `POST /recipes/{recipe_pk}/ingredients/` calls for each inventory-item ingredient. Production may select several recipes, but submits one documented `POST /production-runs/` request per selected recipe because a production run accepts exactly one recipe. The screen checks combined raw-material demand before starting any run.
- A production run starts with `POST /production-runs/` and status `in_progress`. The form sends `input_quantity` and `waste_quantity` for each raw material with an idempotency key. `PATCH /production-runs/{id}/` with `status: done` adds the finished-product output exactly once; the page then reloads product stock from `/production-runs/product-stock-balances/`. Products display that same finished-product quantity through `/inventory/product-stock-balances/`. A physical stock count is recorded separately through `POST /inventory/product-stock-adjustments/`, with a reason and idempotency key, so it remains auditable.
- Dine-in table choices come from `GET /business/{business_id}/tables/available/`. The backend supplies the assigned waiter and active order details, while order creation remains the authoritative table-lock operation.
- Every successful non-auth API write emits a client-side refresh event. The dashboard reloads `GET /dashboard/`, recent orders, and the sales/expense/purchase reports when it receives that event or regains focus, so its totals and breakdowns remain server-sourced.
- The dashboard endpoint defaults to the current day. The interface explicitly sends `period=custom`, `date_from=2000-01-01`, and today as `date_to`; its report requests use the same date range.
- Every request has a 15-second timeout, requests JSON explicitly, and API outages are shown as an error rather than leaving an API-backed screen indefinitely loading. Expected API validation and conflict responses use the service's documented error message in the form where they occur.

The shared client in `lib/api-client.ts` also exposes business configuration, payments, raw and finished-product stock balances, purchases, recipes, reports, roles, and order receipts.

## Unsupported user-interface areas

The published schema has no customer/CRM, quotations, asset, stock-transfer, or e-commerce endpoint. Those screens deliberately do not create browser-only records or map to guessed API routes.

## Workflow requirements

[`WORKFLOW_BACKEND_REQUIREMENTS.md`](./WORKFLOW_BACKEND_REQUIREMENTS.md) records the supported workflow and the intentionally unavailable domain resources. Sale stock consumption, production completion, and table locking remain server-side behaviors to verify with a real account before release.

## Verification

The project lints and type-checks successfully. Exercising live protected-resource reads and create/update/delete operations requires a Boards Café API account with the relevant permissions.

## Run locally

1. Set `NEXT_PUBLIC_API_BASE_URL=https://boards-cafe-api.onrender.com/api/v1` in `.env.local` only if you want to override the default.
2. Run `npm install` and `npm run dev`.
3. Open `http://localhost:3000` and sign in with a Boards Café API account.
