"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { boardsApi, listApiRecords, type ApiRecord } from "../../../../lib/api-client";
import { useActiveBusiness } from "../../../../lib/use-active-business";
import AccountShell from "./AccountShell";
import { DataTable, Dialog, Field, RadioGroup, fieldClass, hintClass, primaryButton, secondaryButton, useToast, type Column } from "./ui";

type Status = "active" | "inactive";
type Floor = { id: string; name: string; tables: number; description: string; status: Status };

function toFloor(record: ApiRecord): Floor {
  return { id: String(record.id), name: typeof record.name === "string" ? record.name : "", tables: Number(record.tables_count ?? 0), description: typeof record.description === "string" ? record.description : "", status: record.is_active === false ? "inactive" : "active" };
}

export default function FloorsPage() {
  const { business, businessId, isLoading: isBusinessLoading, error: businessError } = useActiveBusiness();
  const [floors, setFloors] = useState<Floor[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tables, setTables] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("active");
  const [errors, setErrors] = useState<{ name?: string; tables?: string; form?: string }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [toast, notify] = useToast();

  const loadFloors = useCallback(async () => {
    if (!businessId) { setFloors([]); setIsLoading(false); return; }
    setIsLoading(true);
    try {
      setFloors(listApiRecords(await boardsApi.floors(businessId)).map(toFloor));
      setErrors({});
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Unable to load floors." });
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => { const timer = window.setTimeout(() => { void loadFloors(); }, 0); return () => window.clearTimeout(timer); }, [loadFloors]);

  const columns: Column<Floor>[] = [
    { key: "name", label: "Floor Name", sortValue: (floor) => floor.name, render: (floor) => <><div>{floor.name}</div><div className="mt-1.5 text-[#6f6054]">{floor.description || "-"}</div></> },
    { key: "tables", label: "Table Quantity", sortValue: (floor) => floor.tables, render: (floor) => floor.tables },
    { key: "status", label: "Status", sortValue: (floor) => floor.status, render: (floor) => floor.status },
  ];

  function openCreate() {
    setName(""); setTables(""); setDescription(""); setStatus("active"); setErrors({}); setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    const clean = name.trim();
    const count = Number(tables);
    if (!clean) next.name = "Floor name is required.";
    if (!Number.isInteger(count) || count < 1) next.tables = "Enter a whole number greater than zero.";
    setErrors(next);
    if (next.name || next.tables || !businessId) return;

    try {
      const floor = await boardsApi.createFloor(businessId, { business: Number(businessId), name: clean, description: description.trim(), display_order: floors.length, is_active: status === "active" });
      const floorId = Number(floor.id);
      await Promise.all(Array.from({ length: count }, (_, index) => boardsApi.createTable(businessId, floorId, { floor: floorId, number: `${clean.toUpperCase()}-${index + 1}`, capacity: 4, status: "AVAILABLE", is_active: status === "active" })));
      notify(`Floor created with ${count} table${count === 1 ? "" : "s"}.`);
      setOpen(false);
      await loadFloors();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Unable to create this floor." });
    }
  }

  const noBusiness = !isBusinessLoading && !businessId;
  const businessName = typeof business?.name === "string" ? business.name : "the active business";

  return (
    <AccountShell crumb="Floors" searchPlaceholder="Search floors or add filters..." search={query} onSearchChange={setQuery} onCreate={openCreate}>
      {(businessError || errors.form && !open) && <p role="alert" className="mb-3 rounded-md bg-red-50 p-2 text-[11px] text-red-700">{businessError || errors.form}</p>}
      {isBusinessLoading || isLoading ? <p className="p-4 text-[11px] text-[#6f6054]">Loading floors…</p> : noBusiness ? <p className="p-4 text-[11px] text-[#6f6054]">Create a business profile in Business Details before adding floors.</p> : <DataTable rows={floors} columns={columns} query={query} searchText={(floor) => `${floor.name} ${floor.tables} ${floor.description} ${floor.status}`} emptyText="No floors returned for this business." />}
      {open && <Dialog title="Create New Floor" description={`Add a seating area to ${businessName}.`} onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="grid gap-3.5" noValidate>
          {errors.form && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{errors.form}</p>}
          <Field label="Floor Name" required error={errors.name}><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Terrace" className={fieldClass} /></Field>
          <div className="grid gap-1.5"><Field label="Table Quantity" required error={errors.tables}><input inputMode="numeric" value={tables} onChange={(e) => setTables(e.target.value)} placeholder="e.g., 10" className={fieldClass} /></Field><p className={`${hintClass} m-0`}>The API creates this many available tables for the new floor.</p></div>
          <Field label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional seating area details" className={fieldClass} /></Field>
          <RadioGroup<Status> legend="Status" name="floor-status" value={status} onChange={setStatus} options={[{ value: "active", label: "active" }, { value: "inactive", label: "inactive" }]} />
          <div className="mt-1 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className={secondaryButton}>Cancel</button><button type="submit" disabled={!businessId} className={primaryButton}>Create Floor</button></div>
        </form>
      </Dialog>}
      {toast}
    </AccountShell>
  );
}
