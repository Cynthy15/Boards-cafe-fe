"use client";

import ResponsiveNavigation from "../ResponsiveNavigation";

import { type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import brandImage from "../../../images/ima.png";
import beansImage from "../../../images/image.png";
import WorkspaceRoleGuard from "../WorkspaceRoleGuard";
import ProfileBadge from "../ProfileBadge";
import { PermissionRouteGuard, useAccessControl } from "../AccessControl";

const BASE = "/dashboard/admin";
const ACCOUNT = `${BASE}/account`;

type IconName = "floor" | "card" | "user" | "building" | "cart" | "users" | "home" | "transactions" | "inventory" | "contacts" | "reports";

const iconPaths: Record<IconName, ReactNode> = {
  floor: <><rect x="6" y="3" width="12" height="18" rx="1" /><path d="M9.5 7h1M13.5 7h1M9.5 11h1M13.5 11h1M10 21v-4h4v4" /></>,
  card: <><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  building: <><rect x="6" y="3" width="12" height="18" rx="1" /><path d="M9.5 7h1M13.5 7h1M9.5 11h1M13.5 11h1M10 21v-4h4v4" /></>,
  cart: <><path d="M3 4h2.5l2 11h10l2-8H7" /><circle cx="9" cy="19" r="1.3" /><circle cx="17" cy="19" r="1.3" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20M16 5.5a3 3 0 0 1 0 5.8m2 3.2a5 5 0 0 1 2.5 4.3V20" /></>,
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
  { label: "Management", href: `${ACCOUNT}/staff-accounts`, icon: "users" },
];

const accountNav: { label: string; href: string; icon: IconName }[] = [
  { label: "Tables", href: `${ACCOUNT}/floors`, icon: "floor" },
  { label: "Payment Methods", href: `${ACCOUNT}/payment-methods`, icon: "card" },
  { label: "Business", href: `${ACCOUNT}/business-details`, icon: "building" },
  { label: "User Management", href: `${ACCOUNT}/staff-accounts`, icon: "users" },
  { label: "Roles & Permissions", href: `${ACCOUNT}/roles`, icon: "users" },
];

type AccountShellProps = {
  /** Last part of the breadcrumb, e.g. "Tables" or "Profile Settings". */
  crumb: string;
  searchPlaceholder?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  createLabel?: string;
  onCreate?: () => void;
  requiredPermission?: string;
  createPermission?: string;
  children: ReactNode;
};

export default function AccountShell({ crumb, createLabel = "Create New", onCreate, requiredPermission = "settings.view", createPermission = "settings.update", children }: AccountShellProps) {
  const pathname = usePathname();
  const { can } = useAccessControl();


  const itemClass = (active: boolean) =>
    `flex min-h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[11px] no-underline transition ${active ? "bg-[#eadcc8] font-semibold text-[#2b1d15]" : "text-[#5f5043] hover:bg-[#eadcc8]/70"}`;

  return (
    <PermissionRouteGuard permission={requiredPermission} fallback={BASE}>
    <div className="workspace-shell grid min-h-svh w-full grid-cols-[minmax(0,1fr)] bg-[#f7f0e7] text-[#392d26] lg:grid-cols-[172px_192px_minmax(0,1fr)]">
      <WorkspaceRoleGuard role="admin" />
      {/* main navigation */}
      <aside className="flex flex-col bg-[#2b180f] px-3.5 py-4 text-[#e9ddd1] lg:sticky lg:top-0 lg:h-svh">
        <Link href="/" className="mb-5 flex items-center gap-2 px-1 text-white no-underline">
          <Image src={brandImage} alt="Boards Café" width={32} height={32} className="rounded-full" />
          <strong className="text-base tracking-tight">BOARDS</strong>
        </Link>
        <ResponsiveNavigation main label="Menu"><nav aria-label="Main navigation" className="flex min-w-0 gap-1 overflow-x-auto lg:grid lg:content-start">
          {mainNav.filter(({ label }) => label === "Home" ? can("dashboard.view") : label === "Transactions" ? can(["sales.view", "purchasing.view", "finance.view", "production.view"]) : label === "Inventory" ? can("inventory.view") : label === "Contacts" ? can("contacts.view") : label === "Reports" ? can("reports.view") : can("users.view")).map(({ label, href, icon }) => (
            <Link key={label} href={href} className="flex min-h-9 shrink-0 items-center gap-2.5 rounded-md px-2.5 text-xs text-[#cbbcaf] no-underline transition hover:bg-[#805336] hover:text-white">
              <Icon name={icon} /><span>{label}</span>
            </Link>
          ))}
        </nav><ProfileBadge role="admin" active={pathname === `${ACCOUNT}/my-profile`} /></ResponsiveNavigation>

      </aside>

      {/* account navigation */}
      <aside className="flex flex-col border-b border-[#e9dfd3] bg-[#f1e7d7] px-3 py-3 lg:sticky lg:top-0 lg:h-svh lg:border-b-0 lg:border-r lg:px-3.5 lg:py-4">
        <Link href={ACCOUNT} className="mb-3 px-1.5 text-[15px] font-semibold text-[#2b1d15] no-underline">Management</Link>
        <ResponsiveNavigation label="Section menu"><nav aria-label="Account navigation" className="flex min-w-0 gap-1 overflow-x-auto lg:grid lg:content-start lg:gap-1.5">
          {accountNav.filter(({ label }) => label === "User Management" ? can("users.view") : label === "Roles & Permissions" ? can("roles.view") : true).map(({ label, href, icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`${itemClass(active)} shrink-0`}>
                <Icon name={icon} />{label}
              </Link>
            );
          })}
        </nav></ResponsiveNavigation>
      </aside>

      {/* content */}
      <main className="relative flex min-h-svh min-w-0 flex-col bg-cover bg-center" style={{ backgroundImage: `linear-gradient(rgba(249,244,236,.82),rgba(249,244,236,.82)),url("${beansImage.src}")` }}>
        <header className="relative z-10 flex min-h-[45px] shrink-0 flex-wrap items-center gap-3 border-b border-[#e8ded2] bg-[#faf0dd]/95 px-4 py-1.5 sm:flex-nowrap">
          <div className="flex min-w-fit items-center gap-2 text-[10px] text-[#918477]">
            <Link href={BASE} className="text-inherit no-underline hover:underline">Home</Link><span aria-hidden="true">›</span><span>{crumb}</span>
          </div>

          {onCreate && can(createPermission) && (
            <button type="button" onClick={onCreate} className="ml-auto flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#28180f] px-4 text-[11px] font-semibold text-white transition hover:bg-[#4a2d1b]">
              <span aria-hidden="true">+</span>{createLabel}
            </button>
          )}
        </header>

        <div className="relative z-10 flex-1 p-4 sm:p-5">{children}</div>
      </main>
    </div>
    </PermissionRouteGuard>
  );
}
