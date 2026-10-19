"use client";

import { recordReference } from "@/lib/display-reference";

import { TableCell } from "@/app/components/dashboard/TableCell";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { ApiRequestError, boardsApi, createIdempotencyKey, listApiRecords, subscribeToApiDataChanges, type ApiRecord } from "../../../../lib/api-client";
import { Can } from "../AccessControl";
import { fieldClassName, formatTransactionMoney, labelClassName, TransactionDialog, TransactionLayout, type TransactionRole } from "./TransactionLayout";

type SaleLine = { productId: number; name: string; quantity: number; price: number };
type MenuProduct = { id: number; name: string; price: number };
type Sale = { id: string; reference: string; date: string; items: SaleLine[]; total: number; balanceDue: number; paymentMethod: string; status: string };
type PaymentOption = { id: string | null; value: string; label: string; isDefault: boolean; order: number };

// These are the supported payment choices when payment setup has not been completed yet.
const fallbackPaymentOptions: PaymentOption[] = [
  { id: null, value: "cash", label: "Cash", isDefault: true, order: 0 },
  { id: null, value: "mobile_money", label: "Mobile money", isDefault: false, order: 1 },
  { id: null, value: "card", label: "Card", isDefault: false, order: 2 },
  { id: null, value: "bank_transfer", label: "Bank transfer", isDefault: false, order: 3 },
  { id: null, value: "other", label: "Other", isDefault: false, order: 4 },
];

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function identifier(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object") return identifier((value as ApiRecord).id);
  return "";
}
function toProduct(record: ApiRecord): MenuProduct { return { id: number(record.id), name: text(record.name), price: number(record.base_price) }; }

function toPaymentOptions(records: ApiRecord[]): PaymentOption[] {
  const acceptedPaymentTypes = new Set(["cash", "mobile_money", "card", "bank_transfer"]);
  const byPaymentValue = new Map<string, PaymentOption>();
  for (const record of records.filter((item) => item.is_active !== false)) {
    const configuredType = text(record.payment_type).toLowerCase();
    const value = acceptedPaymentTypes.has(configuredType) ? configuredType : "other";
    const option = { id: identifier(record.id) || null, value, label: text(record.name) || value.replaceAll("_", " "), isDefault: record.is_default === true, order: number(record.display_order) };
    const current = byPaymentValue.get(value);
    if (!current || (option.isDefault && !current.isDefault) || option.order < current.order) byPaymentValue.set(value, option);
  }
  return [...byPaymentValue.values()].sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.order - right.order || left.label.localeCompare(right.label));
}

function toSale(record: ApiRecord, payments: Map<string, ApiRecord>): Sale {
  const items = Array.isArray(record.items) ? record.items.filter((item): item is ApiRecord => !!item && typeof item === "object").map((item) => ({ productId: number(item.product), name: text(item.product_name) || "Menu item", quantity: number(item.quantity), price: number(item.unit_price) })) : [];
  const orderId = identifier(record.id);
  const reference = `#${recordReference(record.id, record.order_number)}`;
  const payment = payments.get(orderId);
  const total = number(record.total_amount);
  const balanceDue = number(record.balance_due);
  return { id: orderId || reference, reference, date: text(record.created_at).slice(0, 10), items, total, balanceDue: balanceDue > 0 ? balanceDue : total, paymentMethod: text(payment?.payment_method).replaceAll("_", " ") || "-", status: text(record.status) || "paid" };
}

function PaymentMethodSelect({ options }: { options: PaymentOption[] }) {
  return <select required name="payment_method" defaultValue={options[0]?.value ?? ""} disabled={!options.length} className={fieldClassName}><option value="">{options.length ? "Select payment method" : "No payment methods available"}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}

function errorText(value: unknown): string {
  if (typeof value === "string") return value.toLowerCase();
  if (Array.isArray(value)) return value.map(errorText).join(" ");
  if (value && typeof value === "object") return Object.entries(value as ApiRecord).map(([key, item]) => `${key} ${errorText(item)}`).join(" ");
  return "";
}

function needsSavedPaymentMethod(error: unknown) {
  if (!(error instanceof ApiRequestError) || ![400, 422].includes(error.status)) return false;
  const details = errorText(error.details);
  return details.includes("payment_method") || details.includes("payment method");
}

