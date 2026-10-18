"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { boardsApi, listApiRecords, subscribeToApiDataChanges, type ApiRecord } from "../../../../lib/api-client";
import { actionButtonClassName, deleteButtonClassName, fieldClassName, formatTransactionMoney, labelClassName, TransactionDialog, TransactionLayout, type TransactionRole } from "./TransactionLayout";

type Category = { id: number; name: string };
type Expense = { id: number; date: string; category: string; description: string; vendor: string; paymentMethod: string; reference: string; notes: string; amount: number };

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function today() { return new Date().toISOString().slice(0, 10); }
function toCategory(record: ApiRecord): Category { return { id: number(record.id), name: text(record.name) }; }
function toExpense(record: ApiRecord): Expense {
  return { id: number(record.id), date: text(record.expense_date), category: text(record.category_name) || text(record.category), description: text(record.description), vendor: text(record.vendor), paymentMethod: text(record.payment_method), reference: text(record.reference), notes: text(record.notes), amount: number(record.amount) };
}

export default function ExpensesPage({ role }: { role: TransactionRole }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [expensePayload, categoryPayload] = await Promise.all([boardsApi.expenses("?page_size=100"), boardsApi.expenseCategories()]);
      setExpenses(listApiRecords(expensePayload).map(toExpense));
      setCategories(listApiRecords(categoryPayload).filter((category) => category.is_active !== false).map(toCategory));
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn’t load expenses. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const unsubscribe = subscribeToApiDataChanges(() => { void load(); });
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [load]);

  const visibleExpenses = useMemo(() => expenses.filter((expense) => JSON.stringify(expense).toLowerCase().includes(search.toLowerCase())), [expenses, search]);
  function closeForm() { setIsFormOpen(false); setEditing(null); setError(""); }
  function openCreateForm() { closeForm(); setIsFormOpen(true); }
  function openEditForm(expense: Expense) { setEditing(expense); setError(""); setIsFormOpen(true); }

  async function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const categoryName = String(form.get("category") || "").trim();
    const amount = String(form.get("amount") || "").trim();
    if (!categoryName || !Number.isFinite(Number(amount)) || Number(amount) <= 0) { setError("Enter an expense category and an amount greater than zero."); return; }
    setIsSaving(true);
    try {
      let category = categories.find((item) => item.name.toLowerCase() === categoryName.toLowerCase());
      if (!category) {
        const created = await boardsApi.createExpenseCategory({ name: categoryName, is_active: true });
        category = toCategory(created);
      }
      const description = String(form.get("description") || "").trim();
      const paymentMethod = String(form.get("payment_method") || "").trim();
      const reference = String(form.get("reference") || "").trim();
      const vendor = String(form.get("vendor") || "").trim();
      const notes = String(form.get("notes") || "").trim();
      const body: ApiRecord = {
        category: category.id,
        amount,
        expense_date: String(form.get("expense_date") || today()),
      };
      if (description) body.description = description;
      if (paymentMethod) body.payment_method = paymentMethod;
      if (reference) body.reference = reference;
      if (vendor) body.vendor = vendor;
      if (notes) body.notes = notes;
      if (editing) await boardsApi.updateExpense(editing.id, body); else await boardsApi.createExpense(body);
      closeForm();
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save this expense.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeExpense(expense: Expense) {
    if (!window.confirm(`Delete expense ${expense.reference || `#${expense.id}`}?`)) return;
    try {
      await boardsApi.deleteExpense(expense.id);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to delete this expense.");
    }
  }

  return <TransactionLayout role={role} title="Expenses" search={search} onSearchChange={setSearch} createLabel="Create New" onCreate={openCreateForm} requiredPermission="finance.view" createPermission="finance.create">
    {error && !isFormOpen && <p role="alert" className="mx-3 mt-3 rounded-md bg-red-50 p-2 text-[11px] text-red-700">{error}</p>}
    <section className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4"><div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95 shadow-[0_2px_10px_rgba(72,48,30,0.04)]"><div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[820px] border-collapse text-left"><thead className="sticky top-0 bg-[#f0e5d4] text-[9px] font-medium text-[#4b3b2f]"><tr className="h-8 border-b border-[#e2d6c6]">{["Date", "Reference", "Category", "Description", "Vendor", "Payment", "Amount"].map((heading) => <th key={heading} className="whitespace-nowrap px-2.5">{heading} ↕</th>)}<th className="px-2.5 text-right">Actions</th></tr></thead><tbody className="text-[10px] text-[#55463a]">{visibleExpenses.map((expense) => <tr key={expense.id} className="h-9 border-b border-[#eee6dc]"><td className="whitespace-nowrap px-2.5">{expense.date}</td><td className="px-2.5 font-medium">{expense.reference || `#${expense.id}`}</td><td className="px-2.5">{expense.category || "-"}</td><td className="px-2.5">{expense.description || "-"}</td><td className="px-2.5">{expense.vendor || "-"}</td><td className="px-2.5">{expense.paymentMethod || "-"}</td><td className="whitespace-nowrap px-2.5 font-medium">{formatTransactionMoney(expense.amount)}</td><td className="px-2.5 text-right"><div className="inline-flex gap-1"><button type="button" onClick={() => openEditForm(expense)} className={actionButtonClassName}>Edit</button><button type="button" onClick={() => void removeExpense(expense)} className={deleteButtonClassName}>Delete</button></div></td></tr>)}</tbody></table></div>{isLoading ? <div className="flex flex-1 items-center justify-center px-4 py-14 text-center text-[10px] text-[#8e8074]">Loading expenses…</div> : !visibleExpenses.length && <div className="flex flex-1 items-center justify-center px-4 py-14 text-center"><div><p className="m-0 text-[11px] font-medium text-[#897b6f]">No expenses returned by the API</p><p className="mb-0 mt-1 text-[9px] text-[#a09387]">Create an expense to add it to the live register.</p></div></div>}<div className="flex min-h-9 items-center justify-between border-t border-[#ebe2d7] px-2.5 text-[9px] text-[#817367] sm:px-3"><span>Showing {visibleExpenses.length} of {expenses.length} expenses</span><span>Live API data</span></div></div></section>
    {isFormOpen && <TransactionDialog title={editing ? "Update Expense" : "Create Expense"} description="Expenses are saved directly to the finance API and reflected on the dashboard." labelledBy="expense-form-title" onClose={closeForm}><form key={editing?.id ?? "new-expense"} onSubmit={saveExpense} className="grid gap-3">{error && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}<div className="grid gap-2 sm:grid-cols-2"><label className={labelClassName}>Expense date<input required name="expense_date" type="date" defaultValue={editing?.date || today()} className={fieldClassName} /></label><label className={labelClassName}>Category<input required name="category" list="expense-categories" defaultValue={editing?.category || ""} placeholder="e.g. Supplies" className={fieldClassName} /><datalist id="expense-categories">{categories.map((category) => <option key={category.id} value={category.name} />)}</datalist></label><label className={labelClassName}>Amount<input required name="amount" type="number" min="0.01" step="0.01" defaultValue={editing?.amount || ""} className={fieldClassName} /></label><label className={labelClassName}>Payment method<input name="payment_method" maxLength={40} defaultValue={editing?.paymentMethod || "Cash"} placeholder="Cash, mobile money…" className={fieldClassName} /></label><label className={labelClassName}>Vendor or payee<input name="vendor" maxLength={200} defaultValue={editing?.vendor || ""} placeholder="Optional" className={fieldClassName} /></label><label className={labelClassName}>Reference<input name="reference" maxLength={100} defaultValue={editing?.reference || ""} placeholder="Receipt or transaction ID" className={fieldClassName} /></label></div><label className={labelClassName}>Description<input name="description" maxLength={255} defaultValue={editing?.description || ""} placeholder="What was this expense for?" className={fieldClassName} /></label><label className={labelClassName}>Notes<textarea name="notes" defaultValue={editing?.notes || ""} placeholder="Optional additional context" className="min-h-16 rounded-md border border-[#e2d6c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#805336]" /></label><div className="flex justify-end gap-2"><button type="button" onClick={closeForm} disabled={isSaving} className="h-8 rounded-md border border-[#e2d6c6] px-4 text-[10px] text-[#69594d] disabled:opacity-50">Cancel</button><button type="submit" disabled={isSaving} className="h-8 rounded-md bg-[#28180f] px-4 text-[10px] font-medium text-white disabled:opacity-50">{isSaving ? "Saving…" : editing ? "Save Expense" : "Create Expense"}</button></div></form></TransactionDialog>}
  </TransactionLayout>;
}
