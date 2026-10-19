"use client";

import { TableCell } from "@/app/components/dashboard/TableCell";

import { useState } from "react";

import { ContactsLayout, type ContactsRole } from "./ContactsLayout";

export default function CustomersPage({ role }: { role: ContactsRole }) {
  const [search, setSearch] = useState("");
  const headings = ["Customer", "Phone / email", "Orders", "Balance", "Status"];
  return <ContactsLayout role={role} title="Customers" search={search} onSearchChange={setSearch}>
    <section className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 p-4">
      <article className="rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95 p-4 shadow-[0_2px_10px_rgba(72,48,30,0.04)]"><h1 className="m-0 text-sm font-semibold text-[#432f22]">Customers are not available yet</h1><p className="mb-0 mt-2 text-xs leading-5 text-[#78695c]">This area is ready and will become available as soon as it can be connected.</p></article>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95"><div className="min-h-0 overflow-auto"><table className="w-full min-w-[650px] border-collapse text-left"><thead className="bg-[#f0e5d4] text-[9px] font-medium text-[#4b3b2f]"><tr>{headings.map((heading) => <th key={heading} className="h-9 px-3">{heading}</th>)}</tr></thead><tbody><tr><TableCell colSpan={headings.length} className="px-3 py-12 text-center text-[10px] text-[#8e8074]">Nothing to show yet.</TableCell></tr></tbody></table></div></div>
    </section>
  </ContactsLayout>;
}