function paymentFailureMessage(error: unknown) {
  if (!(error instanceof ApiRequestError)) return "We couldn’t confirm this payment. Please try again.";
  const details = `${errorText(error.details)} ${error.message.toLowerCase()}`;
  if (error.status === 401) return "Your sign-in has ended. Please sign in again before confirming this payment.";
  if (error.status === 403) return "Your account is not allowed to confirm payments.";
  if (details.includes("reference") || details.includes("receipt")) return "Add the payment reference, then try again.";
  if (details.includes("amount") || details.includes("balance") || details.includes("outstanding")) return "The amount due has changed. Refresh the order, then try again.";
  if (details.includes("payment_method") || details.includes("payment method")) return "This payment method is not ready to use. Choose another active method or review it in Payment Methods.";
  if (details.includes("stock") || details.includes("inventory") || details.includes("insufficient")) return "There is not enough finished-product stock to complete this sale. Record and complete the required production first, then confirm payment.";
  if (details.includes("order") || details.includes("pending") || details.includes("submitted") || details.includes("settled")) return "This order is not ready for payment. Refresh the page and try again.";
  // Preserve a meaningful validation message from the API instead of masking it
  // as a refresh problem. The shared client keeps 5xx responses generic.
  if (error.message && !["please check the details and try again.", "we couldn’t complete that. please try again."].includes(error.message.toLowerCase())) return error.message;
  return "We couldn’t confirm this payment yet. Refresh the page and try again.";
}

