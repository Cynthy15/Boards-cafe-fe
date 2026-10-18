# Backend integration status

This list comes from the frontend integration review against the deployed OpenAPI
schema on 17 October 2026. The frontend uses only documented requests and does not
fake financial or stock-changing operations.

## Production recording — now integrated

The published API now provides `GET/POST /api/v1/production-runs/` and
`GET/PATCH /api/v1/production-runs/{id}/`, plus finished-product stock through:

- `GET /api/v1/production-runs/product-stock-balances/`
- `GET /api/v1/production-runs/product-stock-movements/`

The frontend creates a run only with status `in_progress`, sending `recipe`,
`output_quantity`, `inputs`, and an `idempotency_key`. Each input uses
`inventory_item`, `input_quantity`, and `waste_quantity`; input quantity already
includes the waste, so waste is never deducted twice. The server validates and
deducts raw materials when the run starts. The frontend then completes the same
run with `PATCH` and `status: done`, which adds output to finished-product stock.

The page also displays the returned run history and finished-product balances.
The `cancel` endpoint remains available for an in-progress run if the business
later wants that action exposed in the interface.

## Table API simplification

The frontend now presents a Tables screen with only **Table name / number**,
**Table seats**, and **Availability**. It uses the published floor-free table API:

- `GET/POST /api/v1/business/{business_id}/tables/`
- `GET/PATCH/DELETE /api/v1/business/{business_id}/tables/{id}/`

The frontend no longer creates a floor or sends a floor ID when creating or editing
a table. Floors remain an internal compatibility detail for historic records.

## Dine-in table assignment and availability

The order form now gets its choices from the published authenticated endpoint
`GET /api/v1/business/{business_id}/tables/available/`. It no longer guesses table
availability from client-side order data.

When a signed-in server creates or changes a dine-in order with `table`, the API
must, in one database transaction:

1. lock the table and confirm that it belongs to the active business and is marked
   available;
2. reject the request with `409 Conflict` when a different unsettled dine-in order
   already holds that table;
3. persist the server identity from the authenticated user (do not accept an
   arbitrary waiter/server ID from the browser) alongside the table assignment;
4. keep the assignment from draft through submitted/pending payment; and
5. release the table only when the corresponding payment is successfully recorded
   and the order becomes `paid`, or when the order is cancelled/voided.

Order responses now publish `table`, `table_name`, `table_number`,
`table_availability`, `assigned_server`, and the server email. The available-table
response also returns the assigned waiter and active order, allowing the backend to
remain the source of truth when a client has stale data.

## Sales and inventory

The API now publishes finished-product stock balances and payment response fields
for `product_stock_movement_ids` and `product_stock_updates`. The frontend still
uses the required order → submit → payment lifecycle and relies on the payment
transaction to apply the server-side stock change exactly once.

## Manual finished-product quantity adjustment — now integrated

The live API now provides `POST /api/v1/inventory/product-stock-adjustments/`.
The Products screen uses it to record a physical count, with `product`,
`counted_quantity`, `reason`, and a new `idempotency_key` for every submission.
The API writes an immutable movement and rejects a resulting negative balance.

The product quantity remains a derived stock balance: production completion and
paid sales update it automatically, while a manual correction is always an
auditable adjustment rather than a writable field on the product.

## Purchasing and inventory

`POST /api/v1/purchasing/purchases/{id}/receive/` is already the correct inventory
operation: its deployed contract says it increases stock balances. The frontend now
sends an idempotency key when receiving all outstanding items. Keep receiving
idempotent and atomic, and return the updated purchase/stock data so clients can
refresh immediately.

## Registration endpoint

The existing endpoint is correct for staff registration:

- `POST /api/v1/auth/`
- authenticated caller with `users.create`
- payload: `email`, `password`, `password_confirm`, plus optional `full_name`,
  `phone`, `role_name`, `permission_ids`, and `is_active`

It is intentionally not public sign-up. The frontend now submits only optional role
or direct-permission fields when the signed-in administrator has the corresponding
`users.assign_role` or `roles.assign_permissions` permission. Add an integration
test for successful creation, duplicate email, mismatched passwords, insufficient
permissions, and role/direct-permission assignment.

## Permission contract

`GET /api/v1/auth/me/` already returns the effective `permissions` array and the
frontend uses it to hide protected management links and actions. Keep it complete
and current after role changes. Seed/document these feature permissions where they
do not yet exist: `sales.view`, `sales.create`, `purchasing.view`,
`purchasing.create`, `finance.view`, `contacts.view`, `reports.view`,
`production.view`, and `production.create`.

All matching API endpoints must continue to enforce permissions server-side; hiding
a client control is usability protection, not authorization.
