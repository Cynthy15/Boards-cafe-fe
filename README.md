# BOARDS Cafe frontend

Next.js frontend for the Boards Cafe workspace.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local`.
3. Run `npm install`.
4. Run `npm run dev` and open http://localhost:3000.

## API connection

The sign-in form authenticates against `POST /api/v1/auth/login/` on the Boards Cafe API. The API base URL is configured by `NEXT_PUBLIC_API_BASE_URL` and defaults to `https://boards-cafe-api.onrender.com/api/v1`. Access and refresh tokens are stored in browser local storage, attached as Bearer credentials by `apiRequest`, and refreshed once automatically when the access token expires.

The dashboard, business settings, floors/tables, payment methods, staff accounts, vendors/suppliers, inventory categories, menu products, orders, completed sales, and expenses use the live API. Creating a sale submits an order and records its payment; creating or changing either transaction refreshes dashboard data from the backend. See `API_INTEGRATION.md` for the endpoint mapping and the interface areas that have no matching backend resource.