export default function SalesPage({ role }: { role: TransactionRole }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Sale[]>([]);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<Sale | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ordersPayload, paymentsPayload, productsPayload, paymentMethodsPayload] = await Promise.all([
        boardsApi.orders("?page_size=100"),
        boardsApi.payments("?page_size=100"),
        boardsApi.menuProducts(),
        boardsApi.paymentMethods().catch(() => null),
      ]);
      const completedPayments = listApiRecords(paymentsPayload).filter((payment) => text(payment.status).toLowerCase() === "completed");
      const paymentsByOrder = new Map(completedPayments.map((payment) => [identifier(payment.order), payment]));
      const apiOrders = listApiRecords(ordersPayload);
      setSales(apiOrders.filter((order) => text(order.status).toLowerCase() === "paid" || paymentsByOrder.has(identifier(order.id))).map((order) => toSale(order, paymentsByOrder)));
      setPendingOrders(apiOrders.filter((order) => text(order.status).toLowerCase() === "pending").map((order) => toSale(order, paymentsByOrder)));
      setProducts(listApiRecords(productsPayload).filter((product) => product.is_available !== false).map(toProduct));
      setPaymentOptions(paymentMethodsPayload ? toPaymentOptions(listApiRecords(paymentMethodsPayload)) : []);
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn’t load sales. Please try again.");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); const unsubscribe = subscribeToApiDataChanges(() => { void load(); }); return () => { window.clearTimeout(timer); unsubscribe(); }; }, [load]);

  const visibleSales = useMemo(() => sales.filter((sale) => JSON.stringify(sale).toLowerCase().includes(search.toLowerCase())), [sales, search]);
  const estimatedTotal = useMemo(() => lines.reduce((total, line) => total + line.quantity * line.price, 0), [lines]);
  const hasConfiguredPaymentMethods = paymentOptions.length > 0;
  const availablePaymentOptions = hasConfiguredPaymentMethods ? paymentOptions : fallbackPaymentOptions;

  function closeForm() { setIsFormOpen(false); setLines([]); setProductId(""); setQuantity("1"); setError(""); }
  function openForm() { closeForm(); setIsFormOpen(true); }
  function addLine() { const product = products.find((item) => item.id === Number(productId)); const parsedQuantity = Number(quantity); if (!product || !Number.isInteger(parsedQuantity) || parsedQuantity < 1) return; setLines((current) => [...current, { productId: product.id, name: product.name, quantity: parsedQuantity, price: product.price }]); setProductId(""); setQuantity("1"); }

  async function recordPayment(body: ApiRecord, paymentMethod: string) {
    try {
      return await boardsApi.createPayment(body);
    } catch (firstError) {
      const savedMethod = paymentOptions.find((option) => option.value === paymentMethod);
      // Older deployed API versions link a payment to the saved payment-method
      // record, while the published contract accepts its category. A validation
      // response means no payment was created, so this retry is safe and shares
      // the same idempotency key.
      if (!savedMethod?.id || !needsSavedPaymentMethod(firstError)) throw firstError;
      return boardsApi.createPayment({ ...body, payment_method: savedMethod.id, payment_method_id: savedMethod.id, payment_type: paymentMethod });
    }
  }

  async function createSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lines.length) { setError("Add at least one available menu product."); return; }
    const form = new FormData(event.currentTarget); const notes = String(form.get("notes") || "").trim(); const reference = String(form.get("reference") || "").trim(); const paymentMethod = String(form.get("payment_method") || "").trim();
    if (!paymentMethod) { setError("Select a payment method before completing the sale."); return; }
    let step = "create the draft order"; let orderId: string | null = null; setIsSaving(true);
    try {
      const orderBody: ApiRecord = { items: lines.map((line) => ({ product: line.productId, quantity: line.quantity })) }; if (notes) orderBody.notes = notes;
      const createdOrder = await boardsApi.createOrder(orderBody); orderId = identifier(createdOrder.id); if (!orderId) throw new Error("We couldn’t start this sale. Please try again.");
      step = "submit the order"; const submittedOrder = await boardsApi.submitOrder(orderId); const amount = number(submittedOrder.total_amount ?? createdOrder.total_amount); if (amount <= 0) throw new Error("We couldn’t calculate the sale total. Please try again.");
      step = "record the payment"; const paymentBody: ApiRecord = { order: orderId, amount: String(amount), payment_method: paymentMethod }; const idempotencyKey = createIdempotencyKey(); if (idempotencyKey) paymentBody.idempotency_key = idempotencyKey; if (reference) paymentBody.reference = reference; if (notes) paymentBody.notes = notes;
      await recordPayment(paymentBody, paymentMethod); closeForm(); await load();
    } catch (requestError) { const detail = requestError instanceof Error ? requestError.message : "Please try again."; const recoveryHint = step === "record the payment" && orderId ? " The order may be waiting under Orders, so check there before creating another one." : ""; await load(); setError(`We couldn’t ${step}. ${detail}${recoveryHint}`); } finally { setIsSaving(false); }
  }

  async function confirmPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!paymentOrder) return;
    const form = new FormData(event.currentTarget); const reference = String(form.get("reference") || "").trim(); const paymentMethod = String(form.get("payment_method") || "").trim();
    if (!paymentMethod) { setError("Select a payment method before confirming the payment."); return; }
    setIsSaving(true);
    try { const body: ApiRecord = { order: paymentOrder.id, amount: String(paymentOrder.balanceDue), payment_method: paymentMethod }; const idempotencyKey = createIdempotencyKey(); if (idempotencyKey) body.idempotency_key = idempotencyKey; if (reference) body.reference = reference; await recordPayment(body, paymentMethod); setPaymentOrder(null); await load(); } catch (requestError) { setError(paymentFailureMessage(requestError)); } finally { setIsSaving(false); }
  }

  return <TransactionLayout role={role} title="Sales" search={search} onSearchChange={setSearch} createLabel="Create New" onCreate={openForm} requiredPermission="sales.view" createPermission="sales.create">
    {error && !isFormOpen && <p role="alert" className="mx-3 mt-3 rounded-md bg-red-50 p-2 text-[11px] text-red-700">{error}</p>}
    <section className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95 shadow-[0_2px_10px_rgba(72,48,30,0.04)]"><div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[760px] border-collapse text-left"><thead className="sticky top-0 bg-[#f0e5d4] text-[9px] font-medium text-[#4b3b2f]"><tr className="h-8 border-b border-[#e2d6c6]">{["Date", "Sale #", "Products", "Total", "Payment", "Status"].map((heading) => <th key={heading} className="whitespace-nowrap px-2.5">{heading} ↕</th>)}</tr></thead><tbody className="text-[10px] text-[#55463a]">{visibleSales.map((sale) => <tr key={sale.id} className="h-9 border-b border-[#eee6dc]"><TableCell className="whitespace-nowrap px-2.5">{sale.date}</TableCell><TableCell className="px-2.5 font-medium">{sale.reference}</TableCell><TableCell className="px-2.5">{sale.items.map((line) => `${line.name} ×${line.quantity}`).join(", ") || "-"}</TableCell><TableCell className="whitespace-nowrap px-2.5 font-medium">{formatTransactionMoney(sale.total)}</TableCell><TableCell className="px-2.5 capitalize">{sale.paymentMethod}</TableCell><TableCell className="px-2.5 capitalize">{sale.status}</TableCell></tr>)}</tbody></table></div>{isLoading ? <div className="flex flex-1 items-center justify-center px-4 py-14 text-center text-[10px] text-[#8e8074]">Loading sales…</div> : !visibleSales.length && <div className="flex flex-1 items-center justify-center px-4 py-14 text-center"><div><p className="m-0 text-[11px] font-medium text-[#897b6f]">No completed sales returned by the API</p><p className="mb-0 mt-1 text-[9px] text-[#a09387]">Create a sale to submit an order and record its completed payment.</p></div></div>}<div className="flex min-h-9 items-center justify-between border-t border-[#ebe2d7] px-2.5 text-[9px] text-[#817367] sm:px-3"><span>Showing {visibleSales.length} of {sales.length} completed sales</span><span>Live API data</span></div></div>
      <Can permission="finance.create"><div className="overflow-hidden rounded-lg border border-[#e5dacd] bg-[#fcf9f4]/95 shadow-[0_2px_10px_rgba(72,48,30,0.04)]"><div className="flex items-center justify-between border-b border-[#e2d6c6] bg-[#f0e5d4] px-2.5 py-2"><div><h2 className="m-0 text-[11px] font-semibold text-[#4b3b2f]">Pending order payments</h2><p className="mb-0 mt-0.5 text-[9px] text-[#817367]">Orders submitted by the service team and awaiting cashier confirmation.</p></div><span className="rounded-full bg-white/70 px-2 py-0.5 text-[9px] text-[#55463a]">{pendingOrders.length}</span></div><div className="overflow-auto"><table className="w-full min-w-[620px] border-collapse text-left text-[10px] text-[#55463a]"><thead className="bg-[#f8f3ec] text-[9px] font-medium text-[#4b3b2f]"><tr>{["Date", "Order #", "Items", "Amount"].map((heading) => <th key={heading} className="px-2.5 py-2">{heading}</th>)}<th className="px-2.5 py-2 text-right">Action</th></tr></thead><tbody>{pendingOrders.map((order) => <tr key={order.id} className="border-t border-[#eee6dc]"><TableCell className="whitespace-nowrap px-2.5 py-2">{order.date}</TableCell><TableCell className="px-2.5 py-2 font-medium">{order.reference}</TableCell><TableCell className="px-2.5 py-2">{order.items.map((line) => `${line.name} ×${line.quantity}`).join(", ") || "-"}</TableCell><TableCell className="whitespace-nowrap px-2.5 py-2 font-medium">{formatTransactionMoney(order.total)}</TableCell><TableCell className="px-2.5 py-2 text-right"><button type="button" onClick={() => { setError(""); setPaymentOrder(order); }} className="rounded-md bg-[#28180f] px-2 py-1 text-[9px] font-medium text-white hover:bg-[#4a2d1b]">Confirm payment</button></TableCell></tr>)}{!pendingOrders.length && <tr><TableCell colSpan={5} className="px-2.5 py-5 text-center text-[10px] text-[#8e8074]">No pending orders returned by the API.</TableCell></tr>}</tbody></table></div></div></Can>
    </section>
    {isFormOpen && <TransactionDialog title="Create Sale" description="This creates an order, sends it for payment, and records the completed payment." labelledBy="sale-form-title" onClose={closeForm}><form onSubmit={createSale} className="grid gap-3">{error && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}<section className="rounded-md bg-[#f5eee5] p-2.5"><div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_80px_auto] sm:items-end"><label className={labelClassName}>Product<select value={productId} onChange={(event) => setProductId(event.target.value)} className={`${fieldClassName} h-8 text-[10px]`}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} — {formatTransactionMoney(product.price)}</option>)}</select></label><label className={labelClassName}>Qty<input value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" min="1" className={`${fieldClassName} h-8 text-[10px]`} /></label><button type="button" onClick={addLine} className="form-add-button">+ Add Item</button></div>{lines.length > 0 && <div className="mt-2 grid gap-1 rounded-md bg-white/60 p-2">{lines.map((line, index) => <div key={`${line.productId}-${index}`} className="grid grid-cols-[minmax(0,1fr)_45px_90px_20px] gap-2 border-b border-[#eee6dc] py-1 text-[9px] last:border-0"><span className="truncate">{line.name}</span><span>{line.quantity}</span><span>{formatTransactionMoney(line.quantity * line.price)}</span><button type="button" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} className="text-[#9b5549]" aria-label={`Remove ${line.name}`}>×</button></div>)}</div>}</section><div className="grid gap-2 sm:grid-cols-2"><label className={labelClassName}>Payment method<PaymentMethodSelect options={availablePaymentOptions} /></label><label className={labelClassName}>Payment reference<input name="reference" maxLength={100} placeholder="Optional receipt or reference" className={fieldClassName} /></label></div>{!hasConfiguredPaymentMethods && <p className="m-0 rounded-md bg-[#f5eee5] p-2 text-[10px] leading-4 text-[#6f6054]">Choose a payment method for this payment. These choices are available while payment methods are being set up.</p>}<label className={labelClassName}>Estimated total<input readOnly value={formatTransactionMoney(estimatedTotal)} className={`${fieldClassName} bg-[#f8f3ec]`} /></label><label className={labelClassName}>Order notes<textarea name="notes" placeholder="Optional kitchen or sale notes" className="min-h-16 rounded-md border border-[#e2d6c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#805336]" /></label><div className="flex justify-end gap-2"><button type="button" onClick={closeForm} disabled={isSaving} className="h-8 rounded-md border border-[#e2d6c6] px-4 text-[10px] text-[#69594d] disabled:opacity-50">Cancel</button><button type="submit" disabled={!lines.length || isSaving} className="h-8 rounded-md bg-[#28180f] px-4 text-[10px] font-medium text-white disabled:opacity-50">{isSaving ? "Saving…" : "Complete Sale"}</button></div></form></TransactionDialog>}
    {paymentOrder && <TransactionDialog title="Confirm Order Payment" description="Record a completed payment for this order." labelledBy="confirm-payment-title" onClose={() => { if (!isSaving) setPaymentOrder(null); }}><form onSubmit={confirmPayment} className="grid gap-3">{error && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}<div className="rounded-md bg-[#f5eee5] p-3 text-[11px] text-[#55463a]"><p className="m-0 font-medium">{paymentOrder.reference}</p><p className="mb-0 mt-1">Amount due: {formatTransactionMoney(paymentOrder.balanceDue)}</p></div><div className="grid gap-2 sm:grid-cols-2"><label className={labelClassName}>Payment method<PaymentMethodSelect options={availablePaymentOptions} /></label><label className={labelClassName}>Payment reference<input name="reference" maxLength={100} placeholder="Optional receipt or reference" className={fieldClassName} /></label></div>{!hasConfiguredPaymentMethods && <p className="m-0 rounded-md bg-[#f5eee5] p-2 text-[10px] leading-4 text-[#6f6054]">Choose a payment method for this payment. These choices are available while payment methods are being set up.</p>}<div className="flex justify-end gap-2"><button type="button" disabled={isSaving} onClick={() => setPaymentOrder(null)} className="h-8 rounded-md border border-[#e2d6c6] px-4 text-[10px] text-[#69594d] disabled:opacity-50">Cancel</button><button type="submit" disabled={isSaving} className="h-8 rounded-md bg-[#28180f] px-4 text-[10px] text-white disabled:opacity-50">{isSaving ? "Confirming…" : "Confirm Payment"}</button></div></form></TransactionDialog>}
  </TransactionLayout>;
}
