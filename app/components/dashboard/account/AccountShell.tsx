"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import brandImage from "../../../images/ima.png";
import beansImage from "../../../images/image.png";
import { boardsApi, listApiRecords, logoutFromApi, type ApiRecord } from "../../../../lib/api-client";
import { Dialog, secondaryButton } from "./ui";
import WorkspaceRoleGuard from "../WorkspaceRoleGuard";

const BASE = "/dashboard/admin";
const ACCOUNT = `${BASE}/account`;

type IconName = "monitor" | "floor" | "card" | "user" | "building" | "cart" | "users" | "switch" | "logout" | "home" | "transactions" | "inventory" | "contacts" | "reports";

const iconPaths: Record<IconName, ReactNode> = {
  monitor: <><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M8 20h8M12 16v4" /></>,
  floor: <><rect x="6" y="3" width="12" height="18" rx="1" /><path d="M9.5 7h1M13.5 7h1M9.5 11h1M13.5 11h1M10 21v-4h4v4" /></>,
  card: <><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  building: <><rect x="6" y="3" width="12" height="18" rx="1" /><path d="M9.5 7h1M13.5 7h1M9.5 11h1M13.5 11h1M10 21v-4h4v4" /></>,
  cart: <><path d="M3 4h2.5l2 11h10l2-8H7" /><circle cx="9" cy="19" r="1.3" /><circle cx="17" cy="19" r="1.3" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20M16 5.5a3 3 0 0 1 0 5.8m2 3.2a5 5 0 0 1 2.5 4.3V20" /></>,
  switch: <><rect x="6" y="3" width="12" height="18" rx="1" /><path d="M9.5 7h1M13.5 7h1M9.5 11h1M13.5 11h1M10 21v-4h4v4" /></>,
  logout: <><path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9M15 8l4 4-4 4M19 12H9" /></>,
  home: <><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="3.5" width="7" height="4" rx="1" /><rect x="13.5" y="10.5" width="7" height="10" rx="1" /><rect x="3.5" y="13.5" width="7" height="7" rx="1" /></>,
  transactions: <path d="M4 7h15m0 0-3-3m3 3-3 3M20 17H5m0 0 3-3m-3 3 3 3" />,
  inventory: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.8 7.5 4.4 7.5-4.4M12 12.3V21" /></>,
  contacts: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20M16 5.5a3 3 0 0 1 0 5.8m2 3.2a5 5 0 0 1 2.5 4.3V20" /></>,
  reports: <><path d="M5 20V11m7 9V4m7 16v-7" /><path d="M3 20.5h18" /></>,
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {iconPaths[name]}
    </svg>
  );
}

const mainNav: { label: string; href: string; icon: IconName }[] = [
  { label: "Home", href: BASE, icon: "home" },
  { label: "Transactions", href: `${BASE}/transactions`, icon: "transactions" },
  { label: "Inventory", href: `${BASE}/inventory`, icon: "inventory" },
  { label: "Contacts", href: `${BASE}/contacts`, icon: "contacts" },
  { label: "Reports", href: `${BASE}/reports`, icon: "reports" },
  { label: "Staff Management", href: `${ACCOUNT}/staff-accounts`, icon: "users" },
];

const accountNav: { label: string; href: string; icon: IconName }[] = [
  { label: "Stations", href: `${ACCOUNT}/stations`, icon: "monitor" },
  { label: "Floors", href: `${ACCOUNT}/floors`, icon: "floor" },
  { label: "Payment Methods", href: `${ACCOUNT}/payment-methods`, icon: "card" },
  { label: "My Profile", href: `${ACCOUNT}/my-profile`, icon: "user" },
  { label: "Business Details", href: `${ACCOUNT}/business-details`, icon: "building" },
  { label: "E-commerce", href: `${ACCOUNT}/e-commerce`, icon: "cart" },
  { label: "User Management", href: `${ACCOUNT}/staff-accounts`, icon: "users" },
  { label: "Roles & Permissions", href: `${ACCOUNT}/roles`, icon: "users" },
];

type AccountShellProps = {
  /** Last part of the breadcrumb, e.g. "Stations" or "Profile Settings". */
  crumb: string;
  searchPlaceholder?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  createLabel?: string;
  onCreate?: () => void;
  children: ReactNode;
};

