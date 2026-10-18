"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { boardsApi, subscribeToApiDataChanges, type ApiRecord } from "../../../../lib/api-client";
import { LoadingCards, MetricCard, ReportTable, decimal, money, records, reportQuery, retryReportRequest, text, wholeNumber } from "./ReportKit";
import { ReportsLayout, type ReportsRole } from "./ReportsLayout";

function reportRows(report: ApiRecord | null): ApiRecord[] {
  const items = records(report?.items ?? report?.results ?? report?.records);
  if (items.length) return items;
  return [
    ...records(report?.raw_materials).map((item): ApiRecord => ({ ...item, item_type: typeof item.item_type === "string" ? item.item_type : "raw_material" })),
    ...records(report?.finished_products).map((item): ApiRecord => ({ ...item, item_type: typeof item.item_type === "string" ? item.item_type : "finished_product" })),
  ];
}

export default function InventoryReorderPage({ role }: { role: ReportsRole }) {
  const [report, setReport] = useState<ApiRecord | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setReport(await retryReportRequest(() => boardsApi.reports.inventoryReorder(reportQuery("", "", { pageSize: 100 }))));
      setError("");
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : "We couldn’t load inventory and reorder data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const unsubscribe = subscribeToApiDataChanges(() => { void load(); });
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [load]);

  const summary = report?.summary && typeof report.summary === "object" && !Array.isArray(report.summary) ? report.summary as ApiRecord : report ?? {};
  const currency = text(report?.currency) || "RWF";
  const rows = useMemo(() => reportRows(report).filter((item) => JSON.stringify(item).toLowerCase().includes(search.toLowerCase())), [report, search]);

  return <ReportsLayout role={role} title="Inventory & Reorder" search={search} onSearchChange={setSearch} actionLabel="Refresh" onAction={() => void load()} actionDisabled={isLoading}>
    <section className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
      {error && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}
      <p className="m-0 text-[10px] text-[#76685c]">Server-calculated reorder advice and valuation. Raw materials and finished products remain separate, and values reflect the inventory valuation held by the business ledger.</p>
      {isLoading ? <LoadingCards /> : <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Tracked items" value={wholeNumber(summary.total_items)} /><MetricCard label="Raw materials" value={wholeNumber(summary.raw_material_count)} /><MetricCard label="Finished products" value={wholeNumber(summary.finished_product_count)} /><MetricCard label="Low or out of stock" value={wholeNumber(summary.low_stock_items)} note="Server-assessed reorder status" /></div>}
      <ReportTable headers={["Item", "Type", "On hand / minimum", "Suggested reorder", "Costs", "Inventory value", "Status"]} loading={isLoading} hasRows={rows.length > 0} empty="No inventory items match the current search.">{rows.map((item, index) => <tr key={String(item.item_id ?? item.product_id ?? item.id ?? index)} className="border-b border-[#eee6dc]"><td className="px-3 py-2.5 font-medium">{text(item.item_name ?? item.product_name ?? item.name) || "-"}</td><td className="px-3 py-2.5 capitalize">{text(item.item_type ?? item.type).replaceAll("_", " ") || "-"}</td><td className="px-3 py-2.5">{decimal(item.on_hand_quantity ?? item.quantity)} / {decimal(item.minimum_level ?? item.minimum_stock_level)} {text(item.unit)}</td><td className="px-3 py-2.5">{decimal(item.suggested_reorder_quantity)}</td><td className="px-3 py-2.5">{money(item.last_purchase_cost, currency)} / {money(item.average_cost, currency)}</td><td className="px-3 py-2.5">{money(item.inventory_value, currency)}</td><td className="px-3 py-2.5 capitalize">{text(item.status).replaceAll("_", " ") || "-"}</td></tr>)}</ReportTable>
    </section>
  </ReportsLayout>;
}
