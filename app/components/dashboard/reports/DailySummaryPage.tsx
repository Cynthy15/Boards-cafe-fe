"use client";

import { TableCell } from "@/app/components/dashboard/TableCell";

import { useCallback, useEffect, useMemo, useState } from "react";

import { boardsApi, subscribeToApiDataChanges, type ApiRecord } from "../../../../lib/api-client";
import { DateRangeControls, LoadingCards, MetricCard, ReportTable, money, records, monthStartIso, reportQuery, retryReportRequest, text, todayIso, wholeNumber } from "./ReportKit";
import { ReportsLayout, type ReportsRole } from "./ReportsLayout";

function record(value: unknown): ApiRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApiRecord : {};
}

export default function DailySummaryPage({ role }: { role: ReportsRole }) {
  const [report, setReport] = useState<ApiRecord | null>(null);
  const [dateFrom, setDateFrom] = useState(todayIso);
  const [dateTo, setDateTo] = useState(todayIso);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setReport(await retryReportRequest(() => boardsApi.reports.dailySummary(reportQuery(dateFrom, dateTo, { groupBy: "day" }))));
      setError("");
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : "We couldn’t load the daily summary. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const unsubscribe = subscribeToApiDataChanges(() => { void load(); });
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [load]);

  const totals = record(report?.totals);
  const currency = text(report?.currency) || "RWF";
  const activityRows = useMemo(() => report ? [
    ["Orders", wholeNumber(totals.orders), "Orders in the selected reporting period"],
    ["Paid orders", wholeNumber(totals.paid_orders), "Final, paid orders only"],
    ["Cancelled orders", wholeNumber(totals.cancelled_orders), "Cancelled or voided orders reported by the API"],
    ["Recorded expenses", money(totals.recorded_expenses, currency), "Operating expenses from the server ledger"],
    ["Purchase commitments", money(totals.purchase_commitments, currency), "Purchases; not cost of goods sold"],
  ] : [], [report, totals, currency]);
  const paymentRows = records(report?.payments_by_method);
  const seriesRows = records(report?.series);

  return <ReportsLayout role={role} title="Daily Summary" actionLabel="Refresh" onAction={() => void load()} actionDisabled={isLoading}>
    <section className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
      {error && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}
      <div className="flex flex-wrap items-start justify-between gap-3"><p className="m-0 max-w-xl pt-1 text-[10px] leading-4 text-[#76685c]">A server-calculated cash and activity summary for the selected Rwanda reporting period. Purchase commitments remain separate from operating expenses and COGS.</p><DateRangeControls dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} onToday={() => { const today = todayIso(); setDateFrom(today); setDateTo(today); }} onThisMonth={() => { setDateFrom(monthStartIso()); setDateTo(todayIso()); }} /></div>
      {isLoading ? <LoadingCards /> : <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Gross sales" value={money(totals.gross_sales, currency)} note="Before discounts and refunds" /><MetricCard label="Net sales" value={money(totals.net_sales, currency)} note="Final sales revenue" /><MetricCard label="Customer payments" value={money(totals.completed_customer_payments, currency)} note="Completed payments" /><MetricCard label="Recorded expenses" value={money(totals.recorded_expenses, currency)} note="Operating expenses" /></div>}
      <article className="overflow-hidden rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95 shadow-sm"><div className="border-b border-[#e2d6c6] bg-[#f0e5d4] px-3 py-2.5"><h2 className="m-0 text-xs font-semibold">Activity in the selected period</h2></div><div className="grid divide-y divide-[#eee6dc] sm:grid-cols-2 sm:divide-x sm:divide-y-0">{activityRows.map(([label, value, detail]) => <div key={label} className="p-3"><p className="m-0 text-[10px] font-medium text-[#55463a]">{label}</p><strong className="mt-1 block text-base text-[#392d26]">{value}</strong><p className="mb-0 mt-1 text-[9px] text-[#9a8d81]">{detail}</p></div>)}</div>{!isLoading && !activityRows.length && <p className="m-0 p-6 text-center text-[10px] text-[#9a8d81]">No daily activity was returned for this period.</p>}</article>
      <ReportTable headers={["Payment method", "Completed payments"]} loading={isLoading} hasRows={paymentRows.length > 0} empty="No completed payment-method totals were returned for this period.">{paymentRows.map((item, index) => <tr key={String(item.payment_method ?? item.method ?? index)} className="h-9 border-b border-[#eee6dc]"><TableCell className="px-3 capitalize">{text(item.payment_method ?? item.method).replaceAll("_", " ") || "-"}</TableCell><TableCell className="px-3 text-right font-medium">{money(item.total ?? item.amount, currency)}</TableCell></tr>)}</ReportTable>
      {seriesRows.length > 0 && <ReportTable headers={["Period", "Net sales", "Paid orders"]} loading={false} hasRows empty="">{seriesRows.map((item, index) => <tr key={String(item.date ?? item.period ?? index)} className="h-9 border-b border-[#eee6dc]"><TableCell className="px-3">{text(item.date ?? item.period ?? item.label) || "-"}</TableCell><TableCell className="px-3">{money(item.net_sales, currency)}</TableCell><TableCell className="px-3 text-right">{wholeNumber(item.paid_orders)}</TableCell></tr>)}</ReportTable>}
    </section>
  </ReportsLayout>;
}
