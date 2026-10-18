# Backend request: complete reporting and true profit/loss for Boards Café

Please add the reporting contracts below to the existing `/api/v1` API. The frontend already uses these working endpoints and must keep using them unchanged:

- `GET /reports/sales/?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`
- `GET /reports/expenses/?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`
- `GET /reports/purchases/?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`
- `GET /reports/inventory/`
- `GET /production-runs/`

The new endpoints must calculate data on the server. Do not ask the browser to calculate financial totals from paginated orders, purchases, or stock movements.

## Rules shared by every report

1. Scope results to the authenticated user’s business. A supplied `business_id` must never let a person read another business. Prefer deriving the business from the membership/session.
2. Require `reports.view` for read access. Add smaller permissions if needed, such as `reports.profit_loss.view`, `reports.audit.view`, and `reports.tax.view`.
3. Support `date_from`, `date_to`, and `timezone` (default `Africa/Kigali`). Reject an end date before the start date. Treat date boundaries correctly in the selected timezone.
4. Return the normal API envelope and a consistent inner shape: `{ period: { date_from, date_to, timezone }, generated_at, ... }`.
5. Use decimals in JSON for money and quantities; never use floating point internally for money. Include the business currency code in every monetary report.
6. Include only business events in their final valid state. Document precisely how drafts, cancelled orders, voids, refunds, partially received purchases, and reversed adjustments affect each total.
7. Paginate detail rows and give large reports stable ordering. Add indexes for the business, event date, status, and foreign keys used by filters.
8. Return a useful `Retry-After` header with `429` responses. The current hosted API throttles bursts, so report aggregation should avoid unnecessary repeated queries.

## 1. Daily summary

Add `GET /reports/daily-summary/`.

It should return one summary per requested range and an optional `group_by=day|week|month` time series. Required fields:

```json
{
  "period": { "date_from": "2026-10-01", "date_to": "2026-10-31", "timezone": "Africa/Kigali" },
  "currency": "RWF",
  "totals": {
    "orders": 0,
    "paid_orders": 0,
    "cancelled_orders": 0,
    "gross_sales": "0.00",
    "discounts": "0.00",
    "refunds": "0.00",
    "net_sales": "0.00",
    "completed_customer_payments": "0.00",
    "recorded_expenses": "0.00",
    "purchase_commitments": "0.00"
  },
  "payments_by_method": [],
  "series": []
}
```

If cash closing/counting is implemented, also return expected cash, counted cash, variance, closer, and a reason for each variance. This application no longer uses a separate shift screen, so cash reconciliation must work without a shift dependency.

## 2. Sales performance

Extend `GET /reports/sales/` or add `GET /reports/sales-performance/` with `group_by=day|week|month|product|category|payment_method|staff|table|order_type`.

Return net/gross sales, paid order count, cancelled/void/refund counts and amounts, average order value, sales by product/category/payment method, and a dated time series for the dashboard graph. Order type must distinguish dine-in, takeaway, and delivery if those exist. Staff/table summaries must only contain historical, completed/paid activity, not active table assignment data.

## 3. Inventory, reorder, valuation, and movement

Keep `GET /reports/inventory/` and add `GET /reports/inventory/reorder/` plus `GET /reports/inventory/movements/` (or equivalent report query parameters).

The reorder response must include raw material and finished product separately, on-hand quantity, unit, minimum level, status, suggested reorder quantity, last purchase cost, average cost, and inventory value. The movement response needs date, actor, source type/id, item/product, signed quantity, unit cost when known, balance after movement, and reason.

Include movements from purchase receipt, production consumption/waste, production completion, paid sale, return, stock count, manual adjustment, and reversal. Never change stock quantity twice if a request is replayed.

## 4. Production and waste report

Add `GET /reports/production/` with date, recipe, output product, status, item/product filters, and pagination.

For every production run return: run id, created/completed timestamp, staff member, recipe, output product, planned input, actual input, declared waste by ingredient, usable input, output quantity, expected output when a recipe defines it, yield percentage, status, and linked stock-movement ids. Summaries should include completed/in-progress/cancelled runs, total input cost, waste cost, output quantity, and yield/variance by recipe and product.

Only a transition from `in_progress` to `done` may add finished-product stock. It must be atomic, idempotent, and reject a second completion. The API must return the final run after the transition.

## 5. Purchasing and suppliers