export default function AccountShell({ crumb, searchPlaceholder = "Search...", search = "", onSearchChange, createLabel = "Create New", onCreate, children }: AccountShellProps) {
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);
  const [switching, setSwitching] = useState(false);

  // ⌘K / Ctrl+K focuses the search box.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const itemClass = (active: boolean) =>
    `flex min-h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[11px] no-underline transition ${active ? "bg-[#eadcc8] font-semibold text-[#2b1d15]" : "text-[#5f5043] hover:bg-[#eadcc8]/70"}`;

  return (
    <div className="grid min-h-svh w-full bg-[#f7f0e7] text-[#392d26] md:grid-cols-[172px_192px_minmax(0,1fr)]">
      <WorkspaceRoleGuard role="admin" />
      {/* main navigation */}
      <aside className="flex flex-col bg-[#2b180f] px-3.5 py-4 text-[#e9ddd1] md:sticky md:top-0 md:h-svh">
        <Link href="/" className="mb-5 flex items-center gap-2 px-1 text-white no-underline">
          <Image src={brandImage} alt="Boards Café" width={32} height={32} className="rounded-full" />
          <strong className="text-base tracking-tight">BOARDS</strong>
        </Link>
        <nav aria-label="Main navigation" className="flex gap-1 overflow-x-auto md:grid md:content-start">
          {mainNav.map(({ label, href, icon }) => (
            <Link key={label} href={href} className="flex min-h-9 shrink-0 items-center gap-2.5 rounded-md px-2.5 text-xs text-[#cbbcaf] no-underline transition hover:bg-[#805336] hover:text-white">
              <Icon name={icon} /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-[#4b362a] pt-3 text-[11px] md:block">
          <Link href={ACCOUNT} aria-current="page" title="Account settings" className="-mx-1 block rounded-md bg-[#805336] px-1 py-1.5 text-white no-underline">CD</Link>
        </div>
      </aside>

      {/* account navigation */}
      <aside className="flex flex-col border-b border-[#e9dfd3] bg-[#f1e7d7] px-3 py-3 md:sticky md:top-0 md:h-svh md:border-b-0 md:border-r md:px-3.5 md:py-4">
        <Link href={ACCOUNT} className="mb-3 px-1.5 text-[15px] font-semibold text-[#2b1d15] no-underline">Account</Link>
        <nav aria-label="Account navigation" className="flex gap-1 overflow-x-auto md:grid md:content-start md:gap-1.5">
          {accountNav.map(({ label, href, icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`${itemClass(active)} shrink-0`}>
                <Icon name={icon} />{label}
              </Link>
            );
          })}
          <button type="button" onClick={() => setSwitching(true)} className={`${itemClass(false)} shrink-0`}>
            <Icon name="switch" />Switch Business
          </button>
          <Link href="/" onClick={() => { void logoutFromApi(); }} className={`${itemClass(false)} shrink-0`}>
            <Icon name="logout" />Log out
          </Link>
        </nav>
      </aside>

      {/* content */}
      <main className="relative flex min-h-svh min-w-0 flex-col bg-cover bg-center" style={{ backgroundImage: `linear-gradient(rgba(249,244,236,.82),rgba(249,244,236,.82)),url("${beansImage.src}")` }}>
        <header className="relative z-10 flex min-h-[45px] shrink-0 flex-wrap items-center gap-3 border-b border-[#e8ded2] bg-[#faf0dd]/95 px-4 py-1.5 sm:flex-nowrap">
          <div className="flex min-w-fit items-center gap-2 text-[10px] text-[#918477]">
            <Link href={BASE} className="text-inherit no-underline hover:underline">Home</Link><span aria-hidden="true">›</span><span>{crumb}</span>
          </div>
          <label className="flex h-8 min-w-40 flex-1 items-center gap-2 rounded-lg border border-[#e6dbcd] bg-[#fffaf3] px-3">
            <span aria-hidden="true" className="text-[#6f6054]">⌕</span>
            <input ref={searchRef} type="search" aria-label="Search" value={search} onChange={(e) => onSearchChange?.(e.target.value)} placeholder={searchPlaceholder} className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-[#9a8c80]" />
            <kbd className="text-[10px] text-[#8b7d70]">⌘K</kbd>
          </label>
          {onCreate && (
            <button type="button" onClick={onCreate} className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#28180f] px-4 text-[11px] font-semibold text-white transition hover:bg-[#4a2d1b]">
              <span aria-hidden="true">+</span>{createLabel}
            </button>
          )}
        </header>

        <div className="relative z-10 flex-1 p-4 sm:p-5">{children}</div>

        <footer className="relative z-10 flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[#e8ded2] bg-[#fbf6ed]/95 px-4 text-[9px] text-[#9b8d81]">
          <span>© Copyright Kayko 2021 - 2026</span>
          <nav className="flex gap-3"><a href="#">Support</a><a href="#">Terms</a><a href="#">Privacy policy</a></nav>
        </footer>
      </main>

      {switching && <SwitchBusinessDialog onClose={() => setSwitching(false)} />}
    </div>
  );
}

function SwitchBusinessDialog({ onClose }: { onClose: () => void }) {
  const [businesses, setBusinesses] = useState<ApiRecord[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => { void boardsApi.businesses().then((payload) => setBusinesses(listApiRecords(payload))).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load businesses.")); }, 0); return () => window.clearTimeout(timer); }, []);

  return (
    <Dialog title="Businesses" description="Businesses listed below come from the API." onClose={onClose}>
      {error && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}
      <div className="grid gap-2">{businesses.map((business) => <div key={String(business.id)} className="rounded-lg border border-[#e6dccd] p-3"><p className="m-0 text-[12px] font-semibold text-[#2b1d15]">{String(business.name ?? business.legal_name ?? `Business #${business.id}`)}</p><p className="mb-0 mt-1 text-[10px] text-[#7b6d61]">{business.is_active === true ? "Active business" : "Business profile"}</p></div>)}{!businesses.length && !error && <p className="m-0 text-[10px] text-[#7b6d61]">Loading businesses…</p>}</div>
      <p className="mb-0 mt-3 text-[10px] leading-4 text-[#8b7d70]">The API has no documented endpoint to select an active workspace business, so this app does not fake a switch in local storage. Add an explicit active-business endpoint to enable switching.</p>
      <div className="mt-4 flex justify-end"><button type="button" onClick={onClose} className={secondaryButton}>Close</button></div>
    </Dialog>
  );
}
