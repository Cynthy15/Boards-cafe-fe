"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { boardsApi, subscribeToApiDataChanges, type ApiRecord } from "../../../../lib/api-client";
import { DateRangeControls, LoadingCards, MetricCard, ReportTable, money, monthStartIso, records, reportQuery, retryReportRequest, text, todayIso, wholeNumber } from "./ReportKit";
import { ReportsLayout, type ReportsRole } from "./ReportsLayout";

export default function PurchasingSuppliersPage({ role }: { role: ReportsRole }) {
  const [report, setReport] = useState<ApiRecord | null>(null);
  const [dateFrom, setDateFrom] = useState(monthStartIso);
  const [dateTo, setDateTo] = useState(todayIso);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try { setReport(await retryReportRequest(() => boardsApi.reports.purchases(reportQuery(dateFrom, dateTo)))); setError(""); }
    catch (cause) { setReport(null); setError(cause instanceof Error ? cause.message : "We couldn’t load purchasing and supplier data."); }
    finally { setIsLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const unsubscribe = subscribeToApiDataChanges(() => { void load(); });
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [load]);

  const rows = useMemo(() => records(report?.purchases_by_supplier).filter((item) => JSON.stringify(item).toLowerCase().includes(search.toLowerCase())), [report, search]);

  return <ReportsLayout role={role} title="Purchasing & Suppliers" search={search} onSearchChange={setSearch} actionLabel="Refresh" onAction={() => void load()} actionDisabled={isLoading}>
    <section className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
      {error && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}
      <div className="flex flex-wrap items-start justify-between gap-3"><p className="m-0 max-w-xl pt-1 text-[10px] leading-4 text-[#76685c]">Supplier purchase activity for the selected period. A purchase becomes raw-material stock only after it is received.</p><DateRangeControls dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} onToday={() => { const today = todayIso(); setDateFrom(today); setDateTo(today); }} onThisMonth={() => { setDateFrom(monthStartIso()); setDateTo(todayIso()); }} /></div>
      {isLoading ? <LoadingCards /> : <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Purchases" value={money(report?.total_purchases)} note={`${wholeNumber(report?.purchase_count)} purchase records`} /><MetricCard label="Received" value={wholeNumber(report?.received_count)} note="Fully received" /><MetricCard label="Partially received" value={wholeNumber(report?.partially_received_count)} /><MetricCard label="Still ordered" value={wholeNumber(report?.ordered_count)} /></div>}
      <ReportTable headers={["Supplier", "Purchase count", "Purchase value"]} loading={isLoading} hasRows={rows.length > 0} empty="No supplier purchase totals match the selected period and search.">{rows.map((item) => <tr key={String(item.supplier_id)} className="h-10 border-b border-[#eee6dc]"><td className="px-3 font-medium">{text(item.supplier_name) || "-"}</td><td className="px-3">{wholeNumber(item.purchase_count)}</td><td className="px-3 text-right font-medium">{money(item.total)}</td></tr>)}</ReportTable>
    </section>
  </ReportsLayout>;
}
