"use client";

import type { ReactNode } from "react";
import { ApiRequestError } from "../../../../lib/api-client";

const THROTTLE_RETRY_DELAY_MS = 1_100;
export const REPORT_TIMEZONE = "Africa/Kigali";

/** The hosted API may throttle concurrent report reads; retrying one rejected read is safe. */
export async function retryReportRequest<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (cause) {
    if (!(cause instanceof ApiRequestError) || cause.status !== 429) throw cause;
    const delay = cause.retryAfterSeconds === null
      ? THROTTLE_RETRY_DELAY_MS
      : Math.min(cause.retryAfterSeconds * 1_000, 60_000);
    await new Promise<void>((resolve) => window.setTimeout(resolve, delay));
    return request();
  }
}

function groupedDecimal(value: unknown, fallbackFractionDigits?: string) {
  const raw = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) return `0${fallbackFractionDigits ? `.${fallbackFractionDigits}` : ""}`;
  const whole = match[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = match[3] ?? fallbackFractionDigits;
  return `${match[1]}${whole}${fraction === undefined ? "" : `.${fraction}`}`;
}

/** Formats a server-provided decimal without using it for a client-side total. */
export function money(value: unknown, currency = "RWF") {
  return `${currency} ${groupedDecimal(value, "00")}`;
}

export function wholeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0";
}

export function decimal(value: unknown) {
  return groupedDecimal(value);
}

export function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function records(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : [];
}

export function reportQuery(dateFrom: string, dateTo: string, options: {
  timezone?: string;
  groupBy?: "day" | "week" | "month" | "product" | "category" | "payment_method" | "staff" | "table" | "order_type";
  page?: number;
  pageSize?: number;
  filters?: Record<string, string | number | undefined>;
} = {}) {
  if (dateFrom && dateTo && dateTo < dateFrom) throw new Error("The end date must be on or after the start date.");
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  params.set("timezone", options.timezone ?? REPORT_TIMEZONE);
  if (options.groupBy) params.set("group_by", options.groupBy);
  if (options.page) params.set("page", String(options.page));
  if (options.pageSize) params.set("page_size", String(options.pageSize));
  for (const [key, value] of Object.entries(options.filters ?? {})) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function dateInReportTimezone(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function todayIso() {
  return dateInReportTimezone(new Date());
}

export function monthStartIso() {
  return `${todayIso().slice(0, 7)}-01`;
}

export function DateRangeControls({ dateFrom, dateTo, onDateFromChange, onDateToChange, onToday, onThisMonth }: {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onToday: () => void;
  onThisMonth: () => void;
}) {
  return <div className="flex flex-wrap items-end gap-2 rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95 p-3 text-[10px] text-[#55463a]">
    <label className="grid gap-1">From<input type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} className="h-8 rounded-md border border-[#e2d6c6] bg-white px-2 text-[10px] outline-none" /></label>
    <label className="grid gap-1">To<input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => onDateToChange(event.target.value)} className="h-8 rounded-md border border-[#e2d6c6] bg-white px-2 text-[10px] outline-none" /></label>
    <button type="button" onClick={onToday} className="h-8 rounded-md border border-[#e2d6c6] bg-white px-3 text-[10px] hover:bg-[#f0e5d4]">Today</button>
    <button type="button" onClick={onThisMonth} className="h-8 rounded-md border border-[#e2d6c6] bg-white px-3 text-[10px] hover:bg-[#f0e5d4]">This month</button>
  </div>;
}

export function MetricCard({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return <article className="min-h-[88px] rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95 p-3.5 shadow-sm"><p className="m-0 text-[10px] text-[#76685c]">{label}</p><strong className="mt-3 block text-xl text-[#392d26]">{value}</strong>{note && <p className="mb-0 mt-1 text-[9px] text-[#9a8d81]">{note}</p>}</article>;
}

export function LoadingCards({ count = 4 }: { count?: number }) {
  return <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: count }, (_, index) => <div key={index} className="min-h-[88px] animate-pulse rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/85" />)}</div>;
}

export function ReportTable({ headers, children, empty, loading, hasRows }: { headers: string[]; children: ReactNode; empty: string; loading: boolean; hasRows: boolean }) {
  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95 shadow-sm"><div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[680px] border-collapse text-left"><thead className="sticky top-0 bg-[#f0e5d4] text-[9px] font-medium text-[#4b3b2f]"><tr className="h-8 border-b border-[#e2d6c6]">{headers.map((header, index) => <th key={header} className={`px-3 ${index === headers.length - 1 ? "text-right" : ""}`}>{header}</th>)}</tr></thead><tbody className="text-[10px] text-[#55463a]">{children}</tbody></table></div>{loading ? <p className="m-auto py-10 text-center text-[10px] text-[#9a8d81]">Loading report…</p> : !hasRows ? <p className="m-auto py-10 text-center text-[10px] text-[#9a8d81]">{empty}</p> : null}</div>;
}

export function ReportUnavailable({ title, detail }: { title: string; detail: string }) {
  return <section className="rounded-xl border border-dashed border-[#d8c6b2] bg-[#fcf9f4]/95 p-5 text-[#55463a]"><h2 className="m-0 text-sm font-semibold">{title}</h2><p className="mb-0 mt-2 max-w-2xl text-[11px] leading-5 text-[#76685c]">{detail}</p><p className="mb-0 mt-3 text-[10px] text-[#9a8d81]">This screen intentionally does not calculate or invent financial, compliance, or audit records in the browser.</p></section>;
}
