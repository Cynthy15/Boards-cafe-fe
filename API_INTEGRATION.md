# Boards Café API integration

The frontend connects to the live OpenAPI v1 service at `https://boards-cafe-api.onrender.com/api/v1` by default. Override it with `NEXT_PUBLIC_API_BASE_URL` when deploying against another environment.

## Session handling

- Sign-in posts `{ email, password }` to `POST /auth/login/`.
- The client reads the API's `{ success, message, data }` envelope, stores both JWT tokens, then gets the signed-in profile from `GET /auth/me/`.
- An expired access token is refreshed once through `POST /auth/token/refresh/` and the rotated refresh token is persisted.
- Logging out calls `POST /auth/token/blacklist/` when possible and removes both tokens locally.

## Live screens

These screens read and write live API resources after a user signs in with an account that has the relevant permissions:

- Dashboard summary, recent orders, transaction counts, and top product/expense/supplier breakdowns (the dashboard requests a custom range from 2000-01-01 through today, rather than the API default of today only)
- Business details and receipt preferences
- Floors, including their newly created tables
- Payment methods
- Staff accounts and active roles
- Staff account editing, deactivation/reactivation, and direct permission grants
- Role and permission management (roles and available permissions both load from the API)
- Vendors (the API's supplier resource)
- Inventory categories
- Menu products and their menu categories
- Draft orders, including table, service type, guest count, and optional customer reference
- Completed sales: the sales screen creates an order, submits it, and records a completed payment; the table lists completed API-backed sales only
- Purchases: the purchases screen loads active suppliers and inventory items, creates or updates a draft purchase order, submits it, and records received stock through the API
- Expenses and expense categories (a new category is created through the API when its name has not been used before)
- Cash shifts (lists existing shifts and opens a cashier shift through the finance API)
- Reports overview, sales report, and operations report (backed by the sales, expenses, purchases, and inventory report endpoints)

## Transaction and dashboard flow

- A completed sale follows the API's required lifecycle: `POST /sales/orders/`, `POST /sales/orders/{id}/submit/`, then `POST /finance/payments/` with `status: "completed"`.
- A purchase follows the API's required lifecycle: `POST /purchasing/purchases/`, `POST /purchasing/purchases/{id}/submit/`, then `POST /purchasing/purchases/{id}/receive/` when stock arrives.
- An expense is created, edited, or deleted with the `/finance/expenses/` resource. Categories use `/finance/expense-categories/`.
- Every successful non-auth API write emits a client-side refresh event. The dashboard reloads `GET /dashboard/`, recent orders, and the sales/expense/purchase reports when it receives that event or regains focus, so its totals and breakdowns remain server-sourced.
- The dashboard endpoint defaults to the current day. The interface explicitly sends `period=custom`, `date_from=2000-01-01`, and today as `date_to`; its report requests use the same date range.
- Every request has a 15-second timeout. API outages are shown as an error rather than leaving an API-backed screen indefinitely loading.

The shared client in `lib/api-client.ts` also exposes the remaining documented resources: business configuration, tables, payments, stock items and units, purchases, recipes, reports, roles, and order receipts.

## Unsupported user-interface areas

The published schema has no customer/CRM, quotations, production-run, asset, stock-transfer, or e-commerce endpoint. Those screens deliberately do not create browser-only records; each identifies the missing backend resource instead of mapping to a guessed API route. Cash shifts are available for listing and opening, but cash close cannot be enabled until the close request includes a counted-cash amount.

## Workflow requirements

[`WORKFLOW_BACKEND_REQUIREMENTS.md`](./WORKFLOW_BACKEND_REQUIREMENTS.md) distinguishes workflows the published API already supports from the remaining backend work: table-state enforcement, cash-shift closure, unavailable domain resources, and enforced role visibility. It also identifies sale stock consumption as a server-side behavior to verify with a real account.

## Verification

The project lints and type-checks successfully. Exercising live protected-resource reads and create/update/delete operations requires a Boards Café API account with the relevant permissions.

## Run locally

1. Set `NEXT_PUBLIC_API_BASE_URL=https://boards-cafe-api.onrender.com/api/v1` in `.env.local` only if you want to override the default.
2. Run `npm install` and `npm run dev`.
3. Open `http://localhost:3000` and sign in with a Boards Café API account.
