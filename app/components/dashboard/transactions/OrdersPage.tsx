"use client";

import { recordReference } from "@/lib/display-reference";

import { TableCell } from "@/app/components/dashboard/TableCell";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { boardsApi, listApiRecords, subscribeToApiDataChanges, type ApiRecord } from "../../../../lib/api-client";
import { actionButtonClassName, deleteButtonClassName, fieldClassName, formatTransactionMoney, labelClassName, TransactionDialog, TransactionLayout, type TransactionRole } from "./TransactionLayout";

type OrderItem = { productId: number; product: string; quantity: number; price: number };
type Order = { id: number; date: string; reference: string; items: OrderItem[]; status: string; notes: string; total: number; tableId: number | null; tableLabel: string; serviceType: string; guestCount: string; customerId: string };
type MenuProduct = { id: number; name: string; price: number };
type TableOption = { id: number; label: string };

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function toOrder(record: ApiRecord): Order {
  const items = Array.isArray(record.items) ? record.items.filter((item): item is ApiRecord => !!item && typeof item === "object").map((item) => ({ productId: Number(item.product), product: text(item.product_name), quantity: Number(item.quantity ?? 0), price: Number(item.unit_price ?? 0) })) : [];
  const tableId = Number(record.table);
  return { id: Number(record.id), date: text(record.created_at).slice(0, 10), reference: `#${recordReference(record.id, record.order_number)}`, items, status: text(record.status), notes: text(record.notes), total: Number(record.total_amount ?? 0), tableId: Number.isFinite(tableId) && tableId > 0 ? tableId : null, tableLabel: text(record.table_name) || text(record.table_number), serviceType: text(record.service_type), guestCount: text(record.guest_count), customerId: text(record.customer_id) };
}
function toProduct(record: ApiRecord): MenuProduct { return { id: Number(record.id), name: text(record.name), price: Number(record.base_price ?? 0) }; }

