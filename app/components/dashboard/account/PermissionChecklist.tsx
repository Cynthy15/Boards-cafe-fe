"use client";

import type { ApiRecord } from "../../../../lib/api-client";

export type PermissionOption = {
  id: number;
  name: string;
  code: string;
  module: string;
  action: string;
  description: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function toPermission(record: ApiRecord): PermissionOption {
  const permissionModule = text(record.module) || "other";
  const action = text(record.action);
  const code = text(record.full_codename) || text(record.codename) || [permissionModule, action].filter(Boolean).join(".");
  return {
    id: Number(record.id),
    name: text(record.name) || code || "Permission",
    code,
    module: permissionModule,
    action,
    description: text(record.description),
  };
}

export function PermissionChecklist({
  permissions,
  selectedIds,
  onChange,
  disabled = false,
}: {
  permissions: PermissionOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}) {
  const groups = permissions.reduce<Record<string, PermissionOption[]>>((result, permission) => {
    (result[permission.module] ??= []).push(permission);
    return result;
  }, {});

  function toggle(id: number) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id]);
  }

  if (!permissions.length) return <p className="m-0 rounded-md bg-[#f5eee5] p-3 text-[10px] text-[#7b6d61]">No permissions are available yet.</p>;

  return <div className="grid gap-3">
    {Object.entries(groups).sort(([first], [second]) => first.localeCompare(second)).map(([module, entries]) => (
      <fieldset key={module} className="m-0 rounded-lg border border-[#e6dccd] p-3">
        <legend className="px-1 text-[10px] font-semibold capitalize text-[#4a382c]">{module}</legend>
        <div className="grid gap-2">
          {entries.sort((first, second) => first.name.localeCompare(second.name)).map((permission) => (
            <label key={permission.id} className="flex cursor-pointer items-start gap-2 text-[10px] text-[#4f4035]">
              <input type="checkbox" checked={selectedIds.includes(permission.id)} disabled={disabled} onChange={() => toggle(permission.id)} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#805336]" />
              <span>
                <span className="font-medium">{permission.name}</span>
                {permission.description && <span className="block text-[9px] leading-3 text-[#8b7d70]">{permission.description}</span>}
                {permission.code && <span className="block text-[9px] text-[#9a8c80]">{permission.code}</span>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    ))}
  </div>;
}
