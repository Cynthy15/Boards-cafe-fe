"use client";

import { recordReference } from "@/lib/display-reference";

import Image from "next/image";
import Link from "next/link";
import ProfileBadge from "./ProfileBadge";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { boardsApi, listApiRecords, subscribeToApiDataChanges, type ApiRecord } from "../../../lib/api-client";
import WorkspaceRoleGuard from "./WorkspaceRoleGuard";
import { useAccessControl } from "./AccessControl";
import beansImage from "../../images/image.png";
import brandImage from "../../images/ima.png";

type DashboardPageProps = { role: "admin" | "user" };
type IconName = "home" | "transactions" | "inventory" | "contacts" | "reports" | "account" | "activity" | "arrow";
type DashboardReports = { sales: ApiRecord; expenses: ApiRecord; purchases: ApiRecord };
type ActivityMetric = { label: string; value: number; note: string };

const navigation: { label: string; icon: IconName; href: string }[] = [
	{ label: "Home", icon: "home", href: "" },
	{ label: "Transactions", icon: "transactions", href: "/transactions" },
	{ label: "Inventory", icon: "inventory", href: "/inventory" },
	{ label: "Contacts", icon: "contacts", href: "/contacts" },
	{ label: "Reports", icon: "reports", href: "/reports" },
];

const defaultMetrics: { label: string; key: string }[] = [
  { label: "Sales", key: "total_sales" },
  { label: "Total Purchases", key: "purchase_total" },
  { label: "Total Expenses", key: "total_expenses" },
  { label: "Stock Items", key: "total_inventory_items" },
  { label: "Pending Orders", key: "pending_order_count" },
  { label: "Low Stock Items", key: "low_stock_item_count" },
];

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return `Rwf ${Number.isFinite(amount) ? amount.toLocaleString("en-RW", { maximumFractionDigits: 2 }) : "0"}`;
}

function records(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is ApiRecord => !!item && typeof item === "object") : [];
}

function numericValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function TransactionActivityChart({ items }: { items: ActivityMetric[] }) {
  const width = 440;
  const height = 226;
  const bounds = { top: 26, right: 14, bottom: 50, left: 52 };
  const chartWidth = width - bounds.left - bounds.right;
  const chartHeight = height - bounds.top - bounds.bottom;
  const highestValue = Math.max(1, ...items.map(({ value }) => value));
  const tickStep = Math.max(1, Math.ceil(highestValue / 3));
  const maximum = tickStep * 3;
  const ticks = [0, 1, 2, 3].map((step) => step * tickStep);
  const shortLabels: Record<string, string> = { "Completed sales": "Sales" };
  const barSlot = chartWidth / items.length;
  const barWidth = Math.min(58, barSlot * 0.52);
  const y = (value: number) => bounds.top + chartHeight - (value / maximum) * chartHeight;

  return (
    <div className="mt-3 w-full" role="img" aria-label="Bar chart showing transaction counts for orders, completed sales, expenses, and purchases">
      <svg className="block h-auto w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} aria-labelledby="transaction-chart-title transaction-chart-description">
        <title id="transaction-chart-title">Transaction activity</title>
        <desc id="transaction-chart-description">A bar chart comparing counts of orders, completed sales, expenses, and purchases in the selected period.</desc>
        {ticks.map((tick) => {
          const tickY = y(tick);
          return <g key={tick}>
            <line x1={bounds.left} x2={width - bounds.right} y1={tickY} y2={tickY} stroke="#eadfd2" strokeWidth="1" />
            <text x={bounds.left - 9} y={tickY + 5} textAnchor="end" fill="#8b7d70" fontSize="12">{tick.toLocaleString()}</text>
          </g>;
        })}
        <line x1={bounds.left} x2={bounds.left} y1={bounds.top} y2={bounds.top + chartHeight} stroke="#cbbcaf" strokeWidth="1" />
        <line x1={bounds.left} x2={width - bounds.right} y1={bounds.top + chartHeight} y2={bounds.top + chartHeight} stroke="#cbbcaf" strokeWidth="1" />
        <text x="15" y={bounds.top + chartHeight / 2} transform={`rotate(-90 15 ${bounds.top + chartHeight / 2})`} fill="#76685c" fontSize="12" textAnchor="middle">Count</text>
        {items.map((item, index) => {
          const barHeight = (item.value / maximum) * chartHeight;
          const x = bounds.left + barSlot * index + (barSlot - barWidth) / 2;
          const barY = y(item.value);
          return <g key={item.label}>
            <rect x={x} y={barY} width={barWidth} height={barHeight} rx="4" fill="#805336">
              <title>{`${item.label}: ${item.value.toLocaleString()} transactions`}</title>
            </rect>
            <text x={x + barWidth / 2} y={Math.max(bounds.top - 7, barY - 7)} textAnchor="middle" fill="#392d26" fontSize="13" fontWeight="600">{item.value.toLocaleString()}</text>
            <text x={x + barWidth / 2} y={bounds.top + chartHeight + 20} textAnchor="middle" fill="#64584f" fontSize="12">{shortLabels[item.label] ?? item.label}</text>
          </g>;
        })}
        <text x={bounds.left + chartWidth / 2} y={height - 7} textAnchor="middle" fill="#76685c" fontSize="12">Transaction type</text>
      </svg>
    </div>
  );
}

