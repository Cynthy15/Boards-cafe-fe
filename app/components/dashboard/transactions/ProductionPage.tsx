"use client";

import ApiUnavailableTransactionPage from "./ApiUnavailableTransactionPage";
import type { TransactionRole } from "./TransactionLayout";

export default function ProductionPage({ role }: { role: TransactionRole }) {
  return <ApiUnavailableTransactionPage role={role} title="Production" apiNote="The API has recipe resources, but recipes define ingredients; they do not record a production run, stock-in, waste, or batch output." endpointSuggestion="Required backend resource: GET/POST /production-runs/ (recipe or product, produced quantity, batch, waste, status, and stock movements)." />;
}
