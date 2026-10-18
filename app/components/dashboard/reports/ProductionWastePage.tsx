"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { boardsApi, subscribeToApiDataChanges, type ApiRecord } from "../../../../lib/api-client";
import { DateRangeControls, LoadingCards, MetricCard, ReportTable, decimal, money, monthStartIso, records, reportQuery, retryReportRequest, text, todayIso, wholeNumber } from "./ReportKit";
import { ReportsLayout, type ReportsRole } from "./ReportsLayout";

function record(value: unknown): ApiRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApiRecord : {};
}

function reportRows(report: ApiRecord | null) {
  for (const key of ["runs", "results", "items", "records"]) {
    const rows = records(report?.[key]);
    if (rows.length) return rows;
  }
  return [];
}

export default function ProductionWastePage({ role }: { role: ReportsRole }) {
  const [report, setReport] = useState<ApiRecord | null>(null);
  const [dateFrom, setDateFrom] = useState(monthStartIso);
  const [dateTo, setDateTo] = useState(todayIso);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setReport(await retryReportRequest(() => boardsApi.reports.production(reportQuery(dateFrom, dateTo, { pageSize: 50 }))));
      setError("");
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : "We couldn’t load the production report. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const unsubscribe = subscribeToApiDataChanges(() => { void load(); });
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [load]);

  const summary = record(report?.summary);
  const currency = text(report?.currency) || "RWF";
  const rows = useMemo(() => reportRows(report).filter((run) => JSON.stringify(run).toLowerCase().includes(search.toLowerCase())), [report, search]);

  return <ReportsLayout role={role} title="Production & Waste" search={search} onSearchChange={setSearch} actionLabel="Refresh" onAction={() => void load()} actionDisabled={isLoading}>
    <section className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
      {error && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}
      <div className="flex flex-wrap items-start justify-between gap-3"><p className="m-0 max-w-xl pt-1 text-[10px] leading-4 text-[#76685c]">Production, yield, and waste figures are prepared from completed and in-progress production records by the server. The report never derives waste or stock changes from the page of rows shown here.</p><DateRangeControls dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} onToday={() => { const today = todayIso(); setDateFrom(today); setDateTo(today); }} onThisMonth={() => { setDateFrom(monthStartIso()); setDateTo(todayIso()); }} /></div>
      {isLoading ? <LoadingCards /> : <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Production runs" value={wholeNumber(summary.total_runs ?? summary.production_runs)} note="For the selected period" /><MetricCard label="Completed" value={wholeNumber(summary.completed_runs)} note="Finished stock applied once" /><MetricCard label="Output quantity" value={decimal(summary.output_quantity)} /><MetricCard label="Waste cost" value={money(summary.waste_cost, currency)} note="Server-valued waste" /></div>}
      <ReportTable headers={["Completed / created", "Recipe / output", "Staff", "Planned / actual input", "Waste / output", "Yield", "Status"]} loading={isLoading} hasRows={rows.length > 0} empty="No production runs match the selected period and search.">{rows.map((run, index) => <tr key={String(run.run_id ?? run.id ?? index)} className="border-b border-[#eee6dc]"><td className="whitespace-nowrap px-3 py-2.5">{text(run.completed_at ?? run.created_at).slice(0, 10) || "-"}</td><td className="px-3 py-2.5"><strong className="font-medium">{text(run.recipe_name ?? run.recipe) || "-"}</strong><span className="block text-[#9a8d81]">{text(run.output_product_name ?? run.output_product)}</span></td><td className="px-3 py-2.5">{text(run.staff_name ?? run.created_by_name ?? run.actor_name) || "-"}</td><td className="px-3 py-2.5">{decimal(run.planned_input_quantity ?? run.planned_input)} / {decimal(run.actual_input_quantity ?? run.actual_input)}</td><td className="px-3 py-2.5">{decimal(run.waste_quantity ?? run.declared_waste)} / {decimal(run.output_quantity)}</td><td className="px-3 py-2.5">{decimal(run.yield_percentage)}%</td><td className="px-3 py-2.5 capitalize">{text(run.status).replaceAll("_", " ") || "-"}</td></tr>)}</ReportTable>
    </section>
  </ReportsLayout>;
}
