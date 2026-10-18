"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";

import brandImage from "../../images/ima.png";
import beansImage from "../../images/image.png";
import { boardsApi, getUserDisplayName, type ApiRecord } from "../../../lib/api-client";
import ProfileBadge from "./ProfileBadge";
import WorkspaceRoleGuard from "./WorkspaceRoleGuard";

const text = (value: unknown) => typeof value === "string" ? value : "";

/** A personal profile page for non-admin staff; it deliberately exposes no management links. */
export default function UserProfilePage() {
  const [profile, setProfile] = useState<ApiRecord | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const load = useCallback(async () => { setLoading(true); try { setProfile(await boardsApi.profile()); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load your profile."); } finally { setLoading(false); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (!passwords.current || !passwords.next || passwords.next !== passwords.confirm) { setError("Enter your current password and matching new password values."); return; }
    setSaving(true);
    try { await boardsApi.changePassword({ current_password: passwords.current, new_password: passwords.next, new_password_confirm: passwords.confirm }); setPasswords({ current: "", next: "", confirm: "" }); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t change your password. Please try again."); }
    finally { setSaving(false); }
  }

  const name = profile ? getUserDisplayName(profile, "") : "";
  const field = "h-9 rounded-md border border-[#e2d6c6] bg-white px-3 text-sm outline-none focus:border-[#805336]";
  const label = "grid gap-1.5 text-xs font-medium text-[#55463a]";

  return <div className="grid min-h-svh w-full bg-[#f7f0e7] text-[#392d26] md:grid-cols-[172px_minmax(0,1fr)]">
    <WorkspaceRoleGuard role="user" />
    <aside className="flex flex-col bg-[#2b180f] px-3.5 py-4 text-[#e9ddd1] md:sticky md:top-0 md:h-svh">
      <Link href="/dashboard/user" className="mb-5 flex items-center gap-2 px-1 text-white no-underline"><Image src={brandImage} alt="Boards Café" width={32} height={32} className="rounded-full" /><strong className="text-base tracking-tight">BOARDS</strong></Link>
      <Link href="/dashboard/user" className="flex min-h-9 items-center rounded-md px-2.5 text-xs text-[#cbbcaf] no-underline hover:bg-[#805336] hover:text-white">Home</Link>
      <ProfileBadge role="user" active />
    </aside>
    <main className="relative flex min-h-svh min-w-0 flex-col bg-cover bg-center" style={{ backgroundImage: `linear-gradient(rgba(249,244,236,.78),rgba(249,244,236,.78)),url("${beansImage.src}")` }}>
      <header className="relative z-10 flex min-h-11.25 items-center border-b border-[#e8ded2] bg-[#fbf6ed]/95 px-4 text-[10px] text-[#918477]"><Link href="/dashboard/user" className="hover:text-[#5c3d28]">Home</Link><span className="mx-2">›</span><span className="text-[#5a493d]">My profile</span></header>
      <section className="relative z-10 mx-auto grid w-full max-w-3xl gap-4 p-4 sm:p-6">
        {error && <p role="alert" className="m-0 rounded-md bg-red-50 p-3 text-[11px] text-red-700">{error}</p>}
        <article className="rounded-xl border border-[#e6dccd] bg-[#faf7f0]/95 p-5 shadow-sm"><h1 className="m-0 text-[15px] font-semibold">My profile</h1>{loading ? <p className="text-[11px] text-[#6f6054]">Loading profile…</p> : <dl className="mt-4 grid gap-3 text-[11px] sm:grid-cols-2"><div><dt className="text-[#8b7d70]">Name</dt><dd className="m-0 font-medium">{name || "-"}</dd></div><div><dt className="text-[#8b7d70]">Email</dt><dd className="m-0 font-medium">{text(profile?.email) || "-"}</dd></div><div><dt className="text-[#8b7d70]">Phone</dt><dd className="m-0 font-medium">{text(profile?.phone) || "-"}</dd></div><div><dt className="text-[#8b7d70]">Role</dt><dd className="m-0 font-medium">{profile?.role && typeof profile.role === "object" ? text((profile.role as ApiRecord).name) : text(profile?.role) || "-"}</dd></div></dl>}</article>
        <form onSubmit={changePassword} noValidate className="rounded-xl border border-[#e6dccd] bg-[#faf7f0]/95 p-5 shadow-sm"><h2 className="m-0 text-[15px] font-semibold">Change password</h2><div className="mt-4 grid gap-3"><label className={label}>Current password<input required type="password" autoComplete="current-password" value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} className={field} /></label><label className={label}>New password<input required type="password" autoComplete="new-password" value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} className={field} /></label><label className={label}>Confirm new password<input required type="password" autoComplete="new-password" value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} className={field} /></label></div><div className="mt-4 flex justify-end"><button disabled={saving} className="h-9 rounded-lg bg-[#28180f] px-4 text-[12px] font-semibold text-white disabled:opacity-50">{saving ? "Updating…" : "Update password"}</button></div></form>
      </section>
    </main>
  </div>;
}