Extend `GET /reports/purchases/` or add `GET /reports/purchasing-suppliers/` with status, supplier, item, date range, and pagination filters.

Return purchase count/value by supplier and item; draft, ordered, partially received, received, cancelled, and returned counts; ordered versus received quantities/value; purchase cost trend; supplier lead time; and price variance compared with the previous/average purchase cost. Only received quantities should become inventory stock. A void/reversal must reverse related stock and accounting values safely.

## 6. True profit and loss (required)

Add `GET /reports/profit-loss/` with `date_from`, `date_to`, `timezone`, and optional `compare_from`/`compare_to`.

The backend must calculate P&L from its ledger/inventory source of truth. **Do not use total purchases as COGS.** Purchases usually increase stock; COGS is recognized when stock is consumed by a completed sale (or another configured accounting event).

Required response:

```json
{
  "period": { "date_from": "2026-10-01", "date_to": "2026-10-31", "timezone": "Africa/Kigali" },
  "currency": "RWF",
  "revenue": {
    "gross_sales": "0.00",
    "discounts": "0.00",
    "refunds": "0.00",
    "net_sales": "0.00",
    "other_income": "0.00"
  },
  "cost_of_goods_sold": {
    "raw_materials": "0.00",
    "finished_goods": "0.00",
    "production_waste": "0.00",
    "inventory_adjustments": "0.00",
    "total": "0.00",
    "valuation_method": "weighted_average"
  },
  "gross_profit": "0.00",
  "operating_expenses": { "total": "0.00", "by_category": [] },
  "other_expenses": "0.00",
  "taxes": { "sales_tax": "0.00", "income_tax": "0.00", "other": "0.00" },
  "net_profit": "0.00",
  "margins": { "gross_profit_percent": "0.00", "net_profit_percent": "0.00" },
  "warnings": []
}
```

Choose and document a stock-costing method (weighted average or FIFO) per business. Persist cost layers or valuations at the time of each consumption/sale, and keep an auditable journal so historical P&L does not change unexpectedly after a later purchase. State exactly how wastage, giveaways, returns, stock adjustments, service items, tax-inclusive prices, and product recipes are treated.

## 7. Audit trail and tax/EBM compliance

Add `GET /reports/audit/` with filters `date_from`, `date_to`, `actor_id`, `entity_type`, `entity_id`, and `action`, plus pagination.

Audit events need immutable id, occurred time, actor, business, action, entity type/id, request/correlation id, source, and redacted before/after values. Record payment confirmation, order cancellation/void/refund, purchase receipt/reversal, stock adjustment, production completion/cancellation, user registration/login/logout, role/permission change, and business settings change.

Add `GET /reports/tax-compliance/` (or a clearly documented EBM endpoint) with period filters. It must return taxable and exempt sales, tax due/collected, receipt/invoice number, fiscal device/submission reference, submission status/time, failed submission reason, corrections, voids, and refunds. Store fiscal records server-side and make retry/reconciliation idempotent.

## 8. Correct transaction behavior to preserve in reports

- A dine-in order reserves one available table to one waiter. Other waiters cannot select that table until the order is completed/cancelled and payment is recorded where required. The reporting history must retain the waiter/table/order link.
- Confirming a valid payment must atomically mark the order paid, create the sale/payment record, reduce finished-product stock once, and release the table. Failed or duplicate payment submissions must not create duplicate sales or stock deductions.
- Receiving a purchase must atomically increase the corresponding raw inventory quantities once. Editing a draft must not increase stock.
- Creating an in-progress production run must validate total selected inputs against available inventory. Completing it must apply production stock movements once and add output products once.
- Every create/complete/receive/payment action must accept an idempotency key. A later update must not try to replace the original key; the current API should accept status-only completion updates.

## Acceptance tests

1. A completed, paid order appears once in sales, daily summary, audit, tax, P&L revenue, COGS, and product stock movements; its table becomes available.
2. A purchase only increases inventory when received; it affects stock valuation but is not automatically P&L COGS.
3. A completed production run consumes raw inputs, records waste, adds finished output once, and its yield/waste cost appears in production and P&L reports.
4. Cancelling/reversing any transaction creates reversing movements/journal entries and preserves the audit trail.
5. A user without the appropriate report permission receives `403` and sees no report data.
6. Two identical idempotency-key requests create one business event and one set of movements only.
7. Date filtering produces the same result at midnight boundaries in `Africa/Kigali`, and report totals reconcile with detail rows.
