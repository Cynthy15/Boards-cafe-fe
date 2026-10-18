"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { boardsApi, subscribeToApiDataChanges, type ApiRecord } from "../../../../lib/api-client";
import { DateRangeControls, money, monthStartIso, reportQuery, todayIso } from "./ReportKit";
import { ReportsLayout, type ReportsRole } from "./ReportsLayout";

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed.toLocaleString() : "0"; }
function records(value: unknown) { return Array.isArray(value) ? value.filter((item): item is ApiRecord => !!item && typeof item === "object") : []; }

export default function SaleTaxPage({ role }: { role: ReportsRole }) {
  const [report, setReport] = useState<ApiRecord | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(monthStartIso);
  const [dateTo, setDateTo] = useState(todayIso);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setReport(await boardsApi.reports.sales(reportQuery(dateFrom, dateTo)));
      setError("");
    } catch (requestError) {
      setReport(null);
      setError(requestError instanceof Error ? requestError.message : "We couldn’t load the sales report. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const unsubscribe = subscribeToApiDataChanges(() => { void load(); });
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [load]);

  const rows = useMemo(() => [
    ...records(report?.sales_by_product).map((item) => ({ id: `product-${item.product_id}`, type: "Product", name: text(item.product_name), quantity: number(item.quantity_sold), amount: money(item.sales) })),
    ...records(report?.sales_by_category).map((item) => ({ id: `category-${item.category_id}`, type: "Category", name: text(item.category_name), quantity: number(item.quantity_sold), amount: money(item.sales) })),
    ...records(report?.payments_by_method).map((item) => ({ id: `payment-${item.payment_method}`, type: "Payment method", name: text(item.payment_method).replaceAll("_", " "), quantity: "", amount: money(item.total) })),
  ].filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())), [report, search]);

  const summary = report ? [
    ["Sales", money(report.total_sales)],
    ["Completed payments", money(report.total_paid)],
    ["Paid orders", number(report.paid_orders)],
    ["Average order", money(report.average_order_value)],
  ] : [];

  return <ReportsLayout role={role} title="Sales Performance" search={search} onSearchChange={setSearch} actionLabel="Refresh" onAction={() => void load()} actionDisabled={isLoading}>
    <section className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">{error && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}<div className="flex flex-wrap items-start justify-between gap-3"><p className="m-0 max-w-xl pt-1 text-[10px] text-[#76685c]">Completed sales and customer payments for the selected period, from the live report API.</p><DateRangeControls dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} onToday={() => { const today = todayIso(); setDateFrom(today); setDateTo(today); }} onThisMonth={() => { setDateFrom(monthStartIso()); setDateTo(todayIso()); }} /></div><div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">{isLoading ? Array.from({ length: 4 }, (_, index) => <div key={index} className="min-h-[88px] animate-pulse rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/85" />) : summary.map(([label, value]) => <article key={label} className="min-h-[88px] rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95 p-3.5 shadow-sm"><p className="m-0 text-[10px] text-[#76685c]">{label}</p><strong className="mt-3 block text-xl">{value}</strong></article>)}</div><div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95 shadow-sm"><div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[620px] border-collapse text-left"><thead className="sticky top-0 bg-[#f0e5d4] text-[9px] font-medium text-[#4b3b2f]"><tr className="h-8 border-b border-[#e2d6c6]"><th className="px-3">Breakdown</th><th className="px-3">Name</th><th className="px-3">Quantity</th><th className="px-3 text-right">Sales / paid</th></tr></thead><tbody className="text-[10px] text-[#55463a]">{rows.map((row) => <tr key={row.id} className="h-9 border-b border-[#eee6dc]"><td className="px-3">{row.type}</td><td className="px-3 font-medium capitalize">{row.name || "-"}</td><td className="px-3">{row.quantity || "-"}</td><td className="px-3 text-right font-medium">{row.amount}</td></tr>)}</tbody></table></div>{!isLoading && !rows.length && <p className="m-auto py-10 text-center text-[10px] text-[#9a8d81]">No sales report rows match the selected period and search.</p>}<div className="min-h-9 border-t border-[#ebe2d7] px-3 py-2 text-[9px] text-[#817367]">{isLoading ? "Loading sales report…" : `${rows.length} rows from the sales report API`}</div></div></section>
  </ReportsLayout>;
}
