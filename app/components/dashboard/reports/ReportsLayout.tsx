"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import WorkspaceRoleGuard from "../WorkspaceRoleGuard";

import brandImage from "../../../images/ima.png";
import beansImage from "../../../images/image.png";

export type ReportsRole = "admin" | "user";
export type ReportTitle = "Reports Overview" | "Sales Report" | "Operations Report";

const reportLinks: { label: ReportTitle; path: string; icon: string }[] = [
  { label: "Reports Overview", path: "", icon: "▤" },
  { label: "Sales Report", path: "/sale-tax", icon: "▥" },
  { label: "Operations Report", path: "/ebm-x", icon: "▣" },
];

export function ReportsLayout({
  role,
  title,
  search,
  onSearchChange,
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

  return (
    <div className="grid min-h-svh w-full bg-[#f7f0e7] text-[#392d26] md:grid-cols-[172px_156px_minmax(0,1fr)] print:block">
      <WorkspaceRoleGuard role={role} />
      <aside className="flex flex-col bg-[#2b180f] px-3.5 py-4 text-[#e9ddd1] md:sticky md:top-0 md:h-svh print:hidden">
        <Link href="/" className="mb-5 flex items-center gap-2 px-1 text-white no-underline">
          <Image src={brandImage} alt="Boards Café" width={32} height={32} className="rounded-full" />
          <strong className="text-base tracking-tight">BOARDS</strong>
        </Link>
        <nav aria-label="Main navigation" className="grid content-start gap-1">
          {[
            { label: "Home", href: `/dashboard/${role}` },
            { label: "Transactions", href: `/dashboard/${role}/transactions` },
            { label: "Inventory", href: `/dashboard/${role}/inventory` },
            { label: "Contacts", href: `/dashboard/${role}/contacts` },
            { label: "Reports", href: base },
            ...(role === "admin" ? [{ label: "Staff Management", href: "/dashboard/admin/account/staff-accounts" }] : []),
          ].map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              aria-current={label === "Reports" ? "page" : undefined}
              className={`flex min-h-9 items-center rounded-md px-2.5 text-xs no-underline transition ${label === "Reports" ? "bg-[#805336] text-white" : "text-[#cbbcaf] hover:bg-[#805336] hover:text-white"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-[#4b362a] pt-3">
          {role === "admin" ? <Link href="/dashboard/admin/account" title="Account settings" aria-label="Open account settings" className="-mx-1 mb-2 hidden rounded-md px-1 py-1.5 text-[11px] text-inherit no-underline transition hover:bg-[#805336] hover:text-white md:block">CD</Link> : <div className="mb-2 hidden text-[11px] md:block">US</div>}
          <Link href="/" className="flex min-h-8 items-center gap-2 rounded-md px-2.5 text-xs text-[#cbbcaf] no-underline transition hover:bg-[#805336] hover:text-white" aria-label="Logout">↪ Logout</Link>
        </div>
      </aside>

      <aside className="flex flex-col border-b border-[#e9dfd3] bg-[#f1e7d7] px-3 py-3 md:sticky md:top-0 md:h-svh md:border-b-0 md:border-r md:px-3.5 md:py-4 print:hidden">
        <Link href={base} className="mb-3 flex items-center gap-2 px-1.5 text-[13px] font-semibold text-[#432f22] no-underline">Reports</Link>
        <nav aria-label="Reports navigation" className="grid content-start gap-1">
          {reportLinks.map(({ label, path, icon }) => (
            <Link
              key={label}
              href={`${base}${path}`}
              aria-current={label === title ? "page" : undefined}
              className={`flex min-h-8 items-center gap-2 rounded-md px-2 text-[10px] no-underline transition ${label === title ? "bg-[#eadcc8] font-medium text-[#4d3828]" : "text-[#78695c] hover:bg-[#eadcc8] hover:text-[#4d3828]"}`}
            >
              <span className="w-4 text-center">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>
      </aside>

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
          <label className="flex h-7 min-w-40 flex-1 items-center gap-2 rounded-md border border-[#e6dbcd] bg-white/90 px-2.5">
            <span aria-hidden="true" className="text-[#8e8074]">⌕</span>
            <input
              type="search"
              value={search ?? ""}
              onChange={(event) => onSearchChange?.(event.target.value)}
              placeholder="Search reports or add filters..."
              aria-label={`Search ${title.toLowerCase()}`}
              className="min-w-0 flex-1 bg-transparent text-[10px] outline-none placeholder:text-[#a09286]"
            />
            <kbd className="text-[9px] text-[#8e8074]">⌘K</kbd>
          </label>
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

        <footer className="relative z-10 flex min-h-7 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[#e8ded2] bg-[#fbf6ed]/95 px-3 text-[8px] text-[#9b8d81] sm:px-4 print:hidden">
          <span>© Copyright Kayko 2021 - 2026</span>
          <nav aria-label="Footer links" className="flex items-center gap-3"><a href="#">Support</a><a href="#">Terms</a><a href="#">Privacy policy</a></nav>
        </footer>
      </main>
    </div>
  );
}
