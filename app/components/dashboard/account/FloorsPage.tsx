"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { boardsApi, listApiRecords, type ApiRecord } from "../../../../lib/api-client";
import { useActiveBusiness } from "../../../../lib/use-active-business";
import { useAccessControl } from "../AccessControl";
import AccountShell from "./AccountShell";
import { DataTable, Dialog, Field, fieldClass, primaryButton, secondaryButton, useToast, type Column } from "./ui";

type TableStatus = "available" | "occupied" | "reserved" | "cleaning";
type Table = { id: string; number: string; name: string; seats: number; availability: TableStatus; active: boolean };

const tableStatuses: TableStatus[] = ["available", "occupied", "reserved", "cleaning"];
const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };

function toTable(record: ApiRecord): Table {
  const status = text(record.status).toLowerCase();
  return {
    id: String(record.id), number: text(record.number) || text(record.table_number), name: text(record.name) || text(record.table_name), seats: number(record.capacity ?? record.seats),
    availability: tableStatuses.includes(status as TableStatus) ? status as TableStatus : "available", active: record.is_active !== false,
  };
}

/** Table management uses the business-level API; floors remain an internal backend detail. */
export default function FloorsPage() {
  const { business, businessId, isLoading: isBusinessLoading, error: businessError } = useActiveBusiness();
  const { can } = useAccessControl();
  const [tables, setTables] = useState<Table[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Table | null>(null);
  const [open, setOpen] = useState(false);
  const [numberOrName, setNumberOrName] = useState("");
  const [seats, setSeats] = useState("2");
  const [availability, setAvailability] = useState<TableStatus>("available");
  const [errors, setErrors] = useState<{ number?: string; seats?: string; form?: string }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, notify] = useToast();

  const loadTables = useCallback(async () => {
    if (!businessId) { setTables([]); setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const tablePayload = await boardsApi.businessTables(businessId, "?page_size=100");
      setTables(listApiRecords(tablePayload).map(toTable));
      setErrors({});
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Unable to load tables." });
    } finally { setIsLoading(false); }
  }, [businessId]);

  useEffect(() => { const timer = window.setTimeout(() => { void loadTables(); }, 0); return () => window.clearTimeout(timer); }, [loadTables]);

  function resetForm(table?: Table) {
    setEditing(table ?? null); setNumberOrName(table?.number || table?.name || ""); setSeats(String(table?.seats || 2)); setAvailability(table?.availability || "available"); setErrors({});
  }
  function openCreate() { resetForm(); setOpen(true); }
  function openEdit(table: Table) { resetForm(table); setOpen(true); }
  function close() { if (!isSaving) { setOpen(false); setEditing(null); } }

  const columns: Column<Table>[] = [
    { key: "number", label: "Table name / number", sortValue: (table) => table.number || table.name, render: (table) => <div><strong className="font-medium">{table.number || table.name || "-"}</strong>{table.name && table.name !== table.number && <span className="mt-1 block text-[10px] text-[#6f6054]">{table.name}</span>}</div> },
    { key: "seats", label: "Table seats", sortValue: (table) => table.seats, render: (table) => table.seats || "-" },
    { key: "availability", label: "Availability", sortValue: (table) => table.availability, render: (table) => <span className="capitalize">{table.active ? table.availability : "inactive"}</span> },
    { key: "actions", label: "Actions", render: (table) => can("settings.update") ? <span className="inline-flex gap-2"><button type="button" onClick={() => openEdit(table)} className="rounded px-1.5 py-0.5 text-[11px] text-[#805336] hover:bg-[#eadcc8]">Edit</button><button type="button" onClick={() => void remove(table)} className="rounded px-1.5 py-0.5 text-[11px] text-[#a8432f] hover:bg-[#f8e8e2]">Delete</button></span> : null },
  ];

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    const cleanNumber = numberOrName.trim(); const parsedSeats = Number(seats);
    if (!cleanNumber) next.number = "A table name or number is required.";
    if (!Number.isInteger(parsedSeats) || parsedSeats < 1) next.seats = "Enter at least one seat.";
    setErrors(next); if (Object.keys(next).length || !businessId) return;

    setIsSaving(true);
    try {
      const body: ApiRecord = { number: cleanNumber, name: cleanNumber, capacity: parsedSeats, status: availability, is_active: editing?.active ?? true };
      if (editing) await boardsApi.updateBusinessTable(businessId, editing.id, body);
      else await boardsApi.createBusinessTable(businessId, body);
      notify(editing ? "Table updated." : "Table created."); close(); await loadTables();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Unable to save this table." });
    } finally { setIsSaving(false); }
  }

  async function remove(table: Table) {
    if (!businessId || !window.confirm(`Delete table ${table.number || table.name}? It cannot be used for new dine-in orders after deletion.`)) return;
    try {
      await boardsApi.deleteBusinessTable(businessId, table.id);
      notify("Table deleted.");
      await loadTables();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Unable to delete this table." });
    }
  }

  const noBusiness = !isBusinessLoading && !businessId;
  const businessName = text(business?.name) || "the active business";

  return (
    <AccountShell crumb="Tables" searchPlaceholder="Search tables..." search={query} onSearchChange={setQuery} onCreate={openCreate}>
      {(businessError || (errors.form && !open)) && <p role="alert" className="mb-3 rounded-md bg-red-50 p-2 text-[11px] text-red-700">{businessError || errors.form}</p>}
      {isBusinessLoading || isLoading ? <p className="p-4 text-[11px] text-[#6f6054]">Loading tables…</p> : noBusiness ? <p className="p-4 text-[11px] text-[#6f6054]">Create a business profile in Business before adding tables.</p> : <DataTable rows={tables} columns={columns} query={query} searchText={(table) => `${table.number} ${table.name} ${table.seats} ${table.availability}`} emptyText="No tables returned for this business. Create the first one to get started." />}
      {open && <Dialog title={editing ? "Edit Table" : "Create Table"} description={`Set up a table for ${businessName}.`} onClose={close}>
        <form onSubmit={submit} className="grid gap-3.5" noValidate>
          {errors.form && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{errors.form}</p>}
          <Field label="Table name / number" required error={errors.number}><input autoFocus value={numberOrName} onChange={(event) => setNumberOrName(event.target.value)} placeholder="e.g., T-01 or Window table" className={fieldClass} /></Field>
          <Field label="Table seats" required error={errors.seats}><input inputMode="numeric" value={seats} onChange={(event) => setSeats(event.target.value)} className={fieldClass} /></Field>
          <Field label="Availability"><select value={availability} onChange={(event) => setAvailability(event.target.value as TableStatus)} className={fieldClass}>{tableStatuses.map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></Field>
          <div className="mt-1 flex justify-end gap-2"><button type="button" onClick={close} disabled={isSaving} className={secondaryButton}>Cancel</button><button type="submit" disabled={isSaving || !businessId} className={primaryButton}>{isSaving ? "Saving…" : editing ? "Save Changes" : "Create Table"}</button></div>
        </form>
      </Dialog>}
      {toast}
    </AccountShell>
  );
}
