"use client";

import { TableCell } from "@/app/components/dashboard/TableCell";

import { useCallback, useEffect, useMemo, useState } from "react";

import { boardsApi, subscribeToApiDataChanges, type ApiRecord } from "../../../../lib/api-client";
import { retryReportRequest } from "./ReportKit";
import { ReportsLayout, type ReportsRole } from "./ReportsLayout";

type ReportData = { sales: ApiRecord; expenses: ApiRecord; purchases: ApiRecord; inventory: ApiRecord };

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function count(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed.toLocaleString() : "0"; }
function money(value: unknown) { const parsed = Number(value); return `Rwf ${Number.isFinite(parsed) ? parsed.toLocaleString() : "0"}`; }
function records(value: unknown) { return Array.isArray(value) ? value.filter((item): item is ApiRecord => !!item && typeof item === "object") : []; }

export default function ChartOfAccountsPage({ role }: { role: ReportsRole }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      // Keep hosted report requests spaced out; concurrent reads can be throttled.
      const sales = await retryReportRequest(() => boardsApi.reports.sales());
      const expenses = await retryReportRequest(() => boardsApi.reports.expenses());
      const purchases = await retryReportRequest(() => boardsApi.reports.purchases());
      const inventory = await retryReportRequest(() => boardsApi.reports.inventory());
      setData({ sales, expenses, purchases, inventory });
      setError("");
    } catch (requestError) {
      setData(null);
      setError(requestError instanceof Error ? requestError.message : "We couldn’t load the reports. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const unsubscribe = subscribeToApiDataChanges(() => { void load(); });
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [load]);

  const rows = useMemo(() => [
    ...records(data?.sales.sales_by_product).map((item) => ({ id: `product-${item.product_id}`, type: "Product sales", name: text(item.product_name), count: count(item.quantity_sold), amount: money(item.sales) })),
    ...records(data?.expenses.expenses_by_category).map((item) => ({ id: `expense-${item.category_id}`, type: "Expense category", name: text(item.category_name), count: "", amount: money(item.total) })),
    ...records(data?.purchases.purchases_by_supplier).map((item) => ({ id: `supplier-${item.supplier_id}`, type: "Supplier purchases", name: text(item.supplier_name), count: count(item.purchase_count), amount: money(item.total) })),
  ].filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())), [data, search]);

  const cards = data ? [
    ["Total sales", money(data.sales.total_sales), `${count(data.sales.paid_orders)} paid orders`],
    ["Total expenses", money(data.expenses.total_expenses), `${count(data.expenses.expense_count)} recorded expenses`],
    ["Total purchases", money(data.purchases.total_purchases), `${count(data.purchases.purchase_count)} purchases`],
    ["Inventory items", count(data.inventory.total_items), `${count(data.inventory.low_stock_items)} low · ${count(data.inventory.out_of_stock_items)} out of stock`],
  ] : [];

  return <ReportsLayout role={role} title="Reports Overview" search={search} onSearchChange={setSearch} actionLabel="Refresh" onAction={() => void load()} actionDisabled={isLoading}>
    <section className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
      {error && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}
      <p className="m-0 text-[10px] text-[#76685c]">Live all-time figures from the sales, expenses, purchases, and inventory report APIs.</p>
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">{isLoading ? Array.from({ length: 4 }, (_, index) => <div key={index} className="min-h-24 animate-pulse rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/85" />) : cards.map(([label, value, note]) => <article key={label} className="min-h-24 rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95 p-3.5 shadow-sm"><p className="m-0 text-[10px] text-[#76685c]">{label}</p><strong className="mt-3 block text-xl">{value}</strong><p className="mb-0 mt-1 text-[9px] text-[#9a8d81]">{note}</p></article>)}</div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95 shadow-sm"><div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[620px] border-collapse text-left"><thead className="sticky top-0 bg-[#f0e5d4] text-[9px] font-medium text-[#4b3b2f]"><tr className="h-8 border-b border-[#e2d6c6]"><th className="px-3">Report area</th><th className="px-3">Name</th><th className="px-3">Count</th><th className="px-3 text-right">Amount</th></tr></thead><tbody className="text-[10px] text-[#55463a]">{rows.map((row) => <tr key={row.id} className="h-9 border-b border-[#eee6dc]"><TableCell className="px-3">{row.type}</TableCell><TableCell className="px-3 font-medium">{row.name || "-"}</TableCell><TableCell className="px-3">{row.count || "-"}</TableCell><TableCell className="px-3 text-right font-medium">{row.amount}</TableCell></tr>)}</tbody></table></div>{!isLoading && !rows.length && <p className="m-auto py-10 text-center text-[10px] text-[#9a8d81]">No report rows match the current search.</p>}<div className="min-h-9 border-t border-[#ebe2d7] px-3 py-2 text-[9px] text-[#817367]">{isLoading ? "Loading API reports…" : `Showing ${rows.length} live report rows`}</div></div>
    </section>
  </ReportsLayout>;
}
