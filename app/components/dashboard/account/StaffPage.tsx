"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { boardsApi, listApiRecords, type ApiRecord } from "../../../../lib/api-client";
import AccountShell from "./AccountShell";
import { PermissionChecklist, toPermission, type PermissionOption } from "./PermissionChecklist";
import { DataTable, Drawer, Field, RadioGroup, fieldClass, hintClass, primaryButton, rowAction, secondaryButton, useToast, type Column } from "./ui";

type Status = "active" | "inactive";
type RoleOption = { id: number; name: string; isActive: boolean };
type StaffMember = { id: string; name: string; email: string; phone: string; role: string; directPermissionIds: number[]; status: Status };
type Draft = { name: string; email: string; phone: string; role: string; password: string; status: Status; permissionIds: number[] };
type Errors = Partial<Record<"name" | "email" | "role" | "password" | "form", string>>;
const emptyDraft: Draft = { name: "", email: "", phone: "", role: "", password: "", status: "active", permissionIds: [] };

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function roleName(record: ApiRecord) { return record.role && typeof record.role === "object" ? text((record.role as ApiRecord).name) : text(record.role); }
function permissionIds(value: unknown) {
  return Array.isArray(value) ? value.map((permission) => typeof permission === "object" && permission ? number((permission as ApiRecord).id) : number(permission)).filter(Boolean) : [];
}
function toStaff(record: ApiRecord): StaffMember {
  return {
    id: String(record.id),
    name: `${text(record.first_name)} ${text(record.last_name)}`.trim() || text(record.email),
    email: text(record.email),
    phone: text(record.phone),
    role: roleName(record) || "No role",
    directPermissionIds: permissionIds(record.direct_permissions),
    status: record.is_active === false ? "inactive" : "active",
  };
}
function splitName(name: string) {
  const [firstName = "", ...lastName] = name.trim().split(/\s+/);
  return { first_name: firstName, last_name: lastName.join(" ") };
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [viewing, setViewing] = useState<StaffMember | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, notify] = useToast();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [staffPayload, rolePayload, permissionPayload] = await Promise.all([
        boardsApi.staff("?page_size=100"),
        boardsApi.roles("?page_size=100"),
        boardsApi.permissions("?page_size=100"),
      ]);
      setStaff(listApiRecords(staffPayload).map(toStaff));
      setRoles(listApiRecords(rolePayload).map((role) => ({ id: number(role.id), name: text(role.name), isActive: role.is_active !== false })).filter((role) => role.id && role.name));
      setPermissions(listApiRecords(permissionPayload).map(toPermission).filter((permission) => permission.id));
      setErrors({});
    } catch (requestError) { setErrors({ form: requestError instanceof Error ? requestError.message : "Unable to load staff accounts." }); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const columns: Column<StaffMember>[] = [
    { key: "name", label: "Name", sortValue: (item) => item.name, render: (item) => item.name },
    { key: "email", label: "Email", sortValue: (item) => item.email, render: (item) => item.email },
    { key: "phone", label: "Phone Number", sortValue: (item) => item.phone, render: (item) => item.phone || "-" },
    { key: "role", label: "Role", sortValue: (item) => item.role, render: (item) => item.role },
    { key: "permissions", label: "Direct permissions", render: (item) => item.directPermissionIds.length ? `${item.directPermissionIds.length} granted` : "Role only" },
    { key: "status", label: "Status", sortValue: (item) => item.status, render: (item) => <span className="inline-flex items-center gap-1.5 capitalize"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${item.status === "active" ? "bg-[#1f1a17]" : "bg-[#b9a999]"}`} />{item.status}</span> },
    { key: "actions", label: "Actions", render: (item) => <span className="inline-flex gap-2"><button type="button" onClick={() => setViewing(item)} className={rowAction}>View</button><button type="button" onClick={() => openEdit(item)} className={rowAction}>Edit</button><button type="button" onClick={() => void toggleActive(item)} title={item.status === "active" ? "Deactivate this user while retaining its audit history" : "Restore this user's access"} className={item.status === "active" ? "rounded px-1.5 py-0.5 text-[11px] text-[#a8432f] hover:bg-[#f8e8e2]" : rowAction}>{item.status === "active" ? "Deactivate" : "Reactivate"}</button></span> },
  ];
  const set = (patch: Partial<Draft>) => setDraft((current) => current ? { ...current, ...patch } : current);
  const activeRoles = roles.filter((role) => role.isActive);

  function openCreate() { setViewing(null); setEditing(null); setDraft(emptyDraft); setErrors({}); }
  function openEdit(member: StaffMember) {
    setViewing(null);
    setEditing(member);
    setDraft({ name: member.name, email: member.email, phone: member.phone, role: member.role === "No role" ? "" : member.role, password: "", status: member.status, permissionIds: member.directPermissionIds });
    setErrors({});
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const next: Errors = {};
    if (!draft.name.trim()) next.name = "Full name is required.";
    if (!draft.email.trim()) next.email = "Email address is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) next.email = "Enter a valid email address.";
    if (!draft.role) next.role = "Select an active role returned by the API.";
    if (!editing && draft.password.length < 8) next.password = "Use at least 8 characters.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setIsSaving(true);
    try {
      if (editing) {
        await boardsApi.updateStaff(editing.id, { ...splitName(draft.name), phone: draft.phone.trim() || null, role_name: draft.role, permission_ids: draft.permissionIds, is_active: draft.status === "active" });
        if (draft.email.trim().toLowerCase() !== editing.email.toLowerCase()) await boardsApi.updateStaffEmail(editing.id, { email: draft.email.trim() });
        if (draft.password) await boardsApi.resetStaffPassword(editing.id, { temporary_password: draft.password, temporary_password_confirm: draft.password });
        notify("User account updated.");
      } else {
        await boardsApi.createStaff({ full_name: draft.name.trim(), email: draft.email.trim(), phone: draft.phone.trim() || null, role_name: draft.role, permission_ids: draft.permissionIds, password: draft.password, password_confirm: draft.password, is_active: draft.status === "active" });
        notify("User account created.");
      }
      setDraft(null); setEditing(null); await load();
    } catch (requestError) { setErrors({ form: requestError instanceof Error ? requestError.message : "Unable to save the staff account." }); }
    finally { setIsSaving(false); }
  }

  async function toggleActive(member: StaffMember) {
    const action = member.status === "active" ? "deactivate" : "reactivate";
    if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} ${member.name}?`)) return;
    try {
      if (member.status === "active") await boardsApi.deactivateStaff(member.id); else await boardsApi.activateStaff(member.id);
      notify(`User account ${member.status === "active" ? "deactivated" : "reactivated"}.`);
      await load();
    } catch (requestError) { setErrors({ form: requestError instanceof Error ? requestError.message : `Unable to ${action} this user account.` }); }
  }

  const viewingPermissions = viewing ? permissions.filter((permission) => viewing.directPermissionIds.includes(permission.id)) : [];

  return <AccountShell crumb="User Management" search={query} onSearchChange={setQuery} createLabel="Register User" onCreate={openCreate}>
    {errors.form && !draft && <p role="alert" className="mb-3 rounded-md bg-red-50 p-2 text-[11px] text-red-700">{errors.form}</p>}
    {isLoading ? <p className="p-4 text-[11px] text-[#6f6054]">Loading users…</p> : <DataTable rows={staff} columns={columns} query={query} searchText={(item) => `${item.name} ${item.email} ${item.phone} ${item.role} ${item.status}`} emptyText="No users were returned by the API." />}
    {draft && <Drawer title={editing ? "Edit User" : "Register User"} description={editing ? "Update name, contact details, role, status, and direct permissions through the API." : "Create a user using API roles and permissions."} onClose={() => { setDraft(null); setEditing(null); }}><form onSubmit={submit} className="grid gap-4" noValidate>
      {errors.form && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{errors.form}</p>}
      <Field label="Full Name" required error={errors.name}><input autoFocus value={draft.name} onChange={(event) => set({ name: event.target.value })} placeholder="e.g., Jane Doe" className={fieldClass} /></Field>
      <Field label="Email Address" required error={errors.email} hint={editing ? "Changing this address revokes the staff member's existing sessions." : undefined}><input type="email" value={draft.email} onChange={(event) => set({ email: event.target.value })} placeholder="e.g., jane@example.com" className={fieldClass} /></Field>
      <Field label="Phone Number"><input type="tel" value={draft.phone} onChange={(event) => set({ phone: event.target.value })} placeholder="e.g., +250 788 123 456" className={fieldClass} /></Field>
      <div className="grid gap-1.5"><Field label="Role" required error={errors.role}><select value={draft.role} onChange={(event) => set({ role: event.target.value })} className={fieldClass}><option value="">Select role</option>{activeRoles.map((role) => <option key={role.id} value={role.name}>{role.name}</option>)}</select></Field><p className={`${hintClass} m-0`}>{activeRoles.length ? "Roles are read directly from the API." : "No active roles are available for this account."}</p></div>
      {!editing && <div className="grid gap-1.5"><Field label="Temporary Password" required error={errors.password}><input type="password" autoComplete="new-password" value={draft.password} onChange={(event) => set({ password: event.target.value })} placeholder="Enter a secure password" className={fieldClass} /></Field><p className={`${hintClass} m-0`}>The password is submitted only to the API and is never stored by this application.</p></div>}
      {editing && <div className="grid gap-1.5"><Field label="Reset Temporary Password" hint="Optional. Saving a value revokes current sessions and requires the staff member to change it at next sign-in."><input type="password" autoComplete="new-password" value={draft.password} onChange={(event) => set({ password: event.target.value })} placeholder="Leave blank to keep the password" className={fieldClass} /></Field></div>}
      <RadioGroup<Status> legend="Status" name="staff-status" value={draft.status} onChange={(status) => set({ status })} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
      <details className="rounded-lg border border-[#e6dccd] p-3"><summary className="cursor-pointer text-[11px] font-medium text-[#3b2e26]">Direct permissions ({draft.permissionIds.length})</summary><p className="mb-3 mt-2 text-[10px] leading-4 text-[#8b7d70]">Use a role for normal access. These API permissions are extra grants for this staff member only.</p><PermissionChecklist permissions={permissions} selectedIds={draft.permissionIds} onChange={(permissionIds) => set({ permissionIds })} disabled={isSaving} /></details>
      <div className="mt-2 grid grid-cols-2 gap-3"><button type="button" onClick={() => { setDraft(null); setEditing(null); }} disabled={isSaving} className={`${secondaryButton} h-10`}>Cancel</button><button type="submit" disabled={isSaving} className={`${primaryButton} h-10`}>{isSaving ? "Saving…" : editing ? "Save Changes" : "Register User"}</button></div>
    </form></Drawer>}
    {viewing && <Drawer title="User Details" description="Current user, role, and direct permission details returned by the API." onClose={() => setViewing(null)}><dl className="grid gap-4 text-[11px] text-[#4f4035]">
      <div><dt className="text-[10px] font-medium uppercase tracking-wide text-[#8b7d70]">Full name</dt><dd className="m-0 mt-1 font-medium">{viewing.name}</dd></div>
      <div><dt className="text-[10px] font-medium uppercase tracking-wide text-[#8b7d70]">Email</dt><dd className="m-0 mt-1">{viewing.email || "-"}</dd></div>
      <div><dt className="text-[10px] font-medium uppercase tracking-wide text-[#8b7d70]">Phone</dt><dd className="m-0 mt-1">{viewing.phone || "-"}</dd></div>
      <div className="grid grid-cols-2 gap-3"><div><dt className="text-[10px] font-medium uppercase tracking-wide text-[#8b7d70]">Role</dt><dd className="m-0 mt-1">{viewing.role}</dd></div><div><dt className="text-[10px] font-medium uppercase tracking-wide text-[#8b7d70]">Status</dt><dd className="m-0 mt-1 capitalize">{viewing.status}</dd></div></div>
      <div><dt className="text-[10px] font-medium uppercase tracking-wide text-[#8b7d70]">Direct permissions</dt><dd className="m-0 mt-1 leading-5">{viewingPermissions.length ? viewingPermissions.map((permission) => permission.name).join(", ") : "None — access is determined by the assigned role."}</dd></div>
      <div className="flex justify-end gap-2 border-t border-[#e6dccd] pt-4"><button type="button" onClick={() => openEdit(viewing)} className={primaryButton}>Edit User</button></div>
    </dl></Drawer>}
    {toast}
  </AccountShell>;
}
