"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { boardsApi, listApiRecords, type ApiRecord } from "../../../../lib/api-client";
import { ContactDrawer, ContactsLayout, ContactsTable, contactField, contactLabel, type ContactsRole } from "./ContactsLayout";

type Vendor = { id: number; company: string; contactName: string; email: string; phone: string; tin: string; address: string; status: string };

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function toVendor(record: ApiRecord): Vendor {
  return { id: Number(record.id), company: text(record.name), contactName: text(record.contact_person), email: text(record.email), phone: text(record.phone), tin: text(record.tax_id), address: text(record.address), status: text(record.status) || "active" };
}

function VendorForm({ editing, onClose, onSave, error }: { editing: Vendor | null; onClose: () => void; onSave: (vendor: Vendor) => Promise<void>; error: string }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onSave({ id: editing?.id ?? 0, company: String(form.get("company") || "").trim(), contactName: String(form.get("contactName") || "").trim(), email: String(form.get("email") || "").trim(), phone: String(form.get("phone") || "").trim(), tin: String(form.get("tin") || "").trim(), address: String(form.get("address") || "").trim(), status: editing?.status ?? "active" });
  }

  return <ContactDrawer title={editing ? "Update Vendor" : "Create New Vendor"} description="This saves the supplier to the live Boards Cafe API." submitLabel={editing ? "Save Vendor" : "Create Vendor"} onClose={onClose} onSubmit={(event) => { void submit(event); }}>
    {error && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}
    <label className={contactLabel}>Company Name *<input required name="company" defaultValue={editing?.company ?? ""} placeholder="e.g., Kigali Roasters" className={contactField} /></label>
    <label className={contactLabel}>Contact Name<input name="contactName" defaultValue={editing?.contactName ?? ""} placeholder="e.g., John Doe" className={contactField} /></label>
    <label className={contactLabel}>Email Address<input name="email" type="email" defaultValue={editing?.email ?? ""} placeholder="e.g., orders@example.com" className={contactField} /></label>
    <label className={contactLabel}>Phone Number<input name="phone" type="tel" defaultValue={editing?.phone ?? ""} placeholder="e.g., +250 788 123 456" className={contactField} /></label>
    <label className={contactLabel}>TIN Number<input name="tin" defaultValue={editing?.tin ?? ""} placeholder="Enter TIN" className={contactField} /></label>
    <label className={contactLabel}>Address<textarea name="address" defaultValue={editing?.address ?? ""} placeholder="Vendor address" className="min-h-16 rounded-md border border-[#e2d6c6] bg-white p-2 text-[10px] outline-none placeholder:text-[#a09286] focus:border-[#805336]" /></label>
    <p className="m-0 text-[9px] text-[#8e8074]">Company name is required by the API.</p>
  </ContactDrawer>;
}

export default function VendorsPage({ role }: { role: ContactsRole }) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadVendors = useCallback(async () => {
    setIsLoading(true);
    try {
      setVendors(listApiRecords(await boardsApi.suppliers()).map(toVendor)); setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load vendors.");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void loadVendors(); }, 0); return () => window.clearTimeout(timer); }, [loadVendors]);
  const visible = vendors.filter((vendor) => JSON.stringify(vendor).toLowerCase().includes(search.toLowerCase()));
  function close() { setOpen(false); setEditing(null); setError(""); }

  async function save(vendor: Vendor) {
    if (!vendor.company) { setError("Company name is required."); return; }
    const body = { name: vendor.company, contact_person: vendor.contactName, email: vendor.email, phone: vendor.phone, tax_id: vendor.tin, address: vendor.address, status: vendor.status };
    try {
      if (editing) await boardsApi.updateSupplier(vendor.id, body); else await boardsApi.createSupplier(body);
      close(); await loadVendors();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to save this vendor."); }
  }

  async function deactivate(vendor: Vendor) {
    if (!window.confirm(`Deactivate ${vendor.company}?`)) return;
    try { await boardsApi.deactivateSupplier(vendor.id); await loadVendors(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to deactivate this vendor."); }
  }

  return (
    <ContactsLayout role={role} title="Vendors" search={search} onSearchChange={setSearch} onCreate={() => { setEditing(null); setError(""); setOpen(true); }}>
      {error && !open && <p role="alert" className="mx-3 mt-3 rounded-md bg-red-50 p-2 text-[11px] text-red-700">{error}</p>}
      {isLoading ? <p className="p-4 text-[11px] text-[#6f6054]">Loading vendors…</p> : <ContactsTable rows={visible} columns={[
        { header: "Company Name", render: (vendor: Vendor) => vendor.company, className: "font-medium" },
        { header: "Contact Name", render: (vendor: Vendor) => vendor.contactName || "-" },
        { header: "Email Address", render: (vendor: Vendor) => vendor.email || "-" },
        { header: "Phone Number", render: (vendor: Vendor) => vendor.phone || "-" },
        { header: "TIN Number", render: (vendor: Vendor) => vendor.tin || "-" },
        { header: "Address", render: (vendor: Vendor) => vendor.address || "-", className: "max-w-[180px] truncate" },
        { header: "Status", render: (vendor: Vendor) => vendor.status },
      ]} emptyTitle="No vendors returned by the API" emptyHint="Create a supplier to add the first vendor." onEdit={(vendor) => { setEditing(vendor); setError(""); setOpen(true); }} onDelete={(id) => { const vendor = vendors.find((item) => item.id === id); if (vendor) void deactivate(vendor); }} />}
      {open && <VendorForm editing={editing} onClose={close} onSave={save} error={error} />}
    </ContactsLayout>
  );
}
