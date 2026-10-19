"use client";

import { recordReference } from "@/lib/display-reference";

import { TableCell } from "@/app/components/dashboard/TableCell";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { boardsApi, createIdempotencyKey, listApiRecords, subscribeToApiDataChanges, type ApiRecord } from "../../../../lib/api-client";
import { useAccessControl } from "../AccessControl";
import { actionButtonClassName, deleteButtonClassName, fieldClassName, formatTransactionMoney, labelClassName, TransactionDialog, TransactionLayout, type TransactionRole } from "./TransactionLayout";

type Supplier = { id: number; name: string };
type InventoryItem = { id: number; name: string };
type PurchaseLine = { id: number; inventoryItemId: number; name: string; quantity: number; receivedQuantity: number; unitCost: number };
type Purchase = { id: number; reference: string; supplier: string; date: string; expectedDate: string; invoice: string; notes: string; status: string; total: number; items: PurchaseLine[] };

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function today() { return new Date().toISOString().slice(0, 10); }
function toSupplier(record: ApiRecord): Supplier { return { id: number(record.id), name: text(record.name) }; }
function toInventoryItem(record: ApiRecord): InventoryItem { return { id: number(record.id), name: text(record.name) }; }
function toPurchase(record: ApiRecord): Purchase {
  const items = Array.isArray(record.items) ? record.items.filter((item): item is ApiRecord => !!item && typeof item === "object").map((item) => ({ id: number(item.id), inventoryItemId: number(item.inventory_item), name: text(item.inventory_item_name) || "Inventory item", quantity: number(item.ordered_quantity), receivedQuantity: number(item.received_quantity), unitCost: number(item.unit_cost) })) : [];
  return { id: number(record.id), reference: `#${recordReference(record.id, record.purchase_number)}`, supplier: text(record.supplier_name), date: text(record.purchase_date), expectedDate: text(record.expected_delivery_date), invoice: text(record.supplier_invoice), notes: text(record.notes), status: text(record.status), total: number(record.total_amount), items };
}

