"use client";

import { useState } from "react";

import { InventoryLayout, type InventoryRole } from "./InventoryLayout";

const columns: Record<string, string[]> = {
  "Add-ons": ["Add-on", "Product", "Price adjustment", "Availability"],
  Assets: ["Asset", "Category", "Value", "Status"],
  Services: ["Service", "Category", "Price", "Availability"],
  "Stock Transfer": ["Transfer #", "Source", "Destination", "Items", "Status"],
};

export default function ApiUnavailableInventoryPage({ role, title }: { role: InventoryRole; title: string; requirement: string }) {
  const [search, setSearch] = useState("");
  const headings = columns[title] ?? ["Name", "Details", "Status"];
  return <InventoryLayout role={role} title={title} search={search} onSearchChange={setSearch}>
    <section className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 p-4">
      <article className="w-full rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95 p-4 shadow-[0_2px_10px_rgba(72,48,30,0.04)]"><h1 className="m-0 text-sm font-semibold text-[#432f22]">{title} are not available yet</h1><p className="mb-0 mt-2 text-xs leading-5 text-[#78695c]">This area is ready and will become available as soon as it can be connected.</p></article>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95"><div className="min-h-0 overflow-auto"><table className="w-full min-w-[650px] border-collapse text-left"><thead className="bg-[#f0e5d4] text-[9px] font-medium text-[#4b3b2f]"><tr>{headings.map((heading) => <th key={heading} className="h-9 px-3">{heading}</th>)}</tr></thead><tbody><tr><td colSpan={headings.length} className="px-3 py-12 text-center text-[10px] text-[#8e8074]">Nothing to show yet.</td></tr></tbody></table></div></div>
    </section>
  </InventoryLayout>;
}
