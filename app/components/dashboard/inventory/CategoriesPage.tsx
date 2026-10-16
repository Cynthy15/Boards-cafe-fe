"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { boardsApi, listApiRecords, type ApiRecord } from "../../../../lib/api-client";
import { InventoryDialog, InventoryLayout, invAction, invDelete, invField, invLabel, type InventoryRole } from "./InventoryLayout";

type Category = { id: number; name: string; description: string; isActive: boolean };
function toCategory(record: ApiRecord): Category { return { id: Number(record.id), name: typeof record.name === "string" ? record.name : "", description: typeof record.description === "string" ? record.description : "", isActive: record.is_active !== false }; }

export default function CategoriesPage({ role }: { role: InventoryRole }) {
  const [rows, setRows] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Category | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    try { setRows(listApiRecords(await boardsApi.inventoryCategories()).map(toCategory)); setError(""); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to load inventory categories."); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void loadCategories(); }, 0); return () => window.clearTimeout(timer); }, [loadCategories]);
  const visible = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
  function close() { setOpen(false); setEdit(null); setError(""); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) { setError("Category name is required."); return; }
    const body = { name, description: String(form.get("description") || "").trim(), is_active: form.get("status") === "active" };
    try {
      if (edit) await boardsApi.updateInventoryCategory(edit.id, body); else await boardsApi.createInventoryCategory(body);
      close(); await loadCategories();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to save this category."); }
  }

  async function deactivate(category: Category) {
    if (!window.confirm(`Deactivate ${category.name}?`)) return;
    try { await boardsApi.updateInventoryCategory(category.id, { is_active: false }); await loadCategories(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to deactivate this category."); }
  }

  return <InventoryLayout role={role} title="Categories" search={search} onSearchChange={setSearch} onCreate={() => { setEdit(null); setError(""); setOpen(true); }}>
    {error && !open && <p role="alert" className="mx-3 mt-3 rounded-md bg-red-50 p-2 text-[11px] text-red-700">{error}</p>}
    <section className="relative z-10 flex min-h-0 flex-1 p-3 sm:p-4"><div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95"><div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[760px] border-collapse text-left"><thead className="sticky top-0 bg-[#f0e5d4] text-[9px] font-medium"><tr className="h-8 border-b border-[#e2d6c6]"><th className="w-8 px-2.5">□</th>{["Category", "Description", "Status"].map((heading) => <th key={heading} className="px-2.5">{heading} ↕</th>)}<th className="px-2.5 text-right">Actions</th></tr></thead><tbody className="text-[10px] text-[#55463a]">{visible.map((row) => <tr key={row.id} className="border-b border-[#eee6dc]"><td className="px-2.5"><input type="checkbox" className="h-3 w-3" /></td><td className="px-2.5 font-medium">{row.name}</td><td className="px-2.5">{row.description || "-"}</td><td className="px-2.5">{row.isActive ? "Active" : "Inactive"}</td><td className="px-2.5 text-right"><button type="button" onClick={() => { setEdit(row); setError(""); setOpen(true); }} className={invAction}>Edit</button>{row.isActive && <button type="button" onClick={() => void deactivate(row)} className={invDelete}>Deactivate</button>}</td></tr>)}</tbody></table></div>{isLoading ? <div className="flex flex-1 items-center justify-center text-[10px] text-[#8e8074]">Loading categories…</div> : !visible.length && <div className="flex flex-1 items-center justify-center text-center text-[10px] text-[#8e8074]">No inventory categories returned by the API.</div>}<div className="flex min-h-9 items-center justify-between border-t border-[#ebe2d7] px-3 text-[9px] text-[#817367]"><span>{visible.length} categories</span><span>Live API data</span></div></div></section>
    {open && <InventoryDialog title={edit ? "Update Category" : "Create Category"} description="Add a category to organize live inventory items." onClose={close}><form onSubmit={save} className="grid gap-3"><>{error && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}</><label className={invLabel}>Category<input required name="name" defaultValue={edit?.name ?? ""} placeholder="Category name" className={invField} /></label><label className={invLabel}>Description<textarea name="description" defaultValue={edit?.description ?? ""} className="min-h-20 rounded-md border border-[#e2d6c6] bg-white p-2 text-[10px] outline-none" /></label><label className={invLabel}>Status<select name="status" defaultValue={edit?.isActive === false ? "inactive" : "active"} className={invField}><option value="active">Active</option><option value="inactive">Inactive</option></select></label><div className="flex justify-end gap-2"><button type="button" onClick={close} className="h-8 rounded-md border px-4 text-[10px]">Cancel</button><button className="h-8 rounded-md bg-[#28180f] px-4 text-[10px] text-white">{edit ? "Save Category" : "Create Category"}</button></div></form></InventoryDialog>}
  </InventoryLayout>;
}
