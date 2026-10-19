"use client";

import { TableCell } from "@/app/components/dashboard/TableCell";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { useAccessControl } from "../AccessControl";
import { ApiRequestError, boardsApi, createIdempotencyKey, listApiRecords, subscribeToApiDataChanges, type ApiRecord } from "../../../../lib/api-client";
import { actionButtonClassName, fieldClassName, labelClassName, TransactionLayout, type TransactionRole } from "./TransactionLayout";

type Ingredient = { id: number; name: string; required: number; onHand: number };
type Recipe = { id: number; name: string; productId: number; product: string; ingredients: Ingredient[] };
type ProductStock = { productId: number; name: string; quantity: number; unit: string };
type ProductionInput = { id: number; itemId: number; name: string; inputQuantity: number; wasteQuantity: number };
type ProductionRun = { id: number; recipe: string; outputProduct: string; outputQuantity: number; status: string; inputs: ProductionInput[]; createdAt: string };
type RecipeQuantities = Record<number, Record<number, string>>;

const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function toProductionRun(record: ApiRecord): ProductionRun {
  const inputs = Array.isArray(record.inputs) ? record.inputs.filter((entry): entry is ApiRecord => !!entry && typeof entry === "object").map((input) => ({
    id: number(input.id),
    itemId: number(input.inventory_item),
    name: text(input.inventory_item_name) || "Inventory item",
    inputQuantity: number(input.input_quantity),
    wasteQuantity: number(input.waste_quantity),
  })) : [];
  return { id: number(record.id), recipe: text(record.recipe_name) || `Recipe ${record.recipe ?? ""}`, outputProduct: text(record.output_product_name) || "Product", outputQuantity: number(record.output_quantity), status: text(record.status) || "in_progress", inputs, createdAt: text(record.created_at) };
}

function recipeDefaults(recipe: Recipe) {
  return Object.fromEntries(recipe.ingredients.map((ingredient) => [ingredient.id, String(ingredient.required)]));
}

const THROTTLE_RETRY_DELAY_MS = 1_100;
const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

/** A 429 response is rejected before the write is handled, so it is safe to retry once. */
async function retryWhenThrottled<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (cause) {
    if (!(cause instanceof ApiRequestError) || cause.status !== 429) throw cause;
    await wait(THROTTLE_RETRY_DELAY_MS);
    return request();
  }
}

