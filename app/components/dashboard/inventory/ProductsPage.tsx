"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { boardsApi, listApiRecords, type ApiRecord } from "../../../../lib/api-client";
import { InventoryDialog, InventoryLayout, invAction, invDelete, invField, invLabel, type InventoryRole } from "./InventoryLayout";

type Product = { id: number; name: string; category: string; price: number; quantity: number | null; available: boolean; description: string };
type MenuCategory = { id: number; name: string };
function text(value: unknown) { return typeof value === "string" ? value : ""; }
function quantity(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function toProduct(record: ApiRecord): Product { return { id: Number(record.id), name: text(record.name), category: text(record.category_name), price: Number(record.base_price ?? 0), quantity: quantity(record.available_to_sell), available: record.is_available !== false, description: text(record.description) }; }
function toCategory(record: ApiRecord): MenuCategory { return { id: Number(record.id), name: text(record.name) }; }

export default function ProductsPage({ role }: { role: InventoryRole }) {
  const [rows, setRows] = useState<Product[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [productPayload, categoryPayload] = await Promise.all([boardsApi.menuProducts(), boardsApi.menuCategories()]);
      setRows(listApiRecords(productPayload).map(toProduct)); setCategories(listApiRecords(categoryPayload).map(toCategory)); setError("");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to load products."); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const visible = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q.toLowerCase()));
  function close() { setOpen(false); setEdit(null); setError(""); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const categoryName = String(form.get("category") || "").trim();
    const price = String(form.get("price") || "").trim();
    if (!name || !categoryName || !price) { setError("Name, category, and price are required."); return; }
    try {
      let category = categories.find((item) => item.name.toLowerCase() === categoryName.toLowerCase());
      if (!category) {
        const created = await boardsApi.createMenuCategory({ name: categoryName, description: "", is_active: true });
        category = toCategory(created);
      }
      const body = { name, category: category.id, base_price: price, description: String(form.get("description") || "").trim(), is_available: form.get("status") === "Active" };
      if (edit) await boardsApi.updateMenuProduct(edit.id, body); else await boardsApi.createMenuProduct(body);
      close(); await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to save this product."); }
  }

  async function remove(product: Product) {
    if (!window.confirm(`Delete ${product.name}?`)) return;
    try { await boardsApi.deleteMenuProduct(product.id); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to delete this product."); }
  }

  return <InventoryLayout role={role} title="Products" search={q} onSearchChange={setQ} onCreate={() => { setEdit(null); setError(""); setOpen(true); }}>
    {error && !open && <p role="alert" className="mx-3 mt-3 rounded-md bg-red-50 p-2 text-[11px] text-red-700">{error}</p>}
    <section className="relative z-10 flex min-h-0 flex-1 p-3 sm:p-4"><div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95"><div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[760px] border-collapse text-left"><thead className="sticky top-0 bg-[#f0e5d4] text-[9px]"><tr className="h-8 border-b"><th className="w-8 px-2.5">□</th>{["Product", "Category", "Price", "Quantity", "Availability"].map((heading) => <th key={heading} className="px-2.5">{heading} ↕</th>)}<th className="px-2.5 text-right">Actions</th></tr></thead><tbody className="text-[10px] text-[#55463a]">{visible.map((row) => <tr key={row.id} className="h-9 border-b border-[#eee6dc]"><td className="px-2.5"><input type="checkbox" className="h-3 w-3" /></td><td className="px-2.5 font-medium">{row.name}</td><td className="px-2.5">{row.category || "-"}</td><td className="px-2.5">Rwf {row.price.toLocaleString()}</td><td className="px-2.5">{row.quantity === null ? "-" : row.quantity.toLocaleString()}</td><td className="px-2.5">{row.available ? "Active" : "Inactive"}</td><td className="px-2.5 text-right"><button type="button" onClick={() => { setEdit(row); setError(""); setOpen(true); }} className={invAction}>Edit</button><button type="button" onClick={() => void remove(row)} className={invDelete}>Delete</button></td></tr>)}</tbody></table></div>{isLoading ? <div className="flex flex-1 items-center justify-center text-[10px] text-[#8e8074]">Loading products…</div> : !visible.length && <div className="flex flex-1 items-center justify-center text-center text-[10px] text-[#8e8074]">No products returned by the API.</div>}<div className="flex min-h-9 items-center justify-between border-t px-3 text-[9px] text-[#817367]"><span>Showing {visible.length} entries</span><span>Live API data</span></div></div></section>
    {open && <InventoryDialog title={edit ? "Update Product" : "Create Product"} description="Create and manage sellable menu products." onClose={close}><form onSubmit={save} className="grid gap-3 sm:grid-cols-2">{error && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700 sm:col-span-2">{error}</p>}<label className={invLabel}>Product Name<input required name="name" defaultValue={edit?.name ?? ""} className={invField} /></label><label className={invLabel}>Category<input required list="menu-categories" name="category" defaultValue={edit?.category ?? ""} placeholder="Type a category" className={invField} /><datalist id="menu-categories">{categories.map((category) => <option key={category.id} value={category.name} />)}</datalist></label><label className={invLabel}>Price (RWF)<input required name="price" type="number" min="0" step="0.01" defaultValue={edit?.price ?? ""} className={invField} /></label><label className={invLabel}>Status<select name="status" defaultValue={edit?.available === false ? "Inactive" : "Active"} className={invField}><option>Active</option><option>Inactive</option></select></label><label className={`${invLabel} sm:col-span-2`}>Description<textarea name="description" defaultValue={edit?.description ?? ""} className="min-h-20 rounded-md border border-[#e2d6c6] bg-white p-2 text-[10px] outline-none" /></label><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={close} className="h-8 rounded-md border px-4 text-[10px]">Cancel</button><button className="h-8 rounded-md bg-[#28180f] px-4 text-[10px] text-white">Save Product</button></div></form></InventoryDialog>}
  </InventoryLayout>;
}
