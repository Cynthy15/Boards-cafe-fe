import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import ProfileBadge from "../ProfileBadge";
import WorkspaceRoleGuard from "../WorkspaceRoleGuard";
import { PermissionRouteGuard, useAccessControl } from "../AccessControl";
import brandImage from "../../../images/ima.png";
import beansImage from "../../../images/image.png";

export type InventoryRole = "admin" | "user";

const links = [
  ["Categories", "categories", "▱"], ["Inventory Items", "items", "◇"], ["Products", "products", "◇"], ["Services", "services", "▥"],
  ["Recipes", "recipes", "☷"], ["Assets", "assets", "▤"], ["Add-ons", "add-ons", "♧"],
  ["Stock Count", "stock-count", "▣"], ["Stock Transfer", "stock-transfer", "♧"],
] as const;

export function InventoryLayout({ role, title, createLabel = "Create New", createPermission = "inventory.create", onCreate, children }: { role: InventoryRole; title: string; search: string; onSearchChange: (value: string) => void; createLabel?: string; createPermission?: string; onCreate?: () => void; children: ReactNode }) {
  const base = `/dashboard/${role}/inventory`;
  const { can } = useAccessControl();
  return <PermissionRouteGuard permission="inventory.view" fallback={`/dashboard/${role}`}><div className="grid min-h-svh w-full bg-[#f7f0e7] text-[#392d26] md:grid-cols-[172px_192px_minmax(0,1fr)]">
    <WorkspaceRoleGuard role={role} />
    <aside className="flex flex-col bg-[#2b180f] px-3.5 py-4 text-[#e9ddd1] md:sticky md:top-0 md:h-svh">
      <Link href="/" className="mb-5 flex items-center gap-2 px-1 text-white no-underline"><Image src={brandImage} alt="Boards Café" width={32} height={32} className="rounded-full"/><strong className="text-base tracking-tight">BOARDS</strong></Link>
      <nav className="grid content-start gap-1">
        {[['Home',`/dashboard/${role}`,'⌂'],['Transactions',`/dashboard/${role}/transactions`,'⇄'],['Inventory',base,'◇'],['Contacts',`/dashboard/${role}/contacts`,'♧'],['Reports',`/dashboard/${role}/reports`,'▥'], ...(role === 'admin' && can('users.view') ? [['Management','/dashboard/admin/account/staff-accounts','♧']] : [])].filter(([label])=>label==='Home'?can('dashboard.view'):label==='Transactions'?can(['sales.view','purchasing.view','finance.view','production.view']):label==='Inventory'?can('inventory.view'):label==='Contacts'?can('contacts.view'):label==='Reports'?can('reports.view'):true).map(([label,href,icon])=><Link key={label} href={href} className={`flex min-h-9 items-center gap-2.5 rounded-md px-2.5 text-xs no-underline ${label==='Inventory'?'bg-[#805336] text-white':'text-[#cbbcaf] hover:bg-[#805336] hover:text-white'}`}><span>{icon}</span>{label}</Link>)}
      </nav>
      <ProfileBadge role={role} />
    </aside>

    <aside className="flex flex-col border-b border-[#e9dfd3] bg-[#f1e7d7] px-3 py-3 md:sticky md:top-0 md:h-svh md:border-b-0 md:border-r md:px-3.5 md:py-4">
      <Link href={base} className="mb-3 flex items-center gap-2 px-1.5 text-[13px] font-semibold text-[#432f22] no-underline">Inventory</Link>
      <nav className="grid content-start gap-1">{links.filter(([label]) => label !== "Recipes" || can("recipes.view")).map(([label,path,icon])=><Link key={path} href={`${base}/${path}`} aria-current={label===title?'page':undefined} className={`flex min-h-8 items-center gap-2 rounded-md px-2 text-[10px] no-underline transition ${label===title?'bg-[#eadcc8] font-medium text-[#4d3828]':'text-[#78695c] hover:bg-[#eadcc8] hover:text-[#4d3828]'}`}><span className="w-4 text-center">{icon}</span>{label}</Link>)}</nav>
    </aside>

    <main className="relative flex min-h-svh min-w-0 flex-col bg-cover bg-center" style={{backgroundImage:`linear-gradient(rgba(249,244,236,.78),rgba(249,244,236,.78)),url("${beansImage.src}")`}}>
      <header className="relative z-10 flex min-h-11.25 shrink-0 flex-wrap items-center gap-2 border-b border-[#e8ded2] bg-[#fbf6ed]/95 px-3 sm:flex-nowrap sm:px-4">
        <div className="flex min-w-fit items-center gap-2 text-[10px] text-[#918477]"><Link href={`/dashboard/${role}`}>Home</Link><span>›</span><span>{title}</span></div>

        <button type="button" className="hidden h-7 w-11 rounded-md border border-[#e5dacd] bg-white text-[11px] md:block" title="Export">↓</button>
        {onCreate && can(createPermission) && <button type="button" onClick={onCreate} className="ml-auto flex h-7 items-center gap-1 rounded-md bg-[#28180f] px-2.5 text-[10px] font-medium text-white hover:bg-[#4a2d1b]">＋ {createLabel}</button>}
      </header>
      {children}
    </main>
  </div></PermissionRouteGuard>;
}

export function InventoryDialog({title, description, onClose, children}:{title:string;description:string;onClose:()=>void;children:ReactNode}){
 return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#21130f]/45 p-4" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose()}}><section role="dialog" aria-modal="true" className="max-h-[90svh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#e5dacd] bg-[#fcf9f4] p-5 shadow-2xl sm:p-6"><div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="m-0 text-lg font-semibold">{title}</h2><p className="mb-0 mt-1 text-xs text-[#8e8074]">{description}</p></div><button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-lg text-[#817367]">×</button></div>{children}</section></div>
}

export const invField = "h-8 rounded-md border border-[#e2d6c6] bg-white px-2.5 text-[10px] outline-none focus:border-[#805336]";
export const invLabel = "grid gap-1 text-[10px] font-medium text-[#55463a]";
export const invAction = "rounded-md px-2 py-1 text-[9px] text-[#805336] hover:bg-[#f0e5d4]";
export const invDelete = "rounded-md px-2 py-1 text-[9px] text-[#9b5549] hover:bg-[#f7e7e3]";
