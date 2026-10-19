"use client";

import { TableCell } from "@/app/components/dashboard/TableCell";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Can, PermissionRouteGuard, useAccessControl } from "../AccessControl";
import { boardsApi, listApiRecords, subscribeToApiDataChanges, type ApiRecord } from "../../../../lib/api-client";
import { InventoryDialog, InventoryLayout, invAction, invDelete, invField, invLabel, type InventoryRole } from "./InventoryLayout";

type RecipeIngredient = { id: number; inventoryItemId: number; name: string; quantity: string; unit: string; notes: string };
type Recipe = { id: number; name: string; productId: number; product: string; instructions: string; servings: string; active: boolean; ingredients: RecipeIngredient[] };
type Product = { id: number; name: string; available: boolean };
type InventoryItem = { id: number; name: string; unit: string; active: boolean };
type IngredientDraft = { id?: number; inventoryItemId: number; quantity: string; notes: string };

const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

function toIngredient(record: ApiRecord): RecipeIngredient {
  return {
    id: number(record.id),
    inventoryItemId: number(record.inventory_item),
    name: text(record.inventory_item_name) || "Inventory item",
    quantity: text(record.quantity_required) || "0",
    unit: text(record.unit_symbol) || text(record.unit_name),
    notes: text(record.notes),
  };
}

function toRecipe(record: ApiRecord, ingredients: RecipeIngredient[]): Recipe {
  return {
    id: number(record.id),
    name: text(record.name) || text(record.product_name) || "Recipe",
    productId: number(record.product),
    product: text(record.product_name) || "Product",
    instructions: text(record.instructions),
    servings: text(record.servings),
    active: record.is_active !== false,
    ingredients,
  };
}

