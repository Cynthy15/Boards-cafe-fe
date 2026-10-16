"use client";

import { useState } from "react";

import AccountShell from "./AccountShell";

export default function EcommercePage() {
  const [search, setSearch] = useState("");

  return (
    <AccountShell crumb="E-commerce" search={search} onSearchChange={setSearch}>
      <section className="flex min-h-[360px] flex-col gap-3 p-4">
        <article className="w-full rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95 p-4 shadow-[0_2px_10px_rgba(72,48,30,0.04)]">
          <h1 className="m-0 text-base font-semibold text-[#432f22]">E-commerce is not available yet</h1>
          <p className="mb-0 mt-2 text-sm leading-6 text-[#6f6155]">This area is ready and will become available as soon as it can be connected.</p>
        </article>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95"><div className="min-h-0 overflow-auto"><table className="w-full min-w-[620px] border-collapse text-left"><thead className="bg-[#f0e5d4] text-[9px] font-medium text-[#4b3b2f]"><tr>{["Storefront", "Domain / slug", "Catalogue", "Checkout", "Status"].map((heading) => <th key={heading} className="h-9 px-3">{heading}</th>)}</tr></thead><tbody><tr><td colSpan={5} className="px-3 py-12 text-center text-[10px] text-[#8e8074]">Nothing to show yet.</td></tr></tbody></table></div></div>
      </section>
    </AccountShell>
  );
}