function Icon({ name }: { name: IconName }) {
	const paths: Record<IconName, ReactNode> = {
		home: <><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="4" rx="1"/><rect x="13.5" y="10.5" width="7" height="10" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/></>,
		transactions: <><path d="M4 7h15m0 0-3-3m3 3-3 3M20 17H5m0 0 3-3m-3 3 3 3"/></>,
		inventory: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.8 7.5 4.4 7.5-4.4M12 12.3V21"/></>,
		contacts: <><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20M16 5.5a3 3 0 0 1 0 5.8m2 3.2a5 5 0 0 1 2.5 4.3V20"/></>,
		reports: <><path d="M5 20V11m7 9V4m7 16v-7"/><path d="M3 20.5h18"/></>,
		account: <><circle cx="12" cy="8" r="3.5"/><path d="M4 20a8 8 0 0 1 16 0"/></>,
		activity: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
		arrow: <><path d="M7 17 17 7M7 7h10v10"/></>,
	};
	return <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function DashboardPage({ role }: DashboardPageProps) {
  const base = `/dashboard/${role}`;
  const { can } = useAccessControl();
  const mainNavigation = (role === "admin" ? [...navigation, { label: "Management", icon: "contacts" as const, href: "/account/staff-accounts" }] : navigation).filter(({ label }) => label === "Home" ? can("dashboard.view") : label === "Transactions" ? can(["sales.view", "purchasing.view", "finance.view", "production.view"]) : label === "Inventory" ? can("inventory.view") : label === "Contacts" ? can("contacts.view") : label === "Reports" ? can("reports.view") : can("users.view"));
  const [summary, setSummary] = useState<ApiRecord | null>(null);
  const [orders, setOrders] = useState<ApiRecord[]>([]);
  const [reports, setReports] = useState<DashboardReports | null>(null);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const dateTo = localDate();
      const dashboardQuery = `?period=custom&date_from=2000-01-01&date_to=${dateTo}`;
      const reportQuery = `?date_from=2000-01-01&date_to=${dateTo}`;
      const [dashboard, orderPayload, sales, expenses, purchases] = await Promise.all([
        boardsApi.dashboard(dashboardQuery), boardsApi.orders("?page_size=8"), boardsApi.reports.sales(reportQuery), boardsApi.reports.expenses(reportQuery), boardsApi.reports.purchases(reportQuery),
      ]);
      setSummary(dashboard);
      setOrders(listApiRecords(orderPayload).slice(0, 8));
      setReports({ sales, expenses, purchases });
      setLoadError("");
    } catch (error: unknown) {
      setSummary(null);
      setOrders([]);
      setReports(null);
      setLoadError(error instanceof Error ? error.message : "Unable to load live dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDashboard(); }, 0);
    const refresh = () => { void loadDashboard(); };
    const unsubscribe = subscribeToApiDataChanges(refresh);
    window.addEventListener("focus", refresh);
    return () => { window.clearTimeout(timer); unsubscribe(); window.removeEventListener("focus", refresh); };
  }, [loadDashboard]);
	const metricValue = (key: string) => {
    if (isLoading) return "Loading…";
    if (!summary) return "—";
    return key.includes("count") || key.includes("items") ? Number(summary[key] ?? 0).toLocaleString() : money(summary[key]);
  };

  const transactionCounts: ActivityMetric[] = reports && summary ? [
    { label: "Orders", value: numericValue(summary.order_count), note: "All orders in the selected period" },
    { label: "Completed sales", value: numericValue(reports.sales.paid_orders), note: "Paid orders from the sales report" },
    { label: "Expenses", value: numericValue(reports.expenses.expense_count), note: "Expense records from the report" },
    { label: "Purchases", value: numericValue(reports.purchases.purchase_count), note: "Purchase records from the report" },
  ] : [];

  const reportCards = reports ? [
    { title: "Top items", note: "BY SALES", rows: records(reports.sales.sales_by_product).slice(0, 3).map((item) => [String(item.product_name ?? "Unnamed product"), money(item.sales)]) },
    { title: "Expense categories", note: "BY AMOUNT", rows: records(reports.expenses.expenses_by_category).slice(0, 3).map((item) => [String(item.category_name ?? "Uncategorized"), money(item.total)]) },
    { title: "Suppliers", note: "BY PURCHASES", rows: records(reports.purchases.purchases_by_supplier).slice(0, 3).map((item) => [String(item.supplier_name ?? "Unnamed supplier"), money(item.total)]) },
  ] : [];
	return (
		<div className="grid min-h-svh w-full bg-[#f7f0e7] text-[#392d26] md:grid-cols-[172px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]">
			<WorkspaceRoleGuard role={role} />
			<aside className="flex flex-col bg-[#2b180f] px-3.5 py-4 text-[#e9ddd1] md:sticky md:top-0 md:h-svh">
				<Link href="/" className="mb-5 flex items-center gap-2 px-1 text-white no-underline"><Image src={brandImage} alt="Boards Café" width={32} height={32} className="rounded-full"/><strong className="text-base tracking-tight">BOARDS</strong></Link>
				<nav aria-label="Main navigation" className="flex gap-1 overflow-x-auto md:grid md:content-start">
					{mainNavigation.map(({ label, icon, href }, i) => <Link key={label} href={`${base}${href}`} aria-current={i === 0 ? "page" : undefined} className={`flex min-h-9 shrink-0 items-center gap-2.5 rounded-md px-2.5 text-xs no-underline transition ${i === 0 ? "bg-[#805336] text-white" : "text-[#cbbcaf] hover:bg-[#805336] hover:text-white"}`}><Icon name={icon}/><span>{label}</span></Link>)}
				</nav>
				<ProfileBadge role={role} />
			</aside>
			<main className="flex min-h-svh min-w-0 flex-col bg-cover bg-center" style={{ backgroundImage: `linear-gradient(rgba(249, 241, 224, .82), rgba(249, 241, 224, .82)), url("${beansImage.src}")` }}>
				<header className="flex h-11 shrink-0 items-center gap-4 border-b border-[#ddd1c0] bg-[#faf3e7]/95 px-4">
					<span className="text-[10px] text-[#8b7d70]">Home</span>

				</header>
				<div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col p-3.5 sm:p-[18px]">
					<div className="grid flex-1 gap-3.5 lg:grid-cols-[minmax(0,2.12fr)_minmax(275px,1fr)] lg:grid-rows-[auto_minmax(275px,1fr)_auto]">
						<section aria-label="Business overview" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
							{defaultMetrics.map(({ label, key }) => <article key={key} className="flex min-h-[84px] flex-col justify-between rounded-[10px] border border-[#e2d8cb]/90 bg-[#fffdf9]/95 p-3.5 shadow-sm"><span className="flex items-center gap-2 text-[10px] text-[#64584f]"><Icon name="activity"/>{label}</span><strong className="text-[21px] leading-none tracking-tight">{metricValue(key)}</strong></article>)}
						</section>
						<section className="rounded-[10px] border border-[#e2d8cb]/90 bg-[#fffdf9]/95 p-3.5 shadow-sm lg:col-start-2 lg:row-span-2">
							<div className="mb-3"><h1 className="m-0 text-sm font-semibold">Latest Orders</h1><p className="mb-0 mt-2 text-[9px] text-[#988a7e]">Live data from the Boards Cafe API</p></div>
              {loadError && <p role="status" className="rounded-md bg-red-50 p-2 text-[10px] text-red-700">{loadError}</p>}
              <ul className="m-0 list-none p-0">{orders.map((order, index) => { const id = String(order.id ?? order.order_number ?? order.reference ?? `order-${index}`); const amount = order.total_amount ?? order.total ?? order.grand_total ?? 0; const status = String(order.status ?? "Order"); const created = String(order.created_at ?? order.order_date ?? order.date ?? ""); return <li key={id} className="grid min-h-11 grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#eee6dc]"><Icon name="arrow"/><span className="grid gap-1 overflow-hidden text-[9px]"><strong className="truncate font-medium">Order #{recordReference(order.id, order.order_number ?? order.reference ?? id)}</strong><small className="text-[8px] text-[#9a8d81]">{created ? created.slice(0, 10) : status}</small></span><span className="grid justify-items-end gap-1 text-[9px]"><strong>{money(amount)}</strong><small className="text-[8px] text-[#9a8d81]">{status}</small></span></li>; })}</ul>
              {!orders.length && !loadError && <p className="py-8 text-center text-[10px] text-[#9b8d81]">No orders returned by the API.</p>}
						</section>
						<section className="flex min-h-68.75 flex-col rounded-[10px] border border-[#e2d8cb]/90 bg-[#fffdf9]/95 p-3.5 shadow-sm sm:col-span-2 lg:col-span-1 lg:col-start-1 lg:row-start-2"><h2 className="m-0 text-sm font-semibold">Transaction activity</h2><p className="mt-2 text-[9px] text-[#988a7e]">Counts returned by the dashboard and report APIs for the selected period.</p>{transactionCounts.length ? <><TransactionActivityChart items={transactionCounts}/></> : !isLoading && <p className="m-auto text-center text-[10px] text-[#9b8d81]">No transaction counts were returned by the API.</p>}</section>
						<section aria-label="Top business results" className="grid gap-3.5 sm:col-span-2 sm:grid-cols-3 lg:col-span-2 lg:col-start-1 lg:row-start-3">{reportCards.map(({ title, note, rows }) => <article key={title} className="min-h-[118px] rounded-[10px] border border-[#e2d8cb]/90 bg-[#fffdf9]/95 p-3.5 shadow-sm"><div className="flex justify-between"><h2 className="m-0 text-xs font-semibold">{title}</h2><span className="text-[7px] text-[#9c8e81]">{note}</span></div>{rows.length ? <ul className="mt-3 grid list-none gap-2 p-0">{rows.map(([name, value], index) => <li key={`${name}-${index}`} className="flex items-center justify-between gap-2 text-[9px]"><span className="truncate text-[#66584e]">{name}</span><strong className="shrink-0">{value}</strong></li>)}</ul> : <p className="mt-8 text-center text-[9px] text-[#9b8d81]">No rows returned by the report API.</p>}</article>)}</section>
					</div>
				</div>
			</main>
		</div>
	);
}
