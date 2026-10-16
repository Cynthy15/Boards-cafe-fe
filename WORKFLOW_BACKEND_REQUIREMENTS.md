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
| Cashier payment confirmation | Lists pending submitted orders and records one completed payment against the selected order | `GET /sales/orders/`, `POST /finance/payments/` |
| Cashier shift opening | Lists existing drawer shifts and opens a new shift | `GET/POST /finance/cash-shifts/` |
| Storekeeper purchase and receiving | Creates/submits a purchase order and records a receipt when goods arrive | `POST /purchasing/purchases/`, `POST /purchasing/purchases/{id}/submit/`, `POST /purchasing/purchases/{id}/receive/` |
| Purchased stock increase | The backend increases stock when a purchase receipt is recorded | Built into `POST /purchasing/purchases/{id}/receive/` |
| Sale stock update | Completed-payment responses return stock movement IDs and updated stock information | `POST /finance/payments/` |
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

## Backend changes required before the full requested workflow is possible

### 1. Table state integrity

The current order request and response already carry `table`, `service_type`, `guest_count`, and `customer_id`; the frontend sends and displays those API fields. The published contract does not describe the table state transition rules, so the backend must enforce them atomically: mark a table occupied when a dine-in order is opened, prevent conflicting active orders according to business policy, and release it only when the final active order is settled or cancelled. Return the updated table status on every affected order/table response so waiters and cashiers see the same source of truth.

### 2. Verify inventory reduction on a sale

Purchase receipt correctly increases stock. The current completed-payment response also returns `stock_movement_ids` and `stock_updates`, so inventory consumption belongs on the backend and must not be duplicated in the browser. Validate the following behavior with an authenticated integration test before release:

1. On purchase receipt, create positive receipt movements (already reflected in balances).
2. On payment completion, resolve each sold menu product's active recipe and create negative consumption movements for every ingredient.
3. Reject payment or flag the order for approval if the policy disallows insufficient stock. Do not allow balances to become silently negative.
4. On an order cancellation, void, or refund, create the compensating movement according to whether preparation had started. Never edit a historic movement in place.
5. Return the resulting stock movement IDs and updated availability in the response (these fields are already present in the published payment response).

Recommended resources:

- `GET /inventory/movements/` with filters for item, source document, type, and date;
- an admin-only approved adjustment/count endpoint; and
- read-only `available_to_sell` values for menu products.

### 3. Cash-shift closure contract

Cash-shift listing and opening are available. The published `POST /finance/cash-shifts/{id}/close/` request, however, currently accepts only `opening_float` and `notes`; it cannot carry the cash count needed to calculate the variance. The UI therefore allows opening a shift but deliberately does not pretend to close one.

Change the close request to require a decimal `counted_cash` field, with optional notes. The server should then calculate `expected_cash` and `variance`, move the shift to `pending_approval`, and return those values. The existing approve-close action can then move it to `closed` with an approval audit record.

### 4. Payment exceptions

Payments are immutable, which is correct. Add explicit server-side actions rather than edits:

- refund/void a payment with reason, approving staff member, and a linked compensating financial record;
- support partial payments if the business accepts them, returning `amount_paid`, `balance_due`, and payment status on each order;


### 5. Server-side role enforcement and visibility

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
- production runs with input consumption, output/waste, batches, and stock movements;
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
