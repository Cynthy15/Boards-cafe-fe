"use client";

import { TableCell } from "@/app/components/dashboard/TableCell";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { boardsApi, listApiRecords, subscribeToApiDataChanges, type ApiRecord } from "../../../../lib/api-client";
import { Can } from "../AccessControl";
import { InventoryDialog, InventoryLayout, invAction, invDelete, invField, invLabel, type InventoryRole } from "./InventoryLayout";

type InventoryItem = { id: number; name: string; sku: string; category: string; categoryId: number; unit: string; unitId: number; onHand: string; minimum: string; description: string; active: boolean };
type Option = { id: number; name: string; label: string; symbol?: string };

const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const wholeQuantity = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(parsed) : "0";
};

function toInventoryItem(row: ApiRecord, stockByItem: Map<number, ApiRecord>): InventoryItem {
  const id = number(row.id);
  const balance = stockByItem.get(id);
  return { id, name: text(row.name), sku: text(row.sku), category: text(row.category_name), categoryId: number(row.category), unit: text(row.base_unit_symbol) || text(row.base_unit_name), unitId: number(row.base_unit), onHand: text(balance?.quantity) || "0", minimum: text(row.minimum_stock_level) || "0", description: text(row.description), active: row.is_active !== false };
}

export default function RawMaterialsPage({ role }: { role: InventoryRole }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [units, setUnits] = useState<Option[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [open, setOpen] = useState(false);
  const [creatingUnit, setCreatingUnit] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemPayload, categoryPayload, unitPayload, balancePayload] = await Promise.all([boardsApi.inventoryItems("?page_size=100"), boardsApi.inventoryCategories(), boardsApi.inventoryUnits(), boardsApi.stockBalances("?page_size=100")]);
      const stockByItem = new Map(listApiRecords(balancePayload).map((balance) => [number(balance.item), balance]));
      setItems(listApiRecords(itemPayload).map((item) => toInventoryItem(item, stockByItem)));
      setCategories(listApiRecords(categoryPayload).map((row) => ({ id: number(row.id), name: text(row.name), label: text(row.name) })).filter((row) => row.id && row.name));
      setUnits(listApiRecords(unitPayload).map((row) => {
        const name = text(row.name);
        const symbol = text(row.symbol);
        return { id: number(row.id), name, symbol, label: symbol ? `${symbol} — ${name}` : name };
      }).filter((row) => row.id && row.name));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t load inventory items. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const unsubscribe = subscribeToApiDataChanges(() => { void load(); });
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [load]);

  const visible = items.filter((item) => JSON.stringify(item).toLowerCase().includes(search.toLowerCase()));
  function close() { if (!saving) { setOpen(false); setEditing(null); setCreatingUnit(false); setSelectedUnitId(""); setError(""); } }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const categoryName = String(form.get("category") || "").trim();
    const selectedUnitId = String(form.get("unit") || "").trim();
    const newUnitName = String(form.get("new_unit_name") || "").trim();
    const unitSymbol = String(form.get("unit_symbol") || "").trim();
    if (!name || !categoryName || !selectedUnitId) { setError("Enter an item name, category, and base unit."); return; }

    setSaving(true);
    try {
      let category = categories.find((option) => option.name.toLowerCase() === categoryName.toLowerCase());
      if (!category) {
        const created = await boardsApi.createInventoryCategory({ name: categoryName, is_active: true });
        category = { id: number(created.id), name: text(created.name), label: text(created.name) };
      }
      let unit = units.find((option) => String(option.id) === selectedUnitId);
      if (selectedUnitId === "__new__") {
        if (!newUnitName || !unitSymbol) { setError("Enter both a name and a symbol for a new unit."); return; }
        unit = units.find((option) => option.symbol?.toLowerCase() === unitSymbol.toLowerCase());
        if (!unit) {
          const created = await boardsApi.createInventoryUnit({ name: newUnitName, symbol: unitSymbol });
          const createdName = text(created.name);
          const createdSymbol = text(created.symbol);
          unit = { id: number(created.id), name: createdName, symbol: createdSymbol, label: createdSymbol ? `${createdSymbol} — ${createdName}` : createdName };
        }
      }
      if (!category.id || !unit?.id) throw new Error("We couldn’t prepare this inventory item. Please try again.");
      const body: ApiRecord = { name, category: category.id, base_unit: unit.id, sku: String(form.get("sku") || "").trim() || null, description: String(form.get("description") || "").trim(), minimum_stock_level: String(form.get("minimum") || "0"), is_active: form.get("active") === "on" };
      if (editing) await boardsApi.updateInventoryItem(editing.id, body); else await boardsApi.createInventoryItem(body);
      close();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t save this inventory item. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: InventoryItem) {
    if (!window.confirm(`Delete ${item.name}? Items with stock or transaction history cannot be deleted; mark them inactive instead.`)) return;
    try {
      await boardsApi.deleteInventoryItem(item.id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete this inventory item. It may have stock or transaction history; mark it inactive instead.");
    }
  }

  return <InventoryLayout role={role} title="Inventory Items" search={search} onSearchChange={setSearch} createLabel="Create Item" onCreate={() => { setEditing(null); setCreatingUnit(false); setSelectedUnitId(""); setError(""); setOpen(true); }}>
    {error && !open && <p role="alert" className="mx-3 mt-3 rounded bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}
    <section className="relative z-10 flex min-h-0 flex-1 p-3 sm:p-4"><div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95"><div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[760px] border-collapse text-left"><thead className="sticky top-0 bg-[#f0e5d4] text-[9px]"><tr className="h-8 border-b">{["Item", "Category", "On hand", "Minimum", "Status", "Actions"].map((heading) => <th key={heading} className="px-2.5">{heading}</th>)}</tr></thead><tbody className="text-[10px] text-[#55463a]">{visible.map((item) => <tr key={item.id} className="h-9 border-b border-[#eee6dc]"><TableCell className="px-2.5 font-medium">{item.name}{item.sku ? <span className="ml-1 text-[#8e8074]">({item.sku})</span> : null}</TableCell><TableCell className="px-2.5">{item.category || "-"}</TableCell><TableCell className="px-2.5">{wholeQuantity(item.onHand)}{item.unit ? ` ${item.unit}` : ""}</TableCell><TableCell className="px-2.5">{item.minimum}</TableCell><TableCell className="px-2.5">{item.active ? "Active" : "Inactive"}</TableCell><TableCell className="px-2.5"><Can permission="inventory.update"><button type="button" className={invAction} onClick={() => { setEditing(item); setCreatingUnit(false); setSelectedUnitId(String(item.unitId)); setError(""); setOpen(true); }}>Edit</button><button type="button" className={invDelete} onClick={() => void remove(item)}>Delete</button></Can></TableCell></tr>)}</tbody></table></div>{loading ? <div className="flex flex-1 items-center justify-center p-10 text-[10px] text-[#8e8074]">Loading inventory items…</div> : !visible.length && <div className="flex flex-1 items-center justify-center p-10 text-[10px] text-[#8e8074]">No inventory items yet. Create one to add it to a purchase.</div>}<div className="flex min-h-9 items-center justify-between border-t px-3 text-[9px] text-[#817367]"><span>Showing {visible.length} items</span><span>Live API data</span></div></div></section>
    {open && <InventoryDialog title={editing ? "Update Inventory Item" : "Create Inventory Item"} description="Choose an existing base unit to share it across items. Stock is increased when a purchase is received." onClose={close}><form onSubmit={save} className="grid gap-3 sm:grid-cols-2">{error && <p role="alert" className="rounded bg-red-50 p-2 text-[10px] text-red-700 sm:col-span-2">{error}</p>}<label className={invLabel}>Item name<input required name="name" defaultValue={editing?.name} className={invField} /></label><label className={invLabel}>SKU<input name="sku" defaultValue={editing?.sku} placeholder="Optional item code" className={invField} /></label><label className={invLabel}>Category<input required name="category" list="inventory-categories" defaultValue={editing?.category} placeholder="Select or type a category" className={invField} /><datalist id="inventory-categories">{categories.map((category) => <option key={category.id} value={category.name} />)}</datalist></label><label className={invLabel}>Base unit<select required name="unit" value={selectedUnitId} onChange={(event) => { setSelectedUnitId(event.target.value); setCreatingUnit(event.target.value === "__new__"); }} className={invField}><option value="" disabled>Select an existing unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}<option value="__new__">Create a new unit</option></select></label>{creatingUnit && <><label className={invLabel}>New unit name<input required name="new_unit_name" maxLength={80} placeholder="For example, kilogram" className={invField} /></label><label className={invLabel}>New unit symbol<input required name="unit_symbol" maxLength={24} placeholder="For example, kg" className={invField} /></label></>}<p className="m-0 text-[9px] text-[#8e8074] sm:col-span-2">Choose an existing unit to share its symbol across items. Creating a new unit is only needed when its symbol does not already exist.</p><label className={invLabel}>Minimum stock<input name="minimum" type="number" min="0" step="0.001" defaultValue={editing?.minimum || "0"} className={invField} /></label><label className="flex items-end gap-2 text-[10px]"><input name="active" type="checkbox" defaultChecked={editing?.active ?? true} /> Active</label><label className={`${invLabel} sm:col-span-2`}>Description<textarea name="description" defaultValue={editing?.description} className="min-h-16 rounded-md border border-[#e2d6c6] bg-white p-2 text-[10px] outline-none" /></label><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={close} disabled={saving} className="h-8 rounded border px-4 text-[10px]">Cancel</button><button disabled={saving} className="h-8 rounded bg-[#28180f] px-4 text-[10px] text-white">{saving ? "Saving…" : editing ? "Save Item" : "Create Item"}</button></div></form></InventoryDialog>}
  </InventoryLayout>;
}