export default function RecipesPage({ role }: { role: InventoryRole }) {
  const { can } = useAccessControl();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([{ inventoryItemId: 0, quantity: "1", notes: "" }]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [recipePayload, productPayload, inventoryPayload] = await Promise.all([
        boardsApi.recipes("?page_size=100"),
        boardsApi.menuProducts(),
        boardsApi.inventoryItems("?page_size=100"),
      ]);
      const sourceRecipes = listApiRecords(recipePayload);
      const loadedRecipes = await Promise.all(sourceRecipes.map(async (record) => {
        const sourceIngredients = Array.isArray(record.ingredients) ? record.ingredients : await boardsApi.recipeIngredients(String(record.id));
        return toRecipe(record, listApiRecords(sourceIngredients).map(toIngredient).filter((ingredient) => ingredient.inventoryItemId));
      }));
      setRecipes(loadedRecipes.filter((recipe) => recipe.id && recipe.productId));
      setProducts(listApiRecords(productPayload).map((record) => ({ id: number(record.id), name: text(record.name), available: record.is_available !== false })).filter((product) => product.id && product.name));
      setInventoryItems(listApiRecords(inventoryPayload).map((record) => ({ id: number(record.id), name: text(record.name), unit: text(record.base_unit_symbol) || text(record.base_unit_name), active: record.is_active !== false })).filter((item) => item.id && item.name));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t load recipes.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const unsubscribe = subscribeToApiDataChanges(() => { void load(); });
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [load]);

  const visible = recipes.filter((recipe) => JSON.stringify(recipe).toLowerCase().includes(search.toLowerCase()));
  const unusedProducts = products.filter((product) => product.available && (!recipes.some((recipe) => recipe.productId === product.id) || product.id === editing?.productId));

  function close() {
    if (isSaving) return;
    setOpen(false);
    setEditing(null);
    setIngredients([{ inventoryItemId: 0, quantity: "1", notes: "" }]);
    setSelectedProductId("");
    setError("");
  }

  function openCreate() {
    setEditing(null);
    setIngredients([{ inventoryItemId: 0, quantity: "1", notes: "" }]);
    setSelectedProductId("");
    setError("");
    setOpen(true);
  }

  function openEdit(recipe: Recipe) {
    setEditing(recipe);
    setSelectedProductId(String(recipe.productId));
    setIngredients(recipe.ingredients.map((ingredient) => ({ id: ingredient.id, inventoryItemId: ingredient.inventoryItemId, quantity: ingredient.quantity, notes: ingredient.notes })));
    setError("");
    setOpen(true);
  }

  function updateIngredient(index: number, next: Partial<IngredientDraft>) {
    setIngredients((current) => current.map((ingredient, currentIndex) => currentIndex === index ? { ...ingredient, ...next } : ingredient));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const productId = Number(selectedProductId);
    const name = String(form.get("name") || "").trim();
    const ingredientItems = ingredients.filter((ingredient) => ingredient.inventoryItemId);
    const duplicateItems = new Set<number>();
    const seenItems = new Set<number>();
    for (const ingredient of ingredientItems) {
      if (seenItems.has(ingredient.inventoryItemId)) duplicateItems.add(ingredient.inventoryItemId);
      seenItems.add(ingredient.inventoryItemId);
    }
    if (!productId || !name) { setError("Choose the output product and enter a recipe name."); return; }
    if (!ingredientItems.length) { setError("Add at least one inventory item to the recipe."); return; }
    if (ingredientItems.length !== ingredients.length || ingredientItems.some((ingredient) => !Number.isFinite(Number(ingredient.quantity)) || Number(ingredient.quantity) <= 0)) { setError("Choose an inventory item and a quantity greater than zero for every ingredient."); return; }
    if (duplicateItems.size) { setError("Each inventory item can be used only once in this recipe."); return; }

    setIsSaving(true);
    let recipeId = editing?.id;
    try {
      const recipeBody: ApiRecord = {
        name,
        instructions: String(form.get("instructions") || "").trim(),
        servings: Number(form.get("servings") || 0),
        is_active: form.get("is_active") === "on",
      };
      if (editing) {
        await boardsApi.updateRecipe(editing.id, recipeBody);
      } else {
        const created = await boardsApi.createRecipe({ ...recipeBody, product: productId });
        recipeId = number(created.id);
      }
      if (!recipeId) throw new Error("We couldn’t prepare this recipe. Please try again.");

      const originalIds = new Set(editing?.ingredients.map((ingredient) => ingredient.id) ?? []);
      const nextIds = new Set(ingredientItems.map((ingredient) => ingredient.id).filter((id): id is number => !!id));
      for (const ingredientId of originalIds) {
        if (!nextIds.has(ingredientId)) await boardsApi.deleteRecipeIngredient(recipeId, ingredientId);
      }
      for (const ingredient of ingredientItems) {
        const body = { inventory_item: ingredient.inventoryItemId, quantity_required: ingredient.quantity, notes: ingredient.notes.trim() };
        if (ingredient.id) await boardsApi.updateRecipeIngredient(recipeId, ingredient.id, body);
        else await boardsApi.createRecipeIngredient(recipeId, body);
      }
      close();
      await load();
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "We couldn’t save this recipe.";
      if (recipeId && !editing) {
        setOpen(false);
        setError(`The recipe was created, but one or more ingredients were not saved: ${detail}`);
        await load();
      } else {
        setError(detail);
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(recipe: Recipe) {
    if (!window.confirm(`Delete the ${recipe.name} recipe? This does not delete ${recipe.product}.`)) return;
    try {
      await boardsApi.deleteRecipe(recipe.id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t delete this recipe.");
    }
  }

  return <PermissionRouteGuard permission="recipes.view" fallback={`/dashboard/${role}/inventory`}><InventoryLayout role={role} title="Recipes" search={search} onSearchChange={setSearch} createLabel="Create Recipe" createPermission="recipes.create" onCreate={openCreate}>
    {error && !open && <p role="alert" className="mx-3 mt-3 rounded-md bg-red-50 p-2 text-[11px] text-red-700">{error}</p>}
    <section className="relative z-10 flex min-h-0 flex-1 p-3 sm:p-4"><div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95"><div className="border-b border-[#e2d6c6] bg-[#f5eee5] px-3 py-2 text-[10px] text-[#69594d]">A recipe connects one sellable product with one or more inventory items. Select recipes in Production to start their own production runs.</div><div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[760px] border-collapse text-left"><thead className="sticky top-0 bg-[#f0e5d4] text-[9px]"><tr className="h-8 border-b">{["Recipe", "Output product", "Inventory items", "Status"].map((heading) => <th key={heading} className="px-2.5">{heading}</th>)}<th className="px-2.5 text-right">Actions</th></tr></thead><tbody className="text-[10px] text-[#55463a]">{visible.map((recipe) => <tr key={recipe.id} className="border-b border-[#eee6dc]"><TableCell className="px-2.5 py-2 font-medium">{recipe.name}</TableCell><TableCell className="px-2.5 py-2">{recipe.product}</TableCell><TableCell className="max-w-96 px-2.5 py-2 text-[#69594d]">{recipe.ingredients.map((ingredient) => `${ingredient.name} ×${ingredient.quantity}${ingredient.unit ? ` ${ingredient.unit}` : ""}`).join(", ") || "No ingredients"}</TableCell><TableCell className="px-2.5 py-2">{recipe.active ? "Active" : "Inactive"}</TableCell><TableCell className="px-2.5 py-2 text-right"><Can permission="recipes.update"><button type="button" onClick={() => openEdit(recipe)} className={invAction}>Edit</button></Can><Can permission="recipes.delete"><button type="button" onClick={() => void remove(recipe)} className={invDelete}>Delete</button></Can></TableCell></tr>)}</tbody></table></div>{isLoading ? <div className="flex flex-1 items-center justify-center p-10 text-[10px] text-[#8e8074]">Loading recipes…</div> : !visible.length && <div className="flex flex-1 items-center justify-center p-10 text-center text-[10px] text-[#8e8074]">No recipes returned by the API. Create one with the inventory items it consumes.</div>}<div className="flex min-h-9 items-center justify-between border-t px-3 text-[9px] text-[#817367]"><span>Showing {visible.length} recipes</span><span>Live API data</span></div></div></section>
    {open && <InventoryDialog title={editing ? "Update Recipe" : "Create Recipe"} description="Choose the product this recipe makes, then add every inventory item it consumes." onClose={close}><form key={editing?.id ?? "new-recipe"} onSubmit={save} className="grid gap-3">{error && <p role="alert" className="m-0 rounded bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}<div className="grid gap-3 sm:grid-cols-2"><label className={invLabel}>Recipe name<input required name="name" defaultValue={editing?.name ?? ""} placeholder="e.g. Classic burger" className={invField} /></label><label className={invLabel}>Output product<select required value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} disabled={!!editing} className={invField}><option value="">Select product</option>{unusedProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label className={invLabel}>Batch servings<input name="servings" type="number" min="0" step="1" defaultValue={editing?.servings ?? "1"} className={invField} /></label><label className="flex items-end gap-2 pb-1 text-[10px]"><input name="is_active" type="checkbox" defaultChecked={editing?.active ?? true} /> Active recipe</label></div><label className={invLabel}>Instructions<textarea name="instructions" defaultValue={editing?.instructions ?? ""} placeholder="Optional preparation steps" className="min-h-16 rounded-md border border-[#e2d6c6] bg-white p-2 text-[10px] outline-none" /></label><section className="grid gap-2 rounded-lg border border-[#e5dacd] bg-[#f8f3ec] p-3"><div className="flex items-center justify-between gap-2"><div><h3 className="m-0 text-[11px] font-semibold">Inventory items</h3><p className="mb-0 mt-0.5 text-[9px] text-[#76685c]">Add as many inventory items as this recipe uses.</p></div><button type="button" onClick={() => setIngredients((current) => [...current, { inventoryItemId: 0, quantity: "1", notes: "" }])} className="form-add-button">+ Add item</button></div>{ingredients.map((ingredient, index) => <div key={ingredient.id ?? `new-${index}`} className="grid gap-2 rounded-md bg-white/75 p-2 sm:grid-cols-[minmax(0,1fr)_92px_minmax(0,1fr)_42px]"><label className={invLabel}>Inventory item<select required value={ingredient.inventoryItemId || ""} onChange={(event) => updateIngredient(index, { inventoryItemId: Number(event.target.value) })} className={invField}><option value="">Select item</option>{inventoryItems.filter((item) => item.active).map((item) => <option key={item.id} value={item.id} disabled={ingredients.some((other, otherIndex) => otherIndex !== index && other.inventoryItemId === item.id)}>{item.name}{item.unit ? ` (${item.unit})` : ""}</option>)}</select></label><label className={invLabel}>Qty<input required value={ingredient.quantity} onChange={(event) => updateIngredient(index, { quantity: event.target.value })} type="number" min="0.001" step="0.001" className={invField} /></label><label className={invLabel}>Preparation note<input value={ingredient.notes} onChange={(event) => updateIngredient(index, { notes: event.target.value })} maxLength={255} placeholder="Optional" className={invField} /></label><button type="button" onClick={() => setIngredients((current) => current.length === 1 ? current : current.filter((_, currentIndex) => currentIndex !== index))} disabled={ingredients.length === 1} className="self-end rounded px-2 py-2 text-[10px] text-[#9b5549] disabled:opacity-40">Remove</button></div>)}</section><div className="flex justify-end gap-2"><button type="button" onClick={close} disabled={isSaving} className="h-8 rounded border px-4 text-[10px]">Cancel</button><button disabled={isSaving || !can(editing ? "recipes.update" : "recipes.create")} className="h-8 rounded bg-[#28180f] px-4 text-[10px] text-white">{isSaving ? "Saving…" : editing ? "Save Recipe" : "Create Recipe"}</button></div></form></InventoryDialog>}
  </InventoryLayout></PermissionRouteGuard>;
}