export default function OrdersPage({ role }: { role: TransactionRole }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [tables, setTables] = useState<TableOption[]>([]);
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [serviceType, setServiceType] = useState("dine_in");
  const [tableId, setTableId] = useState("");
  const [guestCount, setGuestCount] = useState("1");
  const [customerId, setCustomerId] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [orderPayload, productPayload, businessPayload] = await Promise.all([boardsApi.orders("?page_size=100"), boardsApi.menuProducts(), boardsApi.businesses()]);
      setOrders(listApiRecords(orderPayload).map(toOrder)); setProducts(listApiRecords(productPayload).filter((item) => item.is_available !== false).map(toProduct)); setError("");
      const businesses = listApiRecords(businessPayload);
      const business = businesses.find((item) => item.is_active === true) ?? businesses[0];
      if (!business?.id) { setTables([]); return; }
      const availableTablePayload = await boardsApi.availableTables(Number(business.id), "?page_size=100");
      setTables(listApiRecords(availableTablePayload)
        .map((table) => ({ id: Number(table.id), label: text(table.name) || text(table.number) || `Table ${table.id}` }))
        .filter((table) => table.id));
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to load orders."); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); const refresh = () => { void load(); }; const unsubscribe = subscribeToApiDataChanges(refresh); window.addEventListener("focus", refresh); return () => { window.clearTimeout(timer); unsubscribe(); window.removeEventListener("focus", refresh); }; }, [load]);
  const visible = orders.filter((order) => JSON.stringify(order).toLowerCase().includes(search.toLowerCase()));
  const total = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.price, 0), [items]);
  const availableTables = useMemo(() => {
    if (!editing?.tableId || tables.some((table) => table.id === editing.tableId)) return tables;
    return [{ id: editing.tableId, label: editing.tableLabel || `Table ${editing.tableId}` }, ...tables];
  }, [editing, tables]);
  function closeForm() { setEditing(null); setIsFormOpen(false); setItems([]); setProductId(""); setQuantity("1"); setServiceType("dine_in"); setTableId(""); setGuestCount("1"); setCustomerId(""); setError(""); }
  function openCreateForm() { closeForm(); setIsFormOpen(true); }
  function openEditForm(order: Order) { setEditing(order); setItems(order.items); setProductId(""); setQuantity("1"); setServiceType(order.serviceType || "dine_in"); setTableId(order.tableId ? String(order.tableId) : ""); setGuestCount(order.guestCount || "1"); setCustomerId(order.customerId); setError(""); setIsFormOpen(true); }
  function addItem() {
    const product = products.find((item) => item.id === Number(productId)); const parsedQuantity = Number(quantity);
    if (!product || !Number.isInteger(parsedQuantity) || parsedQuantity < 1) return;
    setItems((current) => [...current, { productId: product.id, product: product.name, quantity: parsedQuantity, price: product.price }]); setProductId(""); setQuantity("1");
  }

  async function saveOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length) { setError("Add at least one available menu product."); return; }
    try {
      const notes = String(new FormData(event.currentTarget).get("notes") || "").trim();
      if (serviceType === "dine_in" && !tableId) { setError("Choose a table for a dine-in order."); return; }
      if (serviceType === "dine_in" && !availableTables.some((table) => table.id === Number(tableId))) { setError("That table is no longer available. Choose another available table and try again."); return; }
      const body: ApiRecord = { items: items.map((item) => ({ product: item.productId, quantity: item.quantity })), service_type: serviceType, guest_count: Number(guestCount || 0), table: tableId ? Number(tableId) : null };
      if (customerId.trim()) body.customer_id = customerId.trim();
      if (notes) body.notes = notes;
      if (editing) await boardsApi.updateOrder(editing.id, body); else await boardsApi.createOrder(body);
      closeForm(); await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to save this order."); }
  }

  async function remove(order: Order) {
    if (!window.confirm(`Delete order ${order.reference}?`)) return;
    try { await boardsApi.deleteOrder(order.id); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Only draft orders can be deleted. Please check the API status."); }
  }

  async function submitOrder(order: Order) {
    if (!window.confirm(`Submit order ${order.reference} for payment? It can no longer be edited.`)) return;
    try { await boardsApi.submitOrder(order.id); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to submit this order for payment."); }
  }

  return <TransactionLayout role={role} title="Orders" search={search} onSearchChange={setSearch} createLabel="Create New" onCreate={openCreateForm} requiredPermission="sales.view" createPermission="sales.create">
    {error && !isFormOpen && <p role="alert" className="mx-3 mt-3 rounded-md bg-red-50 p-2 text-[11px] text-red-700">{error}</p>}
    <section className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4"><div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95 shadow-[0_2px_10px_rgba(72,48,30,0.04)]"><div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[820px] border-collapse text-left"><thead className="sticky top-0 bg-[#f0e5d4] text-[9px] font-medium text-[#4b3b2f]"><tr className="h-8 border-b border-[#e2d6c6]"><th className="w-8 px-2.5">□</th>{["Date", "Reference#", "Table / service", "Items", "Total", "Status"].map((heading) => <th key={heading} className="whitespace-nowrap px-2.5">{heading} ↕</th>)}<th className="px-2.5 text-right">Actions</th></tr></thead><tbody className="text-[10px] text-[#55463a]">{visible.map((order) => <tr key={order.id} className="h-9 border-b border-[#eee6dc]"><TableCell className="px-2.5"><input type="checkbox" aria-label={`Select order ${order.reference}`} className="h-3 w-3 accent-[#805336]" /></TableCell><TableCell className="whitespace-nowrap px-2.5">{order.date}</TableCell><TableCell className="px-2.5 font-medium">{order.reference}</TableCell><TableCell className="px-2.5 capitalize">{order.tableLabel || "No table"}{order.serviceType ? ` · ${order.serviceType.replaceAll("_", " ")}` : ""}</TableCell><TableCell className="px-2.5">{order.items.map((item) => item.product).join(", ") || "-"}</TableCell><TableCell className="whitespace-nowrap px-2.5 font-medium">{formatTransactionMoney(order.total)}</TableCell><TableCell className="px-2.5 capitalize">{order.status}</TableCell><TableCell className="px-2.5 text-right"><div className="inline-flex gap-1">{order.status === "draft" && <><button type="button" onClick={() => openEditForm(order)} className={actionButtonClassName}>Edit</button><button type="button" onClick={() => void submitOrder(order)} className={actionButtonClassName}>Submit</button><button type="button" onClick={() => void remove(order)} className={deleteButtonClassName}>Delete</button></>}</div></TableCell></tr>)}</tbody></table></div>{isLoading ? <div className="flex flex-1 items-center justify-center px-4 py-14 text-center text-[10px] text-[#8e8074]">Loading orders…</div> : !visible.length && <div className="flex flex-1 items-center justify-center px-4 py-14 text-center"><div><p className="m-0 text-[11px] font-medium text-[#897b6f]">No orders returned by the API</p><p className="mb-0 mt-1 text-[9px] text-[#a09387]">Create a draft order from available menu products.</p></div></div>}<div className="flex min-h-9 items-center justify-between border-t border-[#ebe2d7] px-2.5 text-[9px] text-[#817367] sm:px-3"><span>Showing {visible.length} of {orders.length} orders</span><span>Live API data</span></div></div></section>
    {isFormOpen && <TransactionDialog title={editing ? "Update Draft Order" : "Create Draft Order"} description="Products, tables, and order totals are read and validated by the API." labelledBy="order-form-title" onClose={closeForm}><form key={editing?.id ?? "new-order"} onSubmit={saveOrder} className="grid gap-3">{error && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}<div className="grid gap-2 sm:grid-cols-2"><label className={labelClassName}>Service type<select value={serviceType} onChange={(event) => { const nextServiceType = event.target.value; setServiceType(nextServiceType); if (nextServiceType !== "dine_in") setTableId(""); }} className={fieldClassName}><option value="dine_in">Dine in</option><option value="takeaway">Takeaway</option><option value="delivery">Delivery</option></select></label><label className={labelClassName}>Guests<input type="number" min="0" value={guestCount} onChange={(event) => setGuestCount(event.target.value)} className={fieldClassName} /></label>{serviceType === "dine_in" && <label className={`${labelClassName} sm:col-span-2`}>Available table<select required value={tableId} onChange={(event) => setTableId(event.target.value)} className={fieldClassName}><option value="">Select an available table</option>{availableTables.map((table) => <option key={table.id} value={table.id}>{table.label}</option>)}</select><span className="font-normal text-[#8e8074]">The server keeps this table with its waiter until payment, cancellation, or voiding.</span>{!availableTables.length && <span className="font-normal text-[#9b5549]">There are no available tables right now.</span>}</label>}<label className={`${labelClassName} sm:col-span-2`}>Customer ID <span className="font-normal text-[#8e8074]">optional API customer reference</span><input value={customerId} maxLength={64} onChange={(event) => setCustomerId(event.target.value)} placeholder="Optional customer identifier" className={fieldClassName} /></label></div><section className="rounded-md bg-[#f5eee5] p-2.5"><div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_80px_auto] sm:items-end"><label className={labelClassName}>Product<select value={productId} onChange={(event) => setProductId(event.target.value)} className={`${fieldClassName} h-8 text-[10px]`}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} — {formatTransactionMoney(product.price)}</option>)}</select></label><label className={labelClassName}>Qty<input value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" min="1" className={`${fieldClassName} h-8 text-[10px]`} /></label><button type="button" onClick={addItem} className="form-add-button">+ Add Item</button></div>{items.length > 0 && <div className="mt-2 grid gap-1 rounded-md bg-white/60 p-2">{items.map((item, index) => <div key={`${item.productId}-${index}`} className="grid grid-cols-[minmax(0,1fr)_45px_90px_20px] gap-2 border-b border-[#eee6dc] py-1 text-[9px] last:border-0"><span className="truncate">{item.product}</span><span>{item.quantity}</span><span>{formatTransactionMoney(item.quantity * item.price)}</span><button type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-[#9b5549]">×</button></div>)}</div>}</section><label className={labelClassName}>Total (calculated by API)<input readOnly value={formatTransactionMoney(total)} className={`${fieldClassName} h-8 bg-[#f8f3ec] text-[10px]`} /></label><label className={labelClassName}>Notes<textarea name="notes" defaultValue={editing?.notes ?? ""} placeholder="Optional kitchen or customer notes" className="min-h-14 rounded-md border border-[#e2d6c6] bg-white px-2.5 py-2 text-[10px] outline-none focus:border-[#805336]" /></label><div className="flex justify-end gap-2"><button type="button" onClick={closeForm} className="h-8 rounded-md border border-[#e2d6c6] px-4 text-[10px] text-[#69594d]">Cancel</button><button type="submit" disabled={!items.length || (serviceType === "dine_in" && (!tableId || !availableTables.length))} className="h-8 rounded-md bg-[#28180f] px-4 text-[10px] font-medium text-white disabled:opacity-50">{editing ? "Save Draft" : "Create Draft"}</button></div></form></TransactionDialog>}
  </TransactionLayout>;
}
