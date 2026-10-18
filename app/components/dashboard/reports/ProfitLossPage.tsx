"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { boardsApi, subscribeToApiDataChanges, type ApiRecord } from "../../../../lib/api-client";
import { DateRangeControls, LoadingCards, MetricCard, ReportTable, money, monthStartIso, records, reportQuery, retryReportRequest, text, todayIso } from "./ReportKit";
import { ReportsLayout, type ReportsRole } from "./ReportsLayout";

function record(value: unknown): ApiRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApiRecord : {};
}

export default function ProfitLossPage({ role }: { role: ReportsRole }) {
  const [report, setReport] = useState<ApiRecord | null>(null);
  const [dateFrom, setDateFrom] = useState(monthStartIso);
  const [dateTo, setDateTo] = useState(todayIso);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setReport(await retryReportRequest(() => boardsApi.reports.profitLoss(reportQuery(dateFrom, dateTo))));
      setError("");
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : "We couldn’t load the profit and loss report. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const unsubscribe = subscribeToApiDataChanges(() => { void load(); });
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [load]);

  const revenue = record(report?.revenue);
  const cogs = record(report?.cost_of_goods_sold);
  const operatingExpenses = record(report?.operating_expenses);
  const taxes = record(report?.taxes);
  const margins = record(report?.margins);
  const currency = text(report?.currency) || "RWF";
  const statementRows = useMemo(() => report ? [
    ["Revenue", "Gross sales", money(revenue.gross_sales, currency)],
    ["Revenue", "Discounts", money(revenue.discounts, currency)],
    ["Revenue", "Refunds", money(revenue.refunds, currency)],
    ["Revenue", "Net sales", money(revenue.net_sales, currency)],
    ["Cost of goods sold", "Raw materials", money(cogs.raw_materials, currency)],
    ["Cost of goods sold", "Finished goods", money(cogs.finished_goods, currency)],
    ["Cost of goods sold", "Production waste", money(cogs.production_waste, currency)],
    ["Cost of goods sold", "Inventory adjustments", money(cogs.inventory_adjustments, currency)],
    ["Cost of goods sold", "Total COGS", money(cogs.total, currency)],
    ["Operating expenses", "Total", money(operatingExpenses.total, currency)],
    ["Taxes", "Sales tax", money(taxes.sales_tax, currency)],
    ["Taxes", "Income tax", money(taxes.income_tax, currency)],
    ["Taxes", "Other tax", money(taxes.other, currency)],
  ] : [], [report, revenue, cogs, operatingExpenses, taxes, currency]);
  const expenseCategories = records(operatingExpenses.by_category);
  const warnings = Array.isArray(report?.warnings) ? report.warnings.filter((warning): warning is string => typeof warning === "string" && warning.trim().length > 0) : [];

  return <ReportsLayout role={role} title="Expense & Profit/Loss" actionLabel="Refresh" onAction={() => void load()} actionDisabled={isLoading}>
    <section className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
      {error && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}
      <div className="flex flex-wrap items-start justify-between gap-3"><p className="m-0 max-w-xl pt-1 text-[10px] leading-4 text-[#76685c]">This statement is calculated by the business ledger. Received purchases affect stock valuation; COGS is recognized only when the ledger records consumption or a configured stock event.</p><DateRangeControls dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} onToday={() => { const today = todayIso(); setDateFrom(today); setDateTo(today); }} onThisMonth={() => { setDateFrom(monthStartIso()); setDateTo(todayIso()); }} /></div>
      {isLoading ? <LoadingCards /> : <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Net sales" value={money(revenue.net_sales, currency)} note="Gross sales less discounts and refunds" /><MetricCard label="Cost of goods sold" value={money(cogs.total, currency)} note={text(cogs.valuation_method) || "Ledger valuation"} /><MetricCard label="Gross profit" value={money(report?.gross_profit, currency)} note={`${text(margins.gross_profit_percent) || "0.00"}% margin`} /><MetricCard label="Net profit" value={money(report?.net_profit, currency)} note={`${text(margins.net_profit_percent) || "0.00"}% margin`} /></div>}
      <ReportTable headers={["Section", "Line item", "Amount"]} loading={isLoading} hasRows={statementRows.length > 0} empty="No profit and loss lines were returned for this period.">{statementRows.map(([section, label, amount]) => <tr key={`${section}-${label}`} className="h-9 border-b border-[#eee6dc]"><td className="px-3">{section}</td><td className="px-3 font-medium">{label}</td><td className="px-3 text-right">{amount}</td></tr>)}</ReportTable>
      {expenseCategories.length > 0 && <ReportTable headers={["Operating-expense category", "Amount"]} loading={false} hasRows empty="">{expenseCategories.map((category, index) => <tr key={String(category.category_id ?? category.id ?? index)} className="h-9 border-b border-[#eee6dc]"><td className="px-3">{text(category.category_name ?? category.name) || "Uncategorised"}</td><td className="px-3 text-right">{money(category.total ?? category.amount, currency)}</td></tr>)}</ReportTable>}
      {warnings.length > 0 && <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-900"><h2 className="m-0 text-xs font-semibold">Report warnings</h2><ul className="mb-0 mt-2 list-disc space-y-1 pl-4">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section>}
    </section>
  </ReportsLayout>;
}
