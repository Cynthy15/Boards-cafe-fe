"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { boardsApi, listApiRecords, type ApiRecord } from "../../../../lib/api-client";
import AccountShell from "./AccountShell";
import { PermissionChecklist, toPermission, type PermissionOption } from "./PermissionChecklist";
import { DataTable, Drawer, Field, RadioGroup, fieldClass, primaryButton, rowAction, secondaryButton, useToast, type Column } from "./ui";
import { useAccessControl } from "../AccessControl";

type Role = { id: string; name: string; description: string; permissionIds: number[]; usersCount: number; isActive: boolean };
type Draft = { name: string; description: string; permissionIds: number[]; isActive: boolean };
type Errors = Partial<Record<"name" | "form", string>>;
const emptyDraft: Draft = { name: "", description: "", permissionIds: [], isActive: true };

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function toRole(record: ApiRecord): Role {
  const nestedPermissions = Array.isArray(record.permissions) ? record.permissions : [];
  return {
    id: String(record.id),
    name: text(record.name),
    description: text(record.description),
    permissionIds: nestedPermissions.map((permission) => typeof permission === "object" && permission ? number((permission as ApiRecord).id) : number(permission)).filter(Boolean),
    usersCount: number(record.users_count),
    isActive: record.is_active !== false,
  };
}