export default function ProductionPage({ role }: { role: TransactionRole }) {
  const { can } = useAccessControl();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [runs, setRuns] = useState<ProductionRun[]>([]);
  const [productStocks, setProductStocks] = useState<ProductStock[]>([]);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<number[]>([]);
  const [inputs, setInputs] = useState<RecipeQuantities>({});
  const [waste, setWaste] = useState<RecipeQuantities>({});
  const [outputQuantities, setOutputQuantities] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const loadInFlight = useRef<Promise<void> | null>(null);

  const load = useCallback(() => {
    if (loadInFlight.current) return loadInFlight.current;

    const request = (async () => {
      setIsLoading(true);
      try {
        // The deployed API deliberately throttles bursts. Loading these resources in
        // sequence keeps the screen responsive without repeatedly tripping that limit.
        const recipePayload = await retryWhenThrottled(() => boardsApi.recipes("?page_size=100&is_active=true"));
        const balancePayload = await retryWhenThrottled(() => boardsApi.stockBalances("?page_size=100"));
        const runPayload = await retryWhenThrottled(() => boardsApi.productionRuns("?page_size=100"));
        const productStockPayload = await retryWhenThrottled(() => boardsApi.productionProductStockBalances("?page_size=100"));
        const balances = new Map(listApiRecords(balancePayload).map((row) => [number(row.item), number(row.quantity)]));
        const sourceRecipes = listApiRecords(recipePayload);
        const nextRecipes: Recipe[] = [];
        for (const recipe of sourceRecipes) {
          const ingredientsPayload = Array.isArray(recipe.ingredients) ? recipe.ingredients : await retryWhenThrottled(() => boardsApi.recipeIngredients(String(recipe.id)));
          const ingredients = listApiRecords(ingredientsPayload).map((ingredient) => ({ id: number(ingredient.inventory_item), name: text(ingredient.inventory_item_name) || "Inventory item", required: number(ingredient.quantity_required), onHand: balances.get(number(ingredient.inventory_item)) ?? 0 })).filter((ingredient) => ingredient.id);
          nextRecipes.push({ id: number(recipe.id), name: text(recipe.name) || text(recipe.product_name), productId: number(recipe.product), product: text(recipe.product_name) || "Product", ingredients });
        }
        setRecipes(nextRecipes.filter((recipe) => recipe.id && recipe.productId && recipe.ingredients.length));
        setRuns(listApiRecords(runPayload).map(toProductionRun).filter((run) => run.id));
        setProductStocks(listApiRecords(productStockPayload).map((stock) => ({ productId: number(stock.product), name: text(stock.product_name) || "Product", quantity: number(stock.quantity), unit: text(stock.unit) || "units" })).filter((stock) => stock.productId));
        setError("");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t load production data."); }
      finally { setIsLoading(false); }
    })();
    loadInFlight.current = request;
    void request.finally(() => { if (loadInFlight.current === request) loadInFlight.current = null; });
    return request;
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const refresh = () => { void load(); };
    const unsubscribe = subscribeToApiDataChanges(refresh);
    window.addEventListener("focus", refresh);
    return () => { window.clearTimeout(timer); unsubscribe(); window.removeEventListener("focus", refresh); };
  }, [load]);

  const selectedRecipes = useMemo(() => selectedRecipeIds.map((id) => recipes.find((recipe) => recipe.id === id)).filter((recipe): recipe is Recipe => !!recipe), [recipes, selectedRecipeIds]);
  const selectedStockByProduct = useMemo(() => new Map(productStocks.map((stock) => [stock.productId, stock])), [productStocks]);
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    const totals = new Map<number, { name: string; onHand: number; requested: number }>();
    for (const recipe of selectedRecipes) for (const ingredient of recipe.ingredients) {
      const input = number(inputs[recipe.id]?.[ingredient.id] ?? ingredient.required);
      const loss = number(waste[recipe.id]?.[ingredient.id] ?? 0);
      if (input <= 0) errors.push(`${recipe.name}: ${ingredient.name} input must be greater than zero.`);
      if (loss < 0 || loss > input) errors.push(`${recipe.name}: ${ingredient.name} waste must be between 0 and the input quantity.`);
      const total = totals.get(ingredient.id) ?? { name: ingredient.name, onHand: ingredient.onHand, requested: 0 };
      total.requested += input;
      totals.set(ingredient.id, total);
    }
    for (const item of totals.values()) if (item.requested > item.onHand) errors.push(`${item.name}: the selected recipes need ${item.requested}, but only ${item.onHand} is in inventory.`);
    return errors;
  }, [inputs, selectedRecipes, waste]);

  function selectRecipes(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextIds = Array.from(event.currentTarget.selectedOptions, (option) => Number(option.value)).filter(Boolean);
    const nextRecipes = nextIds.map((id) => recipes.find((recipe) => recipe.id === id)).filter((recipe): recipe is Recipe => !!recipe);
    setSelectedRecipeIds(nextIds);
    setInputs((current) => Object.fromEntries(nextRecipes.map((recipe) => [recipe.id, current[recipe.id] ?? recipeDefaults(recipe)])));
    setWaste((current) => Object.fromEntries(nextRecipes.map((recipe) => [recipe.id, current[recipe.id] ?? {}])));
    setOutputQuantities((current) => Object.fromEntries(nextRecipes.map((recipe) => [recipe.id, current[recipe.id] ?? "1"])));
    setError("");
  }

  function updateQuantity(kind: "input" | "waste", recipeId: number, ingredientId: number, value: string) {
    const setValues = kind === "input" ? setInputs : setWaste;
    setValues((current) => ({ ...current, [recipeId]: { ...current[recipeId], [ingredientId]: value } }));
  }

  async function startProduction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRecipes.length || !can("production.create")) return;
    if (selectedRecipes.some((recipe) => number(outputQuantities[recipe.id]) <= 0)) { setError("Enter an output quantity greater than zero for every selected recipe."); return; }
    if (validationErrors.length) { setError(validationErrors[0]); return; }
    const idempotencyKeys = selectedRecipes.map(() => createIdempotencyKey());
    if (idempotencyKeys.some((key) => !key)) { setError("We couldn’t prepare these production records. Please try again."); return; }
    setIsSaving(true);
    let createdCount = 0;
    try {
      for (const [index, recipe] of selectedRecipes.entries()) {
        await retryWhenThrottled(() => boardsApi.createProductionRun({ recipe: recipe.id, output_quantity: String(number(outputQuantities[recipe.id])), status: "in_progress", inputs: recipe.ingredients.map((ingredient) => ({ inventory_item: ingredient.id, input_quantity: String(number(inputs[recipe.id]?.[ingredient.id] ?? ingredient.required)), waste_quantity: String(number(waste[recipe.id]?.[ingredient.id] ?? 0)) })), idempotency_key: idempotencyKeys[index] }));
        createdCount += 1;
      }
      setSelectedRecipeIds([]); setInputs({}); setWaste({}); setOutputQuantities({});
      await load();
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "We couldn’t start production.";
      setError(createdCount ? `${createdCount} of ${selectedRecipes.length} production runs were started. The remaining run was not started: ${detail}` : detail);
      await load();
    } finally { setIsSaving(false); }
  }

  async function completeProduction(run: ProductionRun) {
    if (!can("production.update") || !window.confirm(`Mark ${run.recipe} as done? This will add ${run.outputQuantity} ${run.outputProduct} to finished-product inventory.`)) return;
    setIsSaving(true);
    try { await retryWhenThrottled(() => boardsApi.updateProductionRun(run.id, { status: "done" })); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t complete this production run."); }
    finally { setIsSaving(false); }
  }

  return <TransactionLayout role={role} title="Production" search="" onSearchChange={() => undefined} requiredPermission="production.view">
    <section className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-3 sm:p-4">
      {error && <p role="alert" className="rounded-md bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}
      <article className="rounded-xl border border-[#e5dacd] bg-[#fcf9f4]/95 p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="m-0 text-[15px] font-semibold text-[#392d26]">Record production</h1><p className="mb-0 mt-1 text-[10px] leading-4 text-[#76685c]">Select one or more recipes. Each recipe is recorded as its own in-progress run, with its own output and raw-material inputs.</p></div><span className="rounded-full bg-[#e6f1e6] px-2.5 py-1 text-[9px] font-medium text-[#456442]">Production records</span></div>
        <form onSubmit={startProduction} className="mt-4 grid gap-3">
          <label className={labelClassName}>Recipes<select multiple value={selectedRecipeIds.map(String)} onChange={selectRecipes} size={Math.min(Math.max(recipes.length + 1, 3), 7)} disabled={isSaving || !can("production.create")} className={`${fieldClassName} h-auto min-h-24 py-1`}><option disabled value="">Select one or more recipes</option>{recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name} → {recipe.product}</option>)}</select><span className="text-[9px] font-normal text-[#76685c]">Use Ctrl (Windows) or ⌘ (Mac) to select several recipes.</span></label>
          {!isLoading && !recipes.length && <p className="m-0 rounded-md bg-[#f5eee5] p-2 text-[10px] text-[#6f6054]">No active recipes are ready for production. Create a recipe in Inventory → Recipes and add at least one inventory item.</p>}
          {selectedRecipes.map((recipe) => {
            const stock = selectedStockByProduct.get(recipe.productId);
            return <section key={recipe.id} className="grid gap-3 rounded-lg border border-[#e5dacd] bg-[#f8f3ec] p-3"><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]"><div><h2 className="m-0 text-[12px] font-semibold">{recipe.name}</h2><p className="mb-0 mt-1 text-[10px] text-[#76685c]">Output product: <strong>{recipe.product}</strong> · current finished-product stock: <strong>{stock ? `${stock.quantity} ${stock.unit}` : "0 units"}</strong></p></div><label className={labelClassName}>Output quantity<input value={outputQuantities[recipe.id] ?? "1"} onChange={(event) => setOutputQuantities((current) => ({ ...current, [recipe.id]: event.target.value }))} type="number" min="0.001" step="0.001" disabled={isSaving || !can("production.create")} className={fieldClassName} /></label></div><div className="overflow-x-auto rounded-lg border border-[#e5dacd]"><table className="w-full min-w-[720px] border-collapse text-left text-[10px]"><thead className="bg-[#f0e5d4] text-[#4b3b2f]"><tr><th className="px-4 py-2">Inventory item</th><th className="px-4 py-2">In inventory</th><th className="px-4 py-2">Input</th><th className="px-4 py-2">Waste</th><th className="px-4 py-2">Usable input</th></tr></thead><tbody>{recipe.ingredients.map((ingredient) => { const input = number(inputs[recipe.id]?.[ingredient.id] ?? ingredient.required); const loss = number(waste[recipe.id]?.[ingredient.id] ?? 0); return <tr key={ingredient.id} className="border-t border-[#eee6dc]"><TableCell className="px-4 py-2.5 font-medium">{ingredient.name}</TableCell><TableCell className="px-4 py-2.5">{ingredient.onHand}</TableCell><TableCell className="px-4 py-2.5"><input value={inputs[recipe.id]?.[ingredient.id] ?? String(ingredient.required)} onChange={(event) => updateQuantity("input", recipe.id, ingredient.id, event.target.value)} type="number" min="0.001" max={ingredient.onHand} step="0.001" disabled={isSaving || !can("production.create")} className="h-8 w-28 rounded border border-[#e2d6c6] bg-white px-2 disabled:bg-[#f8f3ec]" /></TableCell><TableCell className="px-4 py-2.5"><input value={waste[recipe.id]?.[ingredient.id] ?? "0"} onChange={(event) => updateQuantity("waste", recipe.id, ingredient.id, event.target.value)} type="number" min="0" max={input} step="0.001" disabled={isSaving || !can("production.create")} className="h-8 w-28 rounded border border-[#e2d6c6] bg-white px-2 disabled:bg-[#f8f3ec]" /></TableCell><TableCell className="px-4 py-2.5">{Math.max(0, input - loss)}</TableCell></tr>; })}</tbody></table></div></section>;
          })}
          {selectedRecipes.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3"><p className="m-0 max-w-xl text-[10px] leading-4 text-[#76685c]">Input includes waste and cannot exceed live raw-material stock across all selected recipes. Each run is saved as <strong>In progress</strong>.</p>{can("production.create") && <button type="submit" disabled={isSaving || validationErrors.length > 0} className="h-8 rounded-md bg-[#28180f] px-4 text-[10px] font-medium text-white disabled:opacity-50">{isSaving ? "Saving…" : `Start ${selectedRecipes.length} production run${selectedRecipes.length === 1 ? "" : "s"}`}</button>}</div>}
        </form>
      </article>
      <article className="overflow-hidden rounded-xl border border-[#e5dacd] bg-[#fcf9f4]/95 shadow-sm"><div className="border-b border-[#e2d6c6] bg-[#f0e5d4] px-4 py-3"><h2 className="m-0 text-[12px] font-semibold">Production runs</h2><p className="mb-0 mt-1 text-[9px] text-[#76685c]">Only completed runs increase finished-product inventory.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] border-collapse text-left text-[10px]"><thead className="bg-[#f8f3ec] text-[#4b3b2f]"><tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Recipe / output</th><th className="px-4 py-2">Inputs</th><th className="px-4 py-2">Output qty</th><th className="px-4 py-2">Status</th><th className="px-4 py-2 text-right">Action</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id} className="border-t border-[#eee6dc]"><TableCell className="whitespace-nowrap px-4 py-2.5">{run.createdAt.slice(0, 10) || "-"}</TableCell><TableCell className="px-4 py-2.5"><strong className="font-medium">{run.recipe}</strong><span className="block text-[#76685c]">{run.outputProduct}</span></TableCell><TableCell className="max-w-64 px-4 py-2.5 text-[#76685c]">{run.inputs.map((input) => `${input.name} ×${input.inputQuantity}${input.wasteQuantity ? ` (waste ${input.wasteQuantity})` : ""}`).join(", ") || "-"}</TableCell><TableCell className="px-4 py-2.5">{run.outputQuantity}</TableCell><TableCell className="px-4 py-2.5 capitalize">{run.status.replaceAll("_", " ")}</TableCell><TableCell className="px-4 py-2.5 text-right">{run.status === "in_progress" && can("production.update") && <button type="button" disabled={isSaving} onClick={() => void completeProduction(run)} className={actionButtonClassName}>Mark done</button>}</TableCell></tr>)}</tbody></table></div>{isLoading ? <p className="p-5 text-center text-[10px] text-[#76685c]">Loading production runs…</p> : !runs.length && <p className="p-5 text-center text-[10px] text-[#76685c]">No production runs have been recorded.</p>}</article>
      <article className="overflow-hidden rounded-xl border border-[#e5dacd] bg-[#fcf9f4]/95 shadow-sm"><div className="border-b border-[#e2d6c6] bg-[#f0e5d4] px-4 py-3"><h2 className="m-0 text-[12px] font-semibold">Finished-product inventory</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[520px] border-collapse text-left text-[10px]"><thead className="bg-[#f8f3ec] text-[#4b3b2f]"><tr><th className="px-4 py-2">Product</th><th className="px-4 py-2">Available quantity</th><th className="px-4 py-2">Unit</th></tr></thead><tbody>{productStocks.map((stock) => <tr key={stock.productId} className="border-t border-[#eee6dc]"><TableCell className="px-4 py-2.5 font-medium">{stock.name}</TableCell><TableCell className="px-4 py-2.5">{stock.quantity}</TableCell><TableCell className="px-4 py-2.5">{stock.unit}</TableCell></tr>)}</tbody></table></div>{!isLoading && !productStocks.length && <p className="p-5 text-center text-[10px] text-[#76685c]">No finished-product inventory has been recorded.</p>}</article>
    </section>
  </TransactionLayout>;
}
