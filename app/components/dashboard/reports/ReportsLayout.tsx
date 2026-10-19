"use client";
import { SectionWorkspace, WorkspaceMenuId, SectionSidebar } from "../SectionWorkspace";


import ResponsiveNavigation from "../ResponsiveNavigation";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "../NavigationLink";
import WorkspaceRoleGuard from "../WorkspaceRoleGuard";
import ProfileBadge from "../ProfileBadge";
import { PermissionRouteGuard, useAccessControl } from "../AccessControl";

import brandImage from "../../../images/ima.png";
import beansImage from "../../../images/image.png";

export type ReportsRole = "admin" | "user";
export type ReportTitle =
  | "Reports Overview"
  | "Daily Summary"
  | "Sales Performance"
  | "Inventory & Reorder"
  | "Production & Waste"
  | "Purchasing & Suppliers"
  | "Expense & Profit/Loss"
  | "Audit & Tax Compliance"
  | "Operations Report";

const reportLinks: { label: ReportTitle; path: string; icon: string }[] = [
  { label: "Reports Overview", path: "", icon: "▤" },
  { label: "Daily Summary", path: "/daily", icon: "◷" },
  { label: "Sales Performance", path: "/sales", icon: "▥" },
  { label: "Inventory & Reorder", path: "/inventory", icon: "◇" },
  { label: "Production & Waste", path: "/production", icon: "◫" },
  { label: "Purchasing & Suppliers", path: "/purchases", icon: "▣" },
  { label: "Expense & Profit/Loss", path: "/profit-loss", icon: "◒" },
  { label: "Audit & Tax Compliance", path: "/compliance", icon: "✓" },
];

export function ReportsLayout({
  role,
  title,
  createLabel,
  onCreate,
  actionLabel,
  onAction,
  actionDisabled,
  children,
}: {
  role: ReportsRole;
  title: ReportTitle;
  search?: string;
  onSearchChange?: (value: string) => void;
  createLabel?: string;
  onCreate?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  children: ReactNode;
}) {
  const base = `/dashboard/${role}/reports`;
  const { can } = useAccessControl();

  return (
    <PermissionRouteGuard permission="reports.view" fallback={`/dashboard/${role}`}>
    <SectionWorkspace className="workspace-shell grid min-h-svh w-full grid-cols-[minmax(0,1fr)] bg-[#f7f0e7] text-[#392d26] lg:grid-cols-[172px_156px_minmax(0,1fr)] print:block">
      <WorkspaceRoleGuard role={role} />
      <aside className="flex flex-col bg-[#2b180f] px-3.5 py-4 text-[#e9ddd1] lg:sticky lg:top-0 lg:h-svh print:hidden"><WorkspaceMenuId>
        <Link href="/" className="mb-5 flex items-center gap-2 px-1 text-white no-underline">
          <Image src={brandImage} alt="Boards Café" width={32} height={32} className="rounded-full" />
          <strong className="text-base tracking-tight">BOARDS</strong>
        </Link>
        <ResponsiveNavigation main label="Menu"><nav aria-label="Main navigation" className="flex min-w-0 gap-1 overflow-x-auto lg:grid lg:content-start">
          {[
            { label: "Home", href: `/dashboard/${role}` },
            { label: "Transactions", href: `/dashboard/${role}/transactions` },
            { label: "Inventory", href: `/dashboard/${role}/inventory` },
            { label: "Contacts", href: `/dashboard/${role}/contacts` },
            { label: "Reports", href: base },
            ...(role === "admin" && can("users.view") ? [{ label: "Management", href: "/dashboard/admin/account/staff-accounts" }] : []),
          ].filter(({ label }) => label === "Home" ? can("dashboard.view") : label === "Transactions" ? can(["sales.view", "purchasing.view", "finance.view", "production.view"]) : label === "Inventory" ? can("inventory.view") : label === "Contacts" ? can("contacts.view") : label === "Reports" ? can("reports.view") : true).map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              aria-current={label === "Reports" ? "page" : undefined}
              className={`flex min-h-9 items-center rounded-md px-2.5 text-xs no-underline transition ${label === "Reports" ? "bg-[#805336] text-white" : "text-[#cbbcaf] hover:bg-[#805336] hover:text-white"}`}
            >
              {label}
            </Link>
          ))}
        </nav><ProfileBadge role={role} /></ResponsiveNavigation>

      </WorkspaceMenuId></aside>

      <SectionSidebar className="flex flex-col border-b border-[#e9dfd3] bg-[#f1e7d7] px-3 py-3 lg:sticky lg:top-0 lg:h-svh lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-3.5 lg:py-4 print:hidden">
        <Link href={base} className="mb-3 flex items-center gap-2 px-1.5 text-[13px] font-semibold text-[#432f22] no-underline">Reports</Link>
        <ResponsiveNavigation label="Section menu"><nav aria-label="Reports navigation" className="flex min-w-0 gap-1 overflow-x-auto lg:grid lg:content-start">
          {reportLinks.map(({ label, path, icon }) => (
            <Link
              key={label}
              aria-label={label} title={label}
              href={`${base}${path}`}
              aria-current={label === title ? "page" : undefined}
              className={`flex min-h-8 items-center gap-2 rounded-md px-2 text-[10px] no-underline transition ${label === title ? "bg-[#eadcc8] font-medium text-[#4d3828]" : "text-[#78695c] hover:bg-[#eadcc8] hover:text-[#4d3828]"}`}
            >
              <span className="w-4 text-center">{icon}</span>
              <span className="section-link-label">{label}</span>
            </Link>
          ))}
        </nav></ResponsiveNavigation>
      </SectionSidebar>

      <main
        className="relative flex min-h-svh min-w-0 flex-col bg-cover bg-center"
        style={{ backgroundImage: `linear-gradient(rgba(249, 244, 236, 0.78), rgba(249, 244, 236, 0.78)), url("${beansImage.src}")` }}
      >
        <header className="relative z-10 flex min-h-11.25 shrink-0 flex-wrap items-center gap-2 border-b border-[#e8ded2] bg-[#fbf6ed]/95 px-3 sm:flex-nowrap sm:px-4 print:hidden">
          <div className="flex min-w-fit items-center gap-2 text-[10px] text-[#918477]">
            <Link href={`/dashboard/${role}`} className="hover:text-[#5c3d28]">Home</Link>
            <span className="text-[#c1b4a5]">›</span>
            <span className="text-[#5a493d]">{title}</span>
          </div>

          {actionLabel && (
            <button type="button" onClick={onAction} disabled={actionDisabled} className="flex h-7 items-center rounded-md border border-[#e5dacd] bg-white px-2.5 text-[10px] text-[#55463a] hover:bg-[#f0e5d4] disabled:cursor-not-allowed disabled:opacity-50">
              {actionLabel}
            </button>
          )}
          {onCreate && (
            <button type="button" onClick={onCreate} className="ml-auto flex h-7 items-center gap-1 rounded-md bg-[#28180f] px-2.5 text-[10px] font-medium text-white hover:bg-[#4a2d1b]">
              ＋ {createLabel ?? "Create New"}
            </button>
          )}
        </header>

        {children}
      </main>
    </SectionWorkspace>
    </PermissionRouteGuard>
  );
}
