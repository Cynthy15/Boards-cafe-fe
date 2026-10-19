import ResponsiveNavigation from "../ResponsiveNavigation";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import ProfileBadge from "../ProfileBadge";
import WorkspaceRoleGuard from "../WorkspaceRoleGuard";
import { PermissionRouteGuard, useAccessControl, type PermissionRequirement } from "../AccessControl";

import brandImage from "../../../images/ima.png";
import beansImage from "../../../images/image.png";

export type TransactionRole = "admin" | "user";

const transactionLinks = [
  { label: "Sales", path: "/sales" },
  { label: "Purchases", path: "/purchases" },
  { label: "Production", path: "/production" },
  { label: "Expenses", path: "/expenses" },
  { label: "Orders", path: "/orders" },
];

type TransactionLayoutProps = {
  role: TransactionRole;
  title: string;
  search: string;
  createLabel?: string;
  requiredPermission?: PermissionRequirement;
  createPermission?: PermissionRequirement;
  onSearchChange: (value: string) => void;
  onCreate?: () => void;
  children: ReactNode;
};

export function TransactionLayout({
  role,
  title,
  createLabel,
  requiredPermission,
  createPermission,
  onCreate,
  children,
}: TransactionLayoutProps) {
  const base = `/dashboard/${role}/transactions`;
  const { can } = useAccessControl();

  return (
    <PermissionRouteGuard permission={requiredPermission} fallback={`/dashboard/${role}`}>
    <div className="workspace-shell grid min-h-svh w-full grid-cols-[minmax(0,1fr)] bg-[#f7f0e7] text-[#392d26] lg:grid-cols-[172px_156px_minmax(0,1fr)]">
      <WorkspaceRoleGuard role={role} />
      <aside className="flex flex-col bg-[#2b180f] px-3.5 py-4 text-[#e9ddd1] lg:sticky lg:top-0 lg:h-svh">
        <Link href="/" className="mb-5 flex items-center gap-2 px-1 text-white no-underline">
          <Image src={brandImage} alt="Boards Café" width={32} height={32} className="rounded-full" />
          <strong className="text-base tracking-tight">BOARDS</strong>
        </Link>
        <ResponsiveNavigation main label="Menu"><nav aria-label="Main navigation" className="flex min-w-0 gap-1 overflow-x-auto lg:grid lg:content-start">
          {[
            { label: "Home", href: `/dashboard/${role}` },
            { label: "Transactions", href: base },
            { label: "Inventory", href: `/dashboard/${role}/inventory` },
            { label: "Contacts", href: `/dashboard/${role}/contacts` },
            { label: "Reports", href: `/dashboard/${role}/reports` },
            ...(role === "admin" && can("users.view") ? [{ label: "Management", href: "/dashboard/admin/account/staff-accounts" }] : []),
          ].filter(({ label }) => label === "Home" ? can("dashboard.view") : label === "Transactions" ? can(["sales.view", "purchasing.view", "finance.view", "production.view"]) : label === "Inventory" ? can("inventory.view") : label === "Contacts" ? can("contacts.view") : can("reports.view")).map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              aria-current={label === "Transactions" ? "page" : undefined}
              className={`flex min-h-9 items-center rounded-md px-2.5 text-xs no-underline transition ${label === "Transactions" ? "bg-[#805336] text-white" : "text-[#cbbcaf] hover:bg-[#805336] hover:text-white"}`}
            >
              {label}
            </Link>
          ))}
        </nav><ProfileBadge role={role} /></ResponsiveNavigation>

      </aside>

      <aside className="flex flex-col border-b border-[#e9dfd3] bg-[#f1e7d7] px-3 py-3 lg:sticky lg:top-0 lg:h-svh lg:border-b-0 lg:border-r lg:px-3.5 lg:py-4">
        <Link href={`/dashboard/${role}`} className="mb-3 flex items-center gap-2 px-1.5 text-[13px] font-semibold text-[#432f22] no-underline">
          {/* <Image src={brandImage} alt="" width={25} height={25} className="h-6 w-6 rounded-full object-cover" /> */}
          Transactions
        </Link>
        <ResponsiveNavigation label="Section menu"><nav aria-label="Transaction navigation" className="flex min-w-0 gap-1 overflow-x-auto lg:grid lg:content-start">
          {transactionLinks.filter(({ label }) => label === "Sales" || label === "Orders" ? can("sales.view") : label === "Purchases" ? can("purchasing.view") : label === "Production" ? can("production.view") : can("finance.view")).map(({ label, path }) => (
            <Link
              key={label}
              href={`${base}${path}`}
              aria-current={label === title ? "page" : undefined}
              className={`flex min-h-8 items-center rounded-md px-2 text-[10px] no-underline transition ${label === title ? "bg-[#eadcc8] font-medium text-[#4d3828]" : "text-[#78695c] hover:bg-[#eadcc8] hover:text-[#4d3828]"}`}
            >
              {label}
            </Link>
          ))}
        </nav></ResponsiveNavigation>
      </aside>

      <main
        className="relative flex min-h-svh min-w-0 flex-col bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(rgba(249, 244, 236, 0.78), rgba(249, 244, 236, 0.78)), url("${beansImage.src}")`,
        }}
      >
        <header className="relative z-10 flex min-h-11.25 shrink-0 flex-wrap items-center gap-2 border-b border-[#e8ded2] bg-[#fbf6ed]/95 px-3 sm:flex-nowrap sm:px-4">
          <div className="flex min-w-fit items-center gap-2 text-[10px] text-[#918477]">
            <Link href={`/dashboard/${role}`} className="hover:text-[#5c3d28]">Home</Link>
            <span className="text-[#c1b4a5]">›</span>
            <span className="text-[#5a493d]">{title}</span>
          </div>

          {onCreate && can(createPermission) && <button type="button" onClick={onCreate} className="ml-auto flex h-7 items-center gap-1 rounded-md bg-[#28180f] px-2.5 text-[10px] font-medium text-white hover:bg-[#4a2d1b]">
            ＋ {createLabel ?? "Create New"}
          </button>}
        </header>

        {children}
      </main>
    </div>
    </PermissionRouteGuard>
  );
}

export function TransactionDialog({
  title,
  description,
  labelledBy,
  onClose,
  children,
}: {
  title: string;
  description: string;
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#21130f]/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="max-h-[90svh] w-full max-w-xl overflow-y-auto rounded-xl border border-[#e5dacd] bg-[#fcf9f4] p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id={labelledBy} className="m-0 text-lg font-semibold">{title}</h2>
            <p className="mb-0 mt-1 text-xs text-[#8e8074]">{description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close form" className="rounded-md px-2 py-1 text-lg leading-none text-[#817367] hover:bg-[#f0e5d4]">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}

export const fieldClassName = "h-9 rounded-md border border-[#e2d6c6] bg-white px-3 text-sm outline-none focus:border-[#805336]";
export const labelClassName = "grid gap-1.5 text-xs font-medium text-[#55463a]";
export const actionButtonClassName = "rounded-md px-2 py-1 text-[#805336] hover:bg-[#f0e5d4]";
export const deleteButtonClassName = "rounded-md px-2 py-1 text-[#9b5549] hover:bg-[#f7e7e3]";

export function formatTransactionMoney(value: string | number) {
  return `Rwf ${Number(value || 0).toLocaleString()}`;
}
