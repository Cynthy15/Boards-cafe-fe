"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import ProfileBadge from "../ProfileBadge";
import WorkspaceRoleGuard from "../WorkspaceRoleGuard";

import brandImage from "../../../images/ima.png";
import beansImage from "../../../images/image.png";

export type ContactsRole = "admin" | "user";

const contactLinks = [
  { label: "Customers", path: "", icon: "♧" },
  { label: "Vendors", path: "/vendors", icon: "▥" },
];

export const contactField = "h-8 w-full rounded-md border border-[#e2d6c6] bg-white px-2.5 text-[10px] outline-none placeholder:text-[#a09286] focus:border-[#805336]";
export const contactLabel = "grid gap-1 text-[10px] font-medium text-[#55463a]";
export const contactAction = "rounded-md px-2 py-1 text-[9px] text-[#805336] hover:bg-[#f0e5d4]";
export const contactDelete = "rounded-md px-2 py-1 text-[9px] text-[#9b5549] hover:bg-[#f7e7e3]";

export function formatContactMoney(value: number) {
  return `Rwf ${Number(value || 0).toLocaleString()}`;
}

export function ContactsLayout({
  role,
  title,
  search,
  onSearchChange,
  onCreate,
  children,
}: {
  role: ContactsRole;
  title: "Customers" | "Vendors";
  search: string;
  onSearchChange: (value: string) => void;
  onCreate?: () => void;
  children: ReactNode;
}) {
  const base = `/dashboard/${role}/contacts`;

  return (
    <div className="grid min-h-svh w-full bg-[#f7f0e7] text-[#392d26] md:grid-cols-[172px_156px_minmax(0,1fr)]">
      <WorkspaceRoleGuard role={role} />
      <aside className="flex flex-col bg-[#2b180f] px-3.5 py-4 text-[#e9ddd1] md:sticky md:top-0 md:h-svh">
        <Link href="/" className="mb-5 flex items-center gap-2 px-1 text-white no-underline">
          <Image src={brandImage} alt="Boards Café" width={32} height={32} className="rounded-full" />
          <strong className="text-base tracking-tight">BOARDS</strong>
        </Link>
        <nav aria-label="Main navigation" className="grid content-start gap-1">
          {[
            { label: "Home", href: `/dashboard/${role}` },
            { label: "Transactions", href: `/dashboard/${role}/transactions` },
            { label: "Inventory", href: `/dashboard/${role}/inventory` },
            { label: "Contacts", href: base },
            { label: "Reports", href: `/dashboard/${role}/reports` },
            ...(role === "admin" ? [{ label: "Staff Management", href: "/dashboard/admin/account/staff-accounts" }] : []),
          ].map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              aria-current={label === "Contacts" ? "page" : undefined}
              className={`flex min-h-9 items-center rounded-md px-2.5 text-xs no-underline transition ${label === "Contacts" ? "bg-[#805336] text-white" : "text-[#cbbcaf] hover:bg-[#805336] hover:text-white"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <ProfileBadge role={role} />
      </aside>

      <aside className="flex flex-col border-b border-[#e9dfd3] bg-[#f1e7d7] px-3 py-3 md:sticky md:top-0 md:h-svh md:border-b-0 md:border-r md:px-3.5 md:py-4">
        <Link href={base} className="mb-3 flex items-center gap-2 px-1.5 text-[13px] font-semibold text-[#432f22] no-underline">Contacts</Link>
        <nav aria-label="Contacts navigation" className="grid content-start gap-1">
          {contactLinks.map(({ label, path, icon }) => (
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
        <header className="relative z-10 flex min-h-11.25 shrink-0 flex-wrap items-center gap-2 border-b border-[#e8ded2] bg-[#fbf6ed]/95 px-3 sm:flex-nowrap sm:px-4">
          <div className="flex min-w-fit items-center gap-2 text-[10px] text-[#918477]">
            <Link href={`/dashboard/${role}`} className="hover:text-[#5c3d28]">Home</Link>
            <span className="text-[#c1b4a5]">›</span>
            <span className="text-[#5a493d]">{title}</span>
          </div>
          <label className="flex h-7 min-w-40 flex-1 items-center gap-2 rounded-md border border-[#e6dbcd] bg-white/90 px-2.5">
            <span aria-hidden="true" className="text-[#8e8074]">⌕</span>
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search contacts or add filters..."
              aria-label={`Search ${title.toLowerCase()}`}
              className="min-w-0 flex-1 bg-transparent text-[10px] outline-none placeholder:text-[#a09286]"
            />
            <kbd className="text-[9px] text-[#8e8074]">⌘K</kbd>
          </label>
          {onCreate && <button type="button" onClick={onCreate} className="ml-auto flex h-7 items-center gap-1 rounded-md bg-[#28180f] px-2.5 text-[10px] font-medium text-white hover:bg-[#4a2d1b]">＋ Create New</button>}
        </header>

        {children}

        <footer className="relative z-10 flex min-h-7 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[#e8ded2] bg-[#fbf6ed]/95 px-3 text-[8px] text-[#9b8d81] sm:px-4">
          <span>© Copyright Kayko 2021 - 2026</span>
          <nav aria-label="Footer links" className="flex items-center gap-3"><a href="#">Support</a><a href="#">Terms</a><a href="#">Privacy policy</a></nav>
        </footer>
      </main>
    </div>
  );
}

/** Right-hand slide-over used for the "Create New Customer / Vendor" screens. */
export function ContactDrawer({
  title,
  description,
  submitLabel,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  description: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-[#21130f]/45" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-label={title} className="absolute inset-y-0 right-0 flex w-full max-w-[340px] flex-col border-l border-[#e5dacd] bg-[#fcf9f4] shadow-2xl">
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-[#ebe2d7] px-4 py-3">
            <div>
              <h2 className="m-0 text-sm font-semibold">{title}</h2>
              <p className="mb-0 mt-1 text-[10px] text-[#8e8074]">{description}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close form" className="rounded-md px-2 text-lg leading-none text-[#817367] hover:bg-[#f0e5d4]">×</button>
          </div>
          <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto px-4 py-4">{children}</div>
          <div className="flex justify-end gap-2 border-t border-[#ebe2d7] px-4 py-3">
            <button type="button" onClick={onClose} className="h-8 rounded-md border border-[#e2d6c6] bg-white px-4 text-[10px]">Cancel</button>
            <button type="submit" className="h-8 rounded-md bg-[#805336] px-4 text-[10px] font-medium text-white hover:bg-[#6a4229]">{submitLabel}</button>
          </div>
        </form>
      </aside>
    </div>
  );
}

/** Individual / Business radio pair shown at the top of both drawers. */
export function TypeRadio({ label, value, onChange }: { label: string; value: "Individual" | "Business"; onChange: (value: "Individual" | "Business") => void }) {
  return (
    <fieldset className="m-0 grid gap-1 border-0 p-0">
      <legend className="mb-1 p-0 text-[10px] font-medium text-[#55463a]">{label}</legend>
      <div className="flex gap-4 text-[10px] text-[#55463a]">
        {(["Individual", "Business"] as const).map((option) => (
          <label key={option} className="flex items-center gap-1.5">
            <input type="radio" name="type" value={option} checked={value === option} onChange={() => onChange(option)} className="accent-[#805336]" />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const PAGE_SIZE = 10;

export type Column<T> = { header: string; render: (row: T) => ReactNode; className?: string };

export function ContactsTable<T extends { id: number }>({
  rows,
  columns,
  emptyTitle,
  emptyHint,
  onEdit,
  onDelete,
}: {
  rows: T[];
  columns: Column<T>[];
  emptyTitle: string;
  emptyHint: string;
  onEdit?: (row: T) => void;
  onDelete?: (id: number) => void;
}) {
  const hasActions = Boolean(onEdit || onDelete);
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const slice = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <section className="relative z-10 flex min-h-0 flex-1 p-3 sm:p-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95 shadow-[0_2px_10px_rgba(72,48,30,0.04)]">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1000px] border-collapse text-left">
            <thead className="sticky top-0 bg-[#f0e5d4] text-[9px] font-medium text-[#4b3b2f]">
              <tr className="h-8 border-b border-[#e2d6c6]">
                <th className="w-8 px-2.5"><input type="checkbox" aria-label="Select all" className="h-3 w-3 accent-[#805336]" /></th>
                {columns.map((column) => <th key={column.header} className="whitespace-nowrap px-2.5">{column.header} ↕</th>)}
                {hasActions && <th className="px-2.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="text-[10px] text-[#55463a]">
              {slice.map((row) => (
                <tr key={row.id} className="h-9 border-b border-[#eee6dc]">
                  <td className="px-2.5"><input type="checkbox" aria-label="Select row" className="h-3 w-3 accent-[#805336]" /></td>
                  {columns.map((column) => <td key={column.header} className={`px-2.5 ${column.className ?? ""}`}>{column.render(row)}</td>)}
                  {hasActions && (
                    <td className="whitespace-nowrap px-2.5 text-right">
                      {onEdit && <button type="button" onClick={() => onEdit(row)} className={contactAction}>Edit</button>}
                      {onDelete && <button type="button" onClick={() => onDelete(row.id)} className={contactDelete}>Delete</button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="flex min-h-40 items-center justify-center text-center">
              <div>
                <p className="m-0 text-[11px] font-medium text-[#897b6f]">{emptyTitle}</p>
                <p className="mb-0 mt-1 text-[9px] text-[#a09387]">{emptyHint}</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex min-h-9 items-center justify-between border-t border-[#ebe2d7] px-3 text-[9px] text-[#817367]">
          <span>Showing {slice.length} of {rows.length} entries</span>
          <span className="flex items-center gap-1">
            <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)} className="rounded px-2 py-1 disabled:opacity-40">Previous</button>
            {Array.from({ length: pages }, (_, index) => index + 1).map((n) => (
              <button key={n} type="button" onClick={() => setPage(n)} aria-current={n === current ? "page" : undefined} className={`rounded px-2 py-1 ${n === current ? "bg-[#805336] text-white" : "hover:bg-[#f0e5d4]"}`}>{n}</button>
            ))}
            <button type="button" disabled={current === pages} onClick={() => setPage(current + 1)} className="rounded px-2 py-1 disabled:opacity-40">Next</button>
          </span>
        </div>
      </div>
    </section>
  );
}
