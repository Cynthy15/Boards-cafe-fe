"use client";

import { TableCell } from "@/app/components/dashboard/TableCell";

import { useCallback, useEffect, useMemo, useState } from "react";

import { boardsApi, subscribeToApiDataChanges, type ApiRecord } from "../../../../lib/api-client";
import { DateRangeControls, LoadingCards, MetricCard, ReportTable, money, monthStartIso, records, reportQuery, retryReportRequest, text, todayIso } from "./ReportKit";
import { ReportsLayout, type ReportsRole } from "./ReportsLayout";

type ComplianceReports = { audit: ApiRecord; tax: ApiRecord };

function rows(report: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = records(report[key]);
    if (value.length) return value;
  }
  return [];
}

function summary(report: ApiRecord) {
  return report.summary && typeof report.summary === "object" && !Array.isArray(report.summary) ? report.summary as ApiRecord : report;
}

export default function ComplianceReportPage({ role }: { role: ReportsRole }) {
  const [data, setData] = useState<ComplianceReports | null>(null);
  const [dateFrom, setDateFrom] = useState(monthStartIso);
  const [dateTo, setDateTo] = useState(todayIso);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = reportQuery(dateFrom, dateTo, { pageSize: 50 });
      const audit = await retryReportRequest(() => boardsApi.reports.audit(query));
      const tax = await retryReportRequest(() => boardsApi.reports.taxCompliance(query));
      setData({ audit, tax });
      setError("");
    } catch (cause) {
      setData(null);
      setError(cause instanceof Error ? cause.message : "We couldn’t load the compliance reports. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const unsubscribe = subscribeToApiDataChanges(() => { void load(); });
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [load]);

  const tax = data?.tax ?? {};
  const taxSummary = summary(tax);
  const currency = text(tax.currency) || "RWF";
  const auditRows = useMemo(() => data ? rows(data.audit, ["events", "results", "items", "records"]) : [], [data]);
  const fiscalRows = useMemo(() => data ? rows(data.tax, ["fiscal_records", "receipts", "results", "items"]) : [], [data]);

  return <ReportsLayout role={role} title="Audit & Tax Compliance" actionLabel="Refresh" onAction={() => void load()} actionDisabled={isLoading}>
    <section className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
      {error && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}
      <div className="flex flex-wrap items-start justify-between gap-3"><p className="m-0 max-w-xl pt-1 text-[10px] leading-4 text-[#76685c]">Activity history and tax records for the selected reporting period in Rwanda. Sensitive details are hidden.</p><DateRangeControls dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} onToday={() => { const today = todayIso(); setDateFrom(today); setDateTo(today); }} onThisMonth={() => { setDateFrom(monthStartIso()); setDateTo(todayIso()); }} /></div>
      {isLoading ? <LoadingCards /> : <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Taxable sales" value={money(taxSummary.taxable_sales, currency)} /><MetricCard label="Exempt sales" value={money(taxSummary.exempt_sales, currency)} /><MetricCard label="Tax collected" value={money(taxSummary.tax_collected ?? taxSummary.tax_due, currency)} /><MetricCard label="Refunds / voids" value={money(taxSummary.refunds ?? taxSummary.voids, currency)} /></div>}
      <ReportTable headers={["Occurred", "Actor", "Action", "Record", "Source / request"]} loading={isLoading} hasRows={auditRows.length > 0} empty="No audit events were returned for this period.">{auditRows.map((event, index) => <tr key={String(event.id ?? event.event_id ?? index)} className="border-b border-[#eee6dc]"><TableCell className="whitespace-nowrap px-3 py-2.5">{text(event.occurred_at ?? event.created_at).replace("T", " ").slice(0, 19) || "-"}</TableCell><TableCell className="px-3 py-2.5">{text(event.actor_name ?? event.actor_email ?? event.actor) || "System"}</TableCell><TableCell className="px-3 py-2.5">{text(event.action).replaceAll("_", " ") || "-"}</TableCell><TableCell className="px-3 py-2.5">{text(event.entity_type)} {text(event.entity_id)}</TableCell><TableCell className="px-3 py-2.5">{text(event.source) || "-"}<span className="block text-[#9a8d81]">{text(event.request_id ?? event.correlation_id)}</span></TableCell></tr>)}</ReportTable>
      <ReportTable headers={["Receipt / invoice", "Fiscal reference", "Submitted", "Status", "Reason"]} loading={isLoading} hasRows={fiscalRows.length > 0} empty="No fiscal records were returned for this period.">{fiscalRows.map((fiscal, index) => <tr key={String(fiscal.id ?? fiscal.receipt_number ?? index)} className="border-b border-[#eee6dc]"><TableCell className="px-3 py-2.5">{text(fiscal.receipt_number ?? fiscal.invoice_number) || "-"}</TableCell><TableCell className="px-3 py-2.5">{text(fiscal.fiscal_reference ?? fiscal.submission_reference ?? fiscal.device_reference) || "-"}</TableCell><TableCell className="px-3 py-2.5">{text(fiscal.submitted_at ?? fiscal.submission_time).replace("T", " ").slice(0, 19) || "-"}</TableCell><TableCell className="px-3 py-2.5 capitalize">{text(fiscal.submission_status ?? fiscal.status).replaceAll("_", " ") || "-"}</TableCell><TableCell className="px-3 py-2.5">{text(fiscal.failed_submission_reason ?? fiscal.failure_reason) || "-"}</TableCell></tr>)}</ReportTable>
    </section>
  </ReportsLayout>;
}
