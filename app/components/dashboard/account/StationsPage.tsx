"use client";

import AccountShell from "./AccountShell";

export default function StationsPage() {
  return <AccountShell crumb="Stations"><div className="rounded-xl border border-[#e5dacd] bg-[#fcf9f4] p-5 text-center"><h1 className="m-0 text-sm font-semibold">Stations are not exposed by the API</h1><p className="mb-0 mt-2 text-xs leading-5 text-[#78695c]">This page no longer creates local stations. The backend needs a preparation-station resource with category/printer assignment and status before this capability can be enabled.</p></div></AccountShell>;
}