export default function RolesPage() {
  const { can } = useAccessControl();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<Role | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, notify] = useToast();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rolePayload, permissionPayload] = await Promise.all([boardsApi.roles("?page_size=100"), boardsApi.permissions("?page_size=100").catch(() => [])]);
      setRoles(listApiRecords(rolePayload).map(toRole));
      setPermissions(listApiRecords(permissionPayload).map(toPermission).filter((permission) => permission.id));
      setErrors({});
    } catch (requestError) { setErrors({ form: requestError instanceof Error ? requestError.message : "Unable to load roles and permissions." }); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const columns: Column<Role>[] = [
    { key: "name", label: "Role", sortValue: (role) => role.name, render: (role) => role.name },
    { key: "description", label: "Description", sortValue: (role) => role.description, render: (role) => role.description || "-" },
    { key: "permissions", label: "Permissions", sortValue: (role) => role.permissionIds.length, render: (role) => `${role.permissionIds.length} granted` },
    { key: "users", label: "Assigned staff", sortValue: (role) => role.usersCount, render: (role) => role.usersCount },
    { key: "status", label: "Status", sortValue: (role) => Number(role.isActive), render: (role) => <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${role.isActive ? "bg-[#1f1a17]" : "bg-[#b9a999]"}`} />{role.isActive ? "Active" : "Inactive"}</span> },
    { key: "actions", label: "Actions", render: (role) => (can("roles.update") || can("roles.assign_permissions") || can("roles.delete")) ? <span className="inline-flex gap-2">{can("roles.update") && <><button type="button" onClick={() => openEdit(role)} className={rowAction}>Edit</button><button type="button" onClick={() => void toggleActive(role)} className={rowAction}>{role.isActive ? "Deactivate" : "Reactivate"}</button></>}{can("roles.assign_permissions") && role.permissionIds.length > 0 && <button type="button" onClick={() => void clearPermissions(role)} className={rowAction}>Clear permissions</button>}{can("roles.delete") && <button type="button" onClick={() => void remove(role)} className="rounded px-1.5 py-0.5 text-[11px] text-[#a8432f] hover:bg-[#f8e8e2]">Delete</button>}</span> : null },
  ];
  const set = (patch: Partial<Draft>) => setDraft((current) => current ? { ...current, ...patch } : current);

  function openCreate() { setEditing(null); setDraft(emptyDraft); setErrors({}); }
  function openEdit(role: Role) { setEditing(role); setDraft({ name: role.name, description: role.description, permissionIds: role.permissionIds, isActive: role.isActive }); setErrors({}); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (!draft.name.trim()) { setErrors({ name: "Role name is required." }); return; }
    setIsSaving(true);
    try {
      const body: ApiRecord = { name: draft.name.trim(), description: draft.description.trim(), is_active: draft.isActive };
      if (can("roles.assign_permissions")) body.permission_ids = draft.permissionIds;
      if (editing) { await boardsApi.updateRole(editing.id, body); notify("Role updated."); }
      else { await boardsApi.createRole(body); notify("Role created."); }
      setDraft(null); setEditing(null); await load();
    } catch (requestError) { setErrors({ form: requestError instanceof Error ? requestError.message : "Unable to save this role." }); }
    finally { setIsSaving(false); }
  }

  async function toggleActive(role: Role) {
    const action = role.isActive ? "deactivate" : "reactivate";
    if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} the ${role.name} role?`)) return;
    try {
      if (role.isActive) await boardsApi.deactivateRole(role.id); else await boardsApi.activateRole(role.id);
      notify(`Role ${role.isActive ? "deactivated" : "reactivated"}.`); await load();
    } catch (requestError) { setErrors({ form: requestError instanceof Error ? requestError.message : `Unable to ${action} this role.` }); }
  }

  async function remove(role: Role) {
    if (!window.confirm(`Delete the ${role.name} role? Roles assigned to staff and built-in roles cannot be deleted.`)) return;
    try { await boardsApi.deleteRole(role.id); notify("Role deleted."); await load(); }
    catch (requestError) { setErrors({ form: requestError instanceof Error ? requestError.message : "Unable to delete this role." }); }
  }

  async function clearPermissions(role: Role) {
    if (!window.confirm(`Remove all ${role.permissionIds.length} permissions from ${role.name}? Staff using this role will lose those permissions immediately.`)) return;
    try {
      await boardsApi.clearRolePermissions(role.id);
      notify("Role permissions cleared.");
      await load();
    } catch (requestError) { setErrors({ form: requestError instanceof Error ? requestError.message : "Unable to clear this role's permissions." }); }
  }

  return <AccountShell crumb="Roles & Permissions" search={query} onSearchChange={setQuery} createLabel="Create Role" onCreate={openCreate} requiredPermission="roles.view" createPermission="roles.create">
    {errors.form && !draft && <p role="alert" className="mb-3 rounded-md bg-red-50 p-2 text-[11px] text-red-700">{errors.form}</p>}
    {isLoading ? <p className="p-4 text-[11px] text-[#6f6054]">Loading roles and permissions…</p> : <DataTable rows={roles} columns={columns} query={query} searchText={(role) => `${role.name} ${role.description} ${role.isActive ? "active" : "inactive"}`} emptyText="No roles yet." />}
    {draft && <Drawer title={editing ? "Edit Role" : "Create Role"} description="Choose the permissions to save with this role." onClose={() => { setDraft(null); setEditing(null); }}><form onSubmit={submit} className="grid gap-4" noValidate>
      {errors.form && <p role="alert" className="m-0 rounded-md bg-red-50 p-2 text-[10px] text-red-700">{errors.form}</p>}
      <Field label="Role name" required error={errors.name}><input autoFocus value={draft.name} onChange={(event) => set({ name: event.target.value })} placeholder="e.g., Cashier" className={fieldClass} /></Field>
      <Field label="Description"><textarea value={draft.description} onChange={(event) => set({ description: event.target.value })} placeholder="What this role is responsible for" className="min-h-20 w-full rounded-lg border border-[#e6dccd] bg-[#fffaf3] px-3.5 py-2.5 text-[12px] text-[#30251f] outline-none placeholder:text-[#9a8c80] focus:border-[#805336]" /></Field>
      <RadioGroup<"active" | "inactive"> legend="Availability" name="role-status" value={draft.isActive ? "active" : "inactive"} onChange={(value) => set({ isActive: value === "active" })} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
      {can("roles.assign_permissions") && <section><h3 className="mb-1 text-[12px] font-semibold text-[#3b2e26]">Permissions ({draft.permissionIds.length})</h3><p className="mb-3 mt-0 text-[10px] leading-4 text-[#8b7d70]">Choose what people with this role can view and manage.</p><PermissionChecklist permissions={permissions} selectedIds={draft.permissionIds} onChange={(permissionIds) => set({ permissionIds })} disabled={isSaving} /></section>}
      <div className="mt-2 grid grid-cols-2 gap-3"><button type="button" disabled={isSaving} onClick={() => { setDraft(null); setEditing(null); }} className={`${secondaryButton} h-10`}>Cancel</button><button type="submit" disabled={isSaving} className={`${primaryButton} h-10`}>{isSaving ? "Saving…" : editing ? "Save Role" : "Create Role"}</button></div>
    </form></Drawer>}
    {toast}
  </AccountShell>;
}
