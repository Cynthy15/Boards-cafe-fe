# Café workflow: API coverage and required backend work

This document describes the staff workflow requested for Boards Café. The frontend only uses real API records and does not create a generic or browser-only transaction register.

## Workflow now supported by the published API

| Workflow | Frontend behavior | API resource |
| --- | --- | --- |
| Admin creates staff | Creates an account with an active role and optional direct permission grants | `POST /auth/` |
| Admin manages staff | Lists, edits name/phone/role/direct permissions, deactivates, and reactivates staff | `GET/PATCH/DELETE /auth/{id}/`, `POST /auth/{id}/activate/` |
| Admin changes staff credentials | Changes email or resets a temporary password | `PATCH /auth/{id}/email/`, `POST /auth/{id}/password/reset/` |
| Admin creates roles | Creates and edits named roles with permission IDs returned by the live permission catalogue | `GET/POST/PATCH /roles/` |
| Admin manages roles | Activates, deactivates, or deletes eligible roles | `POST /roles/{id}/activate/`, `POST /roles/{id}/deactivate/`, `DELETE /roles/{id}/` |
| Waiter order handoff | Creates or edits a table-bound draft order, then submits it to become pending for payment | `POST/PATCH /sales/orders/`, `POST /sales/orders/{id}/submit/` |
| Available dine-in tables | Lists only tables the authenticated waiter can select, including active-order and waiter assignment information | `GET /business/{business_id}/tables/available/` |
| Cashier payment confirmation | Lists pending submitted orders and records one completed payment against the selected order | `GET /sales/orders/`, `POST /finance/payments/` |
| Storekeeper purchase and receiving | Creates/submits a purchase order and records a receipt when goods arrive | `POST /purchasing/purchases/`, `POST /purchasing/purchases/{id}/submit/`, `POST /purchasing/purchases/{id}/receive/` |
| Purchased stock increase | The backend increases stock when a purchase receipt is recorded | Built into `POST /purchasing/purchases/{id}/receive/` |
| Sale stock update | Completed-payment responses return stock movement IDs and updated stock information | `POST /finance/payments/` |
| Production start and completion | Starts an in-progress run with raw-material input/waste, then completes it to add finished-product stock | `GET/POST /production-runs/`, `PATCH /production-runs/{id}/` |
| Finished-product stock | Shows product quantities and production/sale movements; records an auditable physical count when authorised | `/production-runs/product-stock-balances/`, `/production-runs/product-stock-movements/`, `POST /inventory/product-stock-adjustments/` |
| Reporting | Dashboard and reports reload their server data after successful API writes | `/dashboard/` and `/reports/*` |

The API already exposes a role and permission catalogue. The UI does not hard-code permission names: the administrator selects the records returned by `GET /roles/permissions/`.

## Required role setup

Create these role records through the Roles & Permissions screen, selecting the appropriate API permission records:

| Role | Intended responsibility |
| --- | --- |
| Admin | Every available permission: users, roles, configuration, menu, inventory, purchasing, finance, sales, and reports. |
| Cashier | View orders and reports; create customer payments for submitted orders; view completed sales and receipts. |
| Waiter | Create, update, submit, and view only their own draft/pending orders; view menu items and available tables. |
| Storekeeper | Full inventory and supplier/purchase access, including receiving; view sales and orders, but no customer-payment or staff-management rights. |

The backend, not the browser, must enforce every permission. The browser can hide an unavailable action for a clearer experience, but that is not a security boundary.

## Server behavior to verify before release

### 1. Table state integrity

The published contract now exposes `/business/{business_id}/tables/available/` and returns table availability, the assigned waiter, and the active order. The frontend uses that endpoint for the dine-in selector. Confirm with an authenticated integration test that a dine-in order atomically locks the table, rejects a conflicting waiter, and releases the table only after the order is paid, cancelled, or voided.

### 2. Verify finished-product inventory reduction on a sale

Purchase receipt correctly increases raw-material stock. Production now creates finished-product balances, and completed-payment responses return `product_stock_movement_ids` and `product_stock_updates`. Validate the following behavior with an authenticated integration test before release:

1. On purchase receipt, create positive receipt movements (already reflected in balances).
2. On production start, deduct the raw input once; on production completion, add the finished output once.
3. On payment completion, deduct the sold finished product exactly once and do not allow finished-product balances to become silently negative.
4. On an order cancellation, void, or refund, create the compensating movement according to whether preparation had started. Never edit a historic movement in place.
5. Return the resulting stock movement IDs and updated product-stock information in the response.

Recommended resources:

- `GET /inventory/movements/` with filters for item, source document, type, and date;
- `GET /production-runs/product-stock-movements/` for the finished-product ledger; and
- read-only finished-product balances for menu products.

### 3. Payment exceptions

Payments are immutable, which is correct. Add explicit server-side actions rather than edits:

- refund/void a payment with reason, approving staff member, and a linked compensating financial record;
- support partial payments if the business accepts them, returning `amount_paid`, `balance_due`, and payment status on each order;


### 4. Server-side role enforcement and visibility

The permission catalogue must include (and every relevant endpoint must enforce) permissions for orders, payments, reports, purchasing, stock receiving, stock adjustments, and configuration. The backend should ensure:

- waiters can only read and change their own draft orders, while cashier/admin can see submitted orders;
- cashiers can create payments only for pending orders;
- storekeepers can receive stock but cannot modify customer payments or staff;
- administrators cannot deactivate themselves or the final active administrator; and
- every sensitive action creates an audit event with actor, timestamp, before/after values, source document, and reason where required.

### 6. Other API resources intentionally not simulated by the frontend

The frontend keeps these screens read-only/unavailable until corresponding server resources are documented, rather than storing data in the browser:

- customer CRUD, customer balances, and customer order history;
- e-commerce settings and checkout/catalogue configuration;
- quotations with lines, expiry, conversion to order, and status history;
- asset lifecycle/depreciation and inter-location stock transfers; and
- a documented services/add-ons contract when those are distinct from stock-controlled menu products.

## Recommended workflow safeguards

- Low-stock thresholds and reorder suggestions per inventory item, using supplier and lead-time information.
- Batch number and expiry-date alerts for received items, plus first-expiry-first-out consumption where relevant.
- Kitchen/bar preparation statuses (`new`, `accepted`, `in_progress`, `ready`, `served`) and a kitchen-display endpoint. These are separate from payment status.
- An order hold/void/reopen policy that requires a reason and manager approval after submission.
- Idempotency keys on payment, receipt, and stock-movement writes so a retry cannot charge or receive stock twice.
- A daily close report that reconciles payments, refunds, purchase receipts, expenses, stock adjustments, and cashier shifts.
- Pagination, date filters, and business/location scoping on all list and report endpoints.