export default function PurchasesPage({ role }: { role: TransactionRole }) {
  const { can } = useAccessControl();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [inventoryItemName, setInventoryItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [purchasePayload, supplierPayload, inventoryPayload] = await Promise.all([boardsApi.purchases("?page_size=100"), boardsApi.suppliers("?page_size=100"), boardsApi.inventoryItems("?page_size=100")]);
      setPurchases(listApiRecords(purchasePayload).map(toPurchase));
      setSuppliers(listApiRecords(supplierPayload).filter((supplier) => supplier.is_active !== false).map(toSupplier));
      setInventoryItems(listApiRecords(inventoryPayload).filter((item) => item.is_active !== false).map(toInventoryItem));
      setError("");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "We couldn’t load purchases. Please try again."); } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); const unsubscribe = subscribeToApiDataChanges(() => { void load(); }); return () => { window.clearTimeout(timer); unsubscribe(); }; }, [load]);

  const visiblePurchases = useMemo(() => purchases.filter((purchase) => JSON.stringify(purchase).toLowerCase().includes(search.toLowerCase())), [purchases, search]);
  const estimatedTotal = useMemo(() => lines.reduce((total, line) => total + line.quantity * line.unitCost, 0), [lines]);

  function closeForm() { setIsFormOpen(false); setEditing(null); setLines([]); setInventoryItemName(""); setQuantity("1"); setUnitCost(""); setError(""); }
  function openCreateForm() { closeForm(); setIsFormOpen(true); }
  function openEditForm(purchase: Purchase) { setEditing(purchase); setLines(purchase.items); setInventoryItemName(""); setQuantity("1"); setUnitCost(""); setError(""); setIsFormOpen(true); }
  function addLine() {
    const item = inventoryItems.find((entry) => entry.name.trim().toLocaleLowerCase() === inventoryItemName.trim().toLocaleLowerCase());
    const parsedQuantity = Number(quantity); const parsedUnitCost = Number(unitCost);
    if (!item) { setError("Choose an item from the list, or add it to Inventory first."); return; }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0 || !Number.isFinite(parsedUnitCost) || parsedUnitCost < 0) return;
    if (lines.some((line) => line.inventoryItemId === item.id)) { setError("An inventory item can be added only once to a purchase."); return; }
    setLines((current) => [...current, { id: 0, inventoryItemId: item.id, name: item.name, quantity: parsedQuantity, receivedQuantity: 0, unitCost: parsedUnitCost }]);
    setInventoryItemName(""); setQuantity("1"); setUnitCost(""); setError("");
  }

  async function savePurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lines.length) { setError("Add at least one inventory item."); return; }
    const form = new FormData(event.currentTarget); const supplierName = String(form.get("supplier") || "").trim();
    if (!supplierName) { setError("Select an active supplier or enter a new supplier name."); return; }
    const notes = String(form.get("notes") || "").trim(); const invoice = String(form.get("supplier_invoice") || "").trim(); const expectedDate = String(form.get("expected_delivery_date") || "");
    let step = editing ? "update the draft purchase" : "create the draft purchase"; setIsSaving(true);
    try {
      let supplier = suppliers.find((entry) => entry.name.toLowerCase() === supplierName.toLowerCase());
      if (!supplier) supplier = toSupplier(await boardsApi.createSupplier({ name: supplierName }));
      const body: ApiRecord = { supplier: supplier.id, purchase_date: String(form.get("purchase_date") || today()), items: lines.map((line) => ({ inventory_item: line.inventoryItemId, ordered_quantity: String(line.quantity), unit_cost: String(line.unitCost) })) };
      if (expectedDate) body.expected_delivery_date = expectedDate; if (invoice) body.supplier_invoice = invoice; if (notes) body.notes = notes;
      if (editing) await boardsApi.updatePurchase(editing.id, body); else { const created = await boardsApi.createPurchase(body); const createdId = number(created.id); if (!createdId) throw new Error("We couldn’t create this purchase. Please try again."); step = "submit the purchase order"; await boardsApi.submitPurchase(createdId); }
      closeForm(); await load();
    } catch (requestError) { const detail = requestError instanceof Error ? requestError.message : "The API did not return a usable error message."; await load(); setError(`Could not ${step}. ${detail}`); } finally { setIsSaving(false); }
  }

  async function submitPurchase(purchase: Purchase) { try { await boardsApi.submitPurchase(purchase.id); await load(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to submit this purchase."); } }
  async function receiveAll(purchase: Purchase) { const items = purchase.items.map((line) => ({ purchase_item: line.id, quantity_received: String(line.quantity - line.receivedQuantity) })).filter((line) => Number(line.quantity_received) > 0); if (!items.length || !window.confirm(`Record all outstanding items for purchase ${purchase.reference} as received? This will increase the matching inventory quantities.`)) return; try { const idempotencyKey = createIdempotencyKey(); await boardsApi.receivePurchase(purchase.id, { items, ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}) }); await load(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to receive this purchase."); } }
  async function removePurchase(purchase: Purchase) { if (!window.confirm(`Delete draft purchase ${purchase.reference}?`)) return; try { await boardsApi.deletePurchase(purchase.id); await load(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Only draft purchases can be deleted."); } }

  return <TransactionLayout role={role} title="Purchases" search={search} onSearchChange={setSearch} createLabel="Create New" onCreate={openCreateForm} requiredPermission="purchasing.view" createPermission="purchasing.create">
    {error && !isFormOpen && <p role="alert" className="mx-3 mt-3 rounded-md bg-red-50 p-2 text-[11px] text-red-700">{error}</p>}
    <section className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4"><div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95 shadow-[0_2px_10px_rgba(72,48,30,0.04)]"><div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[880px] border-collapse text-left"><thead className="sticky top-0 bg-[#f0e5d4] text-[9px] font-medium text-[#4b3b2f]"><tr className="h-8 border-b border-[#e2d6c6]">{["Date", "Purchase #", "Supplier", "Items", "Total", "Status"].map((heading) => <th key={heading} className="whitespace-nowrap px-2.5">{heading} ↕</th>)}<th className="px-2.5 text-right">Actions</th></tr></thead><tbody className="text-[10px] text-[#55463a]">{visiblePurchases.map((purchase) => <tr key={purchase.id} className="h-9 border-b border-[#eee6dc]"><TableCell className="whitespace-nowrap px-2.5">{purchase.date}</TableCell><TableCell className="px-2.5 font-medium">{purchase.reference}</TableCell><TableCell className="px-2.5">{purchase.supplier || "-"}</TableCell><TableCell className="px-2.5">{purchase.items.map((line) => `${line.name} ×${line.quantity}`).join(", ") || "-"}</TableCell><TableCell className="whitespace-nowrap px-2.5 font-medium">{formatTransactionMoney(purchase.total)}</TableCell><TableCell className="px-2.5 capitalize">{purchase.status.replaceAll("_", " ")}</TableCell><TableCell className="px-2.5 text-right"><div className="inline-flex gap-1">{purchase.status === "draft" && can("purchasing.update") && <><button type="button" onClick={() => openEditForm(purchase)} className={actionButtonClassName}>Edit</button><button type="button" onClick={() => void submitPurchase(purchase)} className={actionButtonClassName}>Submit</button><button type="button" onClick={() => void removePurchase(purchase)} className={deleteButtonClassName}>Delete</button></>}{["ordered", "partially_received"].includes(purchase.status) && can("purchasing.receive") && <button type="button" onClick={() => void receiveAll(purchase)} className={actionButtonClassName}>Receive all</button>}</div></TableCell></tr>)}</tbody></table></div>{isLoading ? <div className="flex flex-1 items-center justify-center px-4 py-14 text-center text-[10px] text-[#8e8074]">Loading purchases…</div> : !visiblePurchases.length && <div className="flex flex-1 items-center justify-center px-4 py-14 text-center"><div><p className="m-0 text-[11px] font-medium text-[#897b6f]">No purchases returned by the API</p><p className="mb-0 mt-1 text-[9px] text-[#a09387]">Create a purchase order from active suppliers and inventory items.</p></div></div>}<div className="flex min-h-9 items-center justify-between border-t border-[#ebe2d7] px-2.5 text-[9px] text-[#817367] sm:px-3"><span>Showing {visiblePurchases.length} of {purchases.length} purchases</span><span>Live API data</span></div></div></section>
    {isFormOpen && <TransactionDialog title={editing ? "Update Draft Purchase" : "Create Purchase Order"} description="A new purchase is saved as a draft and then sent to the supplier." labelledBy="purchase-form-title" onClose={closeForm}><form key={editing?.id ?? "new-purchase"} onSubmit={savePurchase} className="grid gap-3">{error && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}<div className="grid gap-2 sm:grid-cols-2"><label className={labelClassName}>Purchase date<input required name="purchase_date" type="date" defaultValue={editing?.date || today()} className={fieldClassName} /></label><label className={labelClassName}>Expected delivery<input name="expected_delivery_date" type="date" defaultValue={editing?.expectedDate || ""} className={fieldClassName} /></label><label className={labelClassName}>Supplier<input required name="supplier" list="purchase-suppliers" defaultValue={editing?.supplier || ""} placeholder="Select or enter supplier name" className={fieldClassName} /><datalist id="purchase-suppliers">{suppliers.map((supplier) => <option key={supplier.id} value={supplier.name} />)}</datalist></label><label className={labelClassName}>Supplier invoice<input name="supplier_invoice" maxLength={100} defaultValue={editing?.invoice || ""} placeholder="Optional reference" className={fieldClassName} /></label></div><section className="rounded-md bg-[#f5eee5] p-2.5"><div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_70px_90px_auto] sm:items-end"><label className={labelClassName}>Inventory item<input required list="purchase-inventory-items" value={inventoryItemName} onChange={(event) => setInventoryItemName(event.target.value)} placeholder="Type or select an inventory item" className={`${fieldClassName} h-8 text-[10px]`} /><datalist id="purchase-inventory-items">{inventoryItems.map((item) => <option key={item.id} value={item.name} />)}</datalist></label><label className={labelClassName}>Qty<input value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" min="0.001" step="0.001" className={`${fieldClassName} h-8 text-[10px]`} /></label><label className={labelClassName}>Unit cost<input value={unitCost} onChange={(event) => setUnitCost(event.target.value)} type="number" min="0" step="0.01" className={`${fieldClassName} h-8 text-[10px]`} /></label><button type="button" onClick={addLine} className="form-add-button">+ Add Item</button></div><p className="mb-0 mt-2 text-[9px] text-[#817367]">Type to find an existing inventory item, or choose one from the list. Add a new item in Inventory before including it in a purchase.</p>{lines.length > 0 && <div className="mt-2 grid gap-1 rounded-md bg-white/60 p-2">{lines.map((line, index) => <div key={`${line.inventoryItemId}-${index}`} className="grid grid-cols-[minmax(0,1fr)_45px_90px_20px] gap-2 border-b border-[#eee6dc] py-1 text-[9px] last:border-0"><span className="truncate">{line.name}</span><span>{line.quantity}</span><span>{formatTransactionMoney(line.quantity * line.unitCost)}</span><button type="button" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} className="text-[#9b5549]" aria-label={`Remove ${line.name}`}>×</button></div>)}</div>}</section><label className={labelClassName}>Estimated total<input readOnly value={formatTransactionMoney(estimatedTotal)} className={`${fieldClassName} bg-[#f8f3ec]`} /></label><label className={labelClassName}>Notes<textarea name="notes" defaultValue={editing?.notes || ""} placeholder="Optional purchase notes" className="min-h-16 rounded-md border border-[#e2d6c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#805336]" /></label><div className="flex justify-end gap-2"><button type="button" onClick={closeForm} disabled={isSaving} className="h-8 rounded-md border border-[#e2d6c6] px-4 text-[10px] text-[#69594d] disabled:opacity-50">Cancel</button><button type="submit" disabled={!lines.length || isSaving} className="h-8 rounded-md bg-[#28180f] px-4 text-[10px] font-medium text-white disabled:opacity-50">{isSaving ? "Saving…" : editing ? "Save Draft" : "Create & Submit"}</button></div></form></TransactionDialog>}
  </TransactionLayout>;
}
