"use client";

import ApiUnavailableTransactionPage from "./ApiUnavailableTransactionPage";
import type { TransactionRole } from "./TransactionLayout";

export default function QuotationsPage({ role }: { role: TransactionRole }) {
  return <ApiUnavailableTransactionPage role={role} title="Quotations" endpointSuggestion="Required backend resource: GET/POST/PATCH /quotations/ (with quotation lines, expiry date, customer, and status)." />;
}
