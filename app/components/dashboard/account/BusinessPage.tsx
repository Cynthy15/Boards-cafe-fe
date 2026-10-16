"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";

import brandImage from "../../../images/ima.png";
import { boardsApi, type ApiRecord } from "../../../../lib/api-client";
import { useActiveBusiness } from "../../../../lib/use-active-business";
import AccountShell from "./AccountShell";
import { Field, cardClass, darkButton, fieldClass, useToast } from "./ui";

type BusinessDetails = { name: string; category: string; email: string; phone: string; tin: string; address: string; currency: string; timezone: string; receiptNotes: string };

const emptyBusinessDetails: BusinessDetails = {
  name: "", category: "", email: "", phone: "", tin: "", address: "", currency: "", timezone: "", receiptNotes: "",
};

function toBusinessDetails(business: ApiRecord, configuration: ApiRecord | null): BusinessDetails {
  const text = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
  return {
    name: text(business.name), category: text(business.category), email: text(business.email), phone: text(business.phone), tin: text(business.tin), address: text(business.address),
    currency: text(business.currency), timezone: text(business.timezone), receiptNotes: text(configuration?.receipt_footer),
  };
}

export default function BusinessPage() {
  const { business, businessId, isLoading, error: businessError, reload } = useActiveBusiness();
  const [saved, setSaved] = useState<BusinessDetails>(emptyBusinessDetails);
  const [form, setForm] = useState<BusinessDetails | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<ApiRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, notify] = useToast();

  useEffect(() => {
    if (!business || !businessId) return;
    let active = true;
    void boardsApi.businessConfiguration(businessId).then((next) => {
      if (!active) return;
      setConfig(next); setSaved(toBusinessDetails(business, next)); setForm(null);
    }).catch(() => {
      if (!active) return;
      // A business configuration can legitimately be absent for a newly-created workspace.
      setConfig(null); setSaved(toBusinessDetails(business, null));
      setErrors({});
    });
    return () => { active = false; };
  }, [business, businessId]);

  const values = form ?? saved;
  const set = (patch: Partial<BusinessDetails>) => setForm({ ...values, ...patch });

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!values.name.trim()) next.name = "Business name is required.";
    if (!values.currency.trim()) next.currency = "Currency is required.";
    if (!values.timezone.trim()) next.timezone = "Timezone is required.";
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setIsSaving(true);
    try {
      const body = { name: values.name.trim(), category: values.category, email: values.email, phone: values.phone, tin: values.tin, address: values.address, currency: values.currency, timezone: values.timezone };
      const updated = businessId ? await boardsApi.updateBusiness(businessId, body) : await boardsApi.createBusiness(body);
      setSaved(toBusinessDetails(updated, config)); setForm(null); setErrors({}); notify("Business details saved to the API.");
      await reload();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Unable to save business details." });
    } finally {
      setIsSaving(false);
    }
  }

  async function savePreferences(event: FormEvent) {
    event.preventDefault();
    if (!businessId) { setErrors({ form: "Save the business details before setting preferences." }); return; }
    setIsSaving(true);
    try {
      const updated = await boardsApi.updateBusiness(businessId, { currency: values.currency, timezone: values.timezone });
      const nextConfig = await boardsApi.updateBusinessConfiguration(businessId, { receipt_footer: values.receiptNotes });
      setConfig(nextConfig); setSaved(toBusinessDetails(updated, nextConfig)); setForm(null); setErrors({}); notify("Preferences saved to the API.");
      await reload();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Unable to save preferences." });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AccountShell crumb="Business Settings">
      {(businessError || errors.form) && <p role="alert" className="mb-3 rounded-md bg-red-50 p-2 text-[11px] text-red-700">{businessError || errors.form}</p>}
      {isLoading ? <p className="p-4 text-[11px] text-[#6f6054]">Loading business settings…</p> : <div className="grid gap-4">
        <form onSubmit={saveDetails} noValidate className={cardClass}>
          <h2 className="m-0 mb-3 text-[15px] font-semibold text-[#2b1d15]">Details</h2>
          <div className="mb-3 flex items-center gap-4"><span className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl bg-[#eadcc8]"><Image src={brandImage} alt="Business logo" width={56} height={56} className="object-contain" /></span><span className="text-[11px] text-[#3b2e26]">Logo / Icon</span></div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Name" required error={errors.name}><input value={values.name} onChange={(e) => set({ name: e.target.value })} className={fieldClass} /></Field></div>
            <div className="sm:col-span-2"><Field label="Category"><input value={values.category} onChange={(e) => set({ category: e.target.value })} placeholder="Business category" className={fieldClass} /></Field></div>
            <Field label="Email" error={errors.email}><input type="email" value={values.email} onChange={(e) => set({ email: e.target.value })} placeholder="business@example.com" className={fieldClass} /></Field>
            <Field label="Phone"><input type="tel" value={values.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="25078..." className={fieldClass} /></Field>
            <div className="sm:col-span-2"><Field label="TIN"><input value={values.tin} onChange={(e) => set({ tin: e.target.value })} className={fieldClass} /></Field></div>
            <div className="sm:col-span-2"><Field label="Address"><input value={values.address} onChange={(e) => set({ address: e.target.value })} placeholder="Business address" className={fieldClass} /></Field></div>
          </div>
          <div className="mt-4 flex justify-end"><button disabled={isSaving} className={darkButton}>{businessId ? "Save Details" : "Create Business"}</button></div>
        </form>
        <form onSubmit={savePreferences} className={cardClass}>
          <h2 className="m-0 mb-3 text-[15px] font-semibold text-[#2b1d15]">Preferences</h2>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Currency" required error={errors.currency}><input value={values.currency} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} placeholder="ISO currency code, e.g. RWF" maxLength={3} className={fieldClass} /></Field>
            <Field label="Timezone" required error={errors.timezone}><input value={values.timezone} onChange={(e) => set({ timezone: e.target.value })} placeholder="IANA timezone, e.g. Africa/Kigali" className={fieldClass} /></Field>
            <div className="sm:col-span-2"><Field label="Receipt Footer Notes"><input value={values.receiptNotes} onChange={(e) => set({ receiptNotes: e.target.value })} placeholder="Notes to display on receipts" className={fieldClass} /></Field></div>
          </div>
          <div className="mt-4 flex justify-end"><button disabled={isSaving || !businessId} className={darkButton}>Save Preferences</button></div>
        </form>
      </div>}
      {toast}
    </AccountShell>
  );
}
