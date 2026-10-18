"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { boardsApi, listApiRecords, type ApiRecord } from "../../../../lib/api-client";
import { useAccessControl } from "../AccessControl";
import AccountShell from "./AccountShell";
import { DataTable, Dialog, Field, RadioGroup, fieldClass, hintClass, primaryButton, rowAction, secondaryButton, useToast, type Column } from "./ui";

const paymentTypes = ["CASH", "MOBILE_MONEY", "CARD", "BANK_TRANSFER", "CHEQUE", "CUSTOMER_CREDIT"] as const;
type PaymentType = (typeof paymentTypes)[number];
type PaymentMethod = { id: string; name: string; type: PaymentType; description: string; featured: boolean };
type Draft = { name: string; type: PaymentType | ""; description: string; featured: "yes" | "no" };
const emptyDraft: Draft = { name: "", type: "", description: "", featured: "no" };

function asString(value: unknown) { return typeof value === "string" ? value : ""; }

function toMethod(record: ApiRecord): PaymentMethod {
  return {
    id: String(record.id),
    name: asString(record.name),
    type: paymentTypes.includes(record.payment_type as PaymentType) ? record.payment_type as PaymentType : "CASH",
    description: asString(record.description),
    featured: record.is_default === true,
  };
}

export default function PaymentMethodsPage() {
  const { can } = useAccessControl();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [errors, setErrors] = useState<{ name?: string; type?: string; form?: string }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [toast, notify] = useToast();

  const loadMethods = useCallback(async () => {
    setIsLoading(true);
    try {
      setMethods(listApiRecords(await boardsApi.paymentMethods()).map(toMethod));
      setErrors({});
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Unable to load payment methods." });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void loadMethods(); }, 0); return () => window.clearTimeout(timer); }, [loadMethods]);

  const columns: Column<PaymentMethod>[] = [
    { key: "name", label: "Payment Method", sortValue: (m) => m.name, render: (m) => m.name },
    { key: "type", label: "Type", sortValue: (m) => m.type, render: (m) => m.type.replaceAll("_", " ") },
    { key: "description", label: "Description", sortValue: (m) => m.description, render: (m) => m.description || "-" },
    { key: "featured", label: "Default", sortValue: (m) => (m.featured ? "Yes" : "No"), render: (m) => (m.featured ? "Yes" : "No") },
    {
      key: "actions", label: "Actions", sortValue: () => "",
      render: (m) => can("settings.update") ? <span className="flex gap-3"><button type="button" className={rowAction} onClick={() => { setErrors({}); setEditing({ id: m.id, draft: { name: m.name, type: m.type, description: m.description, featured: m.featured ? "yes" : "no" } }); }}>Edit</button><button type="button" className={rowAction} onClick={() => void remove(m)}>Deactivate</button></span> : null,
    },
  ];

  const set = (patch: Partial<Draft>) => setEditing((current) => current ? { ...current, draft: { ...current.draft, ...patch } } : current);

  async function remove(method: PaymentMethod) {
    if (!window.confirm(`Deactivate ${method.name}?`)) return;
    try {
      await boardsApi.deletePaymentMethod(method.id);
      notify("Payment method deactivated.");
      await loadMethods();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Unable to deactivate this payment method." });
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const { id, draft } = editing;
    const name = draft.name.trim();
    const next: typeof errors = {};
    if (!name) next.name = "Payment method name is required.";
    if (!draft.type) next.type = "Select a payment type.";
    setErrors(next);
    if (next.name || next.type) return;

    const body = { name, payment_type: draft.type, description: draft.description.trim(), is_active: true, is_default: draft.featured === "yes", requires_reference: false };
    try {
      if (id) await boardsApi.updatePaymentMethod(id, body);
      else await boardsApi.createPaymentMethod(body);
      notify(id ? "Payment method updated." : "Payment method created.");
      setEditing(null);
      await loadMethods();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Unable to save the payment method." });
    }
  }

  return (
    <AccountShell crumb="Payment Methods" search={query} onSearchChange={setQuery} onCreate={() => { setErrors({}); setEditing({ id: null, draft: emptyDraft }); }}>
      {errors.form && !editing && <p role="alert" className="mb-3 rounded-md bg-red-50 p-2 text-[11px] text-red-700">{errors.form}</p>}
      {isLoading ? <p className="p-4 text-[11px] text-[#6f6054]">Loading payment methods…</p> : <DataTable rows={methods} columns={columns} query={query} searchText={(m) => `${m.name} ${m.type} ${m.description}`} emptyText="No payment methods returned by the API." />}
      {editing && <Dialog title={editing.id ? "Edit Payment Method" : "Create Payment Method"} description="Add a payment option to the live Boards Cafe workspace." onClose={() => setEditing(null)}>
        <form onSubmit={submit} className="grid gap-3.5" noValidate>
          {errors.form && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{errors.form}</p>}
          <Field label="Payment Method Name" required error={errors.name}><input autoFocus value={editing.draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g., Mobile money" className={fieldClass} /></Field>
          <Field label="Type" required error={errors.type}><select value={editing.draft.type} onChange={(e) => set({ type: e.target.value as PaymentType | "" })} className={fieldClass}><option value="">Select payment type</option>{paymentTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></Field>
          <Field label="Description"><input value={editing.draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="Optional payment instructions" className={fieldClass} /></Field>
          <div className="grid gap-1.5"><RadioGroup<"yes" | "no"> legend="Use as default" name="payment-featured" value={editing.draft.featured} onChange={(featured) => set({ featured })} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} /><p className={`${hintClass} m-0`}>The API keeps one active default method at a time.</p></div>
          <div className="mt-1 flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className={secondaryButton}>Cancel</button><button type="submit" className={primaryButton}>{editing.id ? "Save Method" : "Create Method"}</button></div>
        </form>
      </Dialog>}
      {toast}
    </AccountShell>
  );
}
