"use client";

import { usePathname } from "next/navigation";
import Link from "./NavigationLink";
import ProfileBadge from "./ProfileBadge";
import { useAccessControl } from "./AccessControl";
import { createContext, useContext, useId, useState, type ReactNode } from "react";

const MenuContext = createContext<{ open: boolean; toggle: () => void; id: string } | null>(null);

export function SectionWorkspace({ children, className }: { children: ReactNode; className: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <MenuContext.Provider value={{ open, toggle: () => setOpen(!open), id }}>
    <div className={`${className} section-workspace`} data-menu-open={open} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
      <NavigationRail />
      {children}
    </div>
  </MenuContext.Provider>;
}

export function WorkspaceMenuToggle() {
  const menu = useContext(MenuContext);
  if (!menu) return null;
  return <button type="button" className="workspace-menu-toggle" aria-label={menu.open ? "Collapse sidebar to icons" : "Expand sidebar"} aria-expanded={menu.open} aria-controls={menu.id} onClick={menu.toggle}>☰ <span>Menu</span></button>;
}

export function WorkspaceMenuId({ children }: { children: ReactNode }) {
  return <div className="workspace-primary-menu">{children}</div>;
}

const railItems = [
  { label: "Home", path: "", permission: "dashboard.view", shape: "M3 10 12 3l9 7v10H3ZM9 20v-7h6v7" },
  { label: "Transactions", path: "/transactions", permission: ["sales.view", "purchasing.view", "finance.view", "production.view"], shape: "M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4" },
  { label: "Inventory", path: "/inventory", permission: "inventory.view", shape: "m12 3 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V8M12 13v10" },
  { label: "Contacts", path: "/contacts", permission: "contacts.view", shape: "M16 21v-2a6 6 0 0 0-12 0v2M10 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM17 4a4 4 0 0 1 0 8m1 3a5 5 0 0 1 3 5" },
  { label: "Reports", path: "/reports", permission: "reports.view", shape: "M4 20V10m8 10V3m8 17v-7M2 21h20" },
  { label: "Management", path: "/account/staff-accounts", permission: "users.view", shape: "M4 21V3h16v18M8 7h2m4 0h2M8 11h2m4 0h2M10 21v-5h4v5" },
];

function NavigationRail() {
  const menu = useContext(MenuContext);
  const pathname = usePathname();
  const { can } = useAccessControl();
  const role = pathname.startsWith("/dashboard/admin") ? "admin" : "user";
  const base = `/dashboard/${role}`;
  return <div className="workspace-icon-rail">
    <WorkspaceMenuToggle />
    <nav id={menu?.id} aria-label="Main navigation">
      {railItems.filter((item) => (item.label !== "Management" || role === "admin") && can(item.permission)).map((item) => {
        const href = `${base}${item.path}`;
        const active = item.path ? pathname.startsWith(`${base}${item.path.split("/").slice(0, 2).join("/")}`) : pathname === base;
        return <Link key={item.label} href={href} title={item.label} aria-label={item.label} aria-current={active ? "page" : undefined}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.shape} /></svg><span className="workspace-rail-label">{item.label}</span>
        </Link>;
      })}
    </nav>
    {menu?.open && <ProfileBadge role={role} />}
  </div>;
}

export function SectionSidebar({ children, className }: { children: ReactNode; className: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const id = useId();
  return <aside className={`${className} workspace-section-sidebar`} data-collapsed={collapsed}>
    <button type="button" className="section-sidebar-toggle" aria-label={collapsed ? "Show section labels" : "Hide section labels"} aria-expanded={!collapsed} aria-controls={id} title={collapsed ? "Show section labels" : "Hide section labels"} onClick={() => setCollapsed(!collapsed)}>
      <span aria-hidden="true">{collapsed ? "»" : "«"}</span>
    </button>
    <div id={id} className="section-sidebar-content">{children}</div>
  </aside>;
}
