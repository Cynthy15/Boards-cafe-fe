"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export const fieldClass =
  "h-11 w-full rounded-lg border border-[#e6dccd] bg-[#fffaf3] px-3.5 text-[12px] text-[#30251f] outline-none placeholder:text-[#9a8c80] focus:border-[#805336] focus:ring-2 focus:ring-[#805336]/15 disabled:opacity-60";
export const labelClass = "grid gap-1.5 text-[11px] font-medium text-[#3b2e26]";
export const hintClass = "text-[10px] leading-4 text-[#8b7d70]";
export const errorClass = "text-[10px] font-medium text-[#a8432f]";
export const cardClass = "rounded-xl border border-[#e6dccd] bg-[#faf7f0]/95 p-4 shadow-sm sm:p-[18px]";
export const primaryButton =
  "inline-flex h-9 items-center justify-center rounded-lg bg-[#805336] px-4 text-[12px] font-semibold text-white transition hover:bg-[#6b4429] disabled:cursor-not-allowed disabled:opacity-50";
export const darkButton =
  "inline-flex h-9 items-center justify-center rounded-lg bg-[#28180f] px-4 text-[12px] font-semibold text-white transition hover:bg-[#4a2d1b]";
export const secondaryButton =
  "inline-flex h-9 items-center justify-center rounded-lg border border-[#e6dccd] bg-[#fffaf3] px-4 text-[12px] font-semibold text-[#30251f] transition hover:bg-[#f3e9da]";

/* ------------------------------------------------------------------ toast */
export function useToast() {
  const [message, setMessage] = useState("");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const show = useCallback((text: string) => {
    setMessage(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(""), 2800);
  }, []);
  const node = message ? (
    <div role="status" className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-[#28180f] px-4 py-2.5 text-[12px] font-medium text-white shadow-lg">
      {message}
    </div>
  ) : null;
  return [node, show] as const;
}

/* ------------------------------------------------- dialog + drawer shells */
function useEscape(onClose: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
}

function Header({ title, description, onClose }: { title: string; description?: string; onClose: () => void }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="m-0 text-[15px] font-semibold text-[#2b1d15]">{title}</h2>
        {description && <p className="mb-0 mt-1.5 text-[11px] text-[#8b7d70]">{description}</p>}
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 rounded-md px-1.5 text-xl leading-none text-[#6f6054] hover:bg-[#f0e5d4]">×</button>
    </div>
  );
}

export function Dialog({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2a2622]/45 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[92svh] w-full max-w-[466px] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <Header title={title} description={description} onClose={onClose} />
        {children}
      </section>
    </div>
  );
}

export function Drawer({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#2a2622]/45" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-label={title} className="h-full w-full max-w-[548px] overflow-y-auto border-l border-[#e6dccd] bg-white p-5 shadow-2xl sm:p-6">
        <Header title={title} description={description} onClose={onClose} />
        {children}
      </aside>
    </div>
  );
}

/* ---------------------------------------------------------- form helpers */
export function Field({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className={labelClass}>
      <span>{label}{required && " *"}</span>
      {children}
      {error ? <span className={errorClass}>{error}</span> : hint ? <span className={hintClass}>{hint}</span> : null}
    </label>
  );
}

export function RadioGroup<T extends string>({ legend, name, value, onChange, options }: { legend: string; name: string; value: T; onChange: (value: T) => void; options: { value: T; label: string }[] }) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-1.5 p-0 text-[11px] font-medium text-[#3b2e26]">{legend}</legend>
      <div className="flex items-center gap-5 text-[11px] text-[#3b2e26]">
        {options.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-center gap-1.5">
            <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="h-3 w-3 accent-[#28180f]" />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------- data table */
export type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
};

export function DataTable<T extends { id: string }>({
  rows, columns, query, searchText, emptyText = "No records found.",
}: {
  rows: T[]; columns: Column<T>[]; query: string; searchText: (row: T) => string; emptyText?: string;
}) {
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const needle = query.trim().toLowerCase();
  let visible = needle ? rows.filter((row) => searchText(row).toLowerCase().includes(needle)) : rows;
  const sortColumn = sort ? columns.find((column) => column.key === sort.key) : undefined;
  if (sort && sortColumn?.sortValue) {
    const getValue = sortColumn.sortValue;
    visible = [...visible].sort((a, b) => {
      const x = getValue(a), y = getValue(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = visible.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allSelected = pageRows.length > 0 && pageRows.every((row) => selected.includes(row.id));

  const toggleSort = (key: string) => setSort((current) => (current?.key === key ? { key, dir: current.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const toggleAll = (checked: boolean) =>
    setSelected((current) => (checked ? [...new Set([...current, ...pageRows.map((row) => row.id)])] : current.filter((id) => !pageRows.some((row) => row.id === id))));

  return (
    <div className="flex min-h-[calc(100svh-120px)] flex-col overflow-hidden rounded-xl border border-[#e6dccd] bg-[#faf7f0]/95 shadow-sm">
      <div className="flex-1 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-[11px] text-[#30251f]">
          <thead>
            <tr className="bg-[#eee2d1] text-[#3b2e26]">
              <th className="w-10 px-3 py-3.5">
                <input type="checkbox" aria-label="Select all rows" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} className="h-3.5 w-3.5 accent-[#805336]" />
              </th>
              {columns.map((column) => (
                <th key={column.key} className={`px-3 py-3.5 font-semibold ${column.className ?? ""}`} aria-sort={sort?.key === column.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                  {column.sortValue ? (
                    <button type="button" onClick={() => toggleSort(column.key)} className="inline-flex items-center gap-1.5 font-semibold">
                      {column.label}<span aria-hidden="true" className="text-[10px] text-[#6f6054]">↕</span>
                    </button>
                  ) : column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="px-3 py-10 text-center text-[#8b7d70]">{emptyText}</td></tr>
            )}
            {pageRows.map((row) => (
              <tr key={row.id} className="border-b border-[#efe6d8] last:border-0 hover:bg-[#f5ede0]/60">
                <td className="px-3 py-3.5 align-middle">
                  <input type="checkbox" aria-label="Select row" checked={selected.includes(row.id)} onChange={(e) => setSelected((current) => (e.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id)))} className="h-3.5 w-3.5 accent-[#805336]" />
                </td>
                {columns.map((column) => <td key={column.key} className={`px-3 py-3.5 align-middle ${column.className ?? ""}`}>{column.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6dccd] px-4 py-3 text-[11px] text-[#6f6054]">
        <label className="flex items-center gap-2">
          Show
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded border border-[#e6dccd] bg-[#fffaf3] px-1.5 py-1 text-[11px]">
            <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
          </select>
          entries
        </label>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage === 1} className="disabled:opacity-40">Previous</button>
          <span className="grid h-6 min-w-6 place-items-center rounded-md bg-[#805336] px-1.5 text-white">{safePage}</span>
          <button type="button" onClick={() => setPage(Math.min(pageCount, safePage + 1))} disabled={safePage >= pageCount} className="disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}

export const rowAction = "rounded px-1.5 py-0.5 text-[11px] text-[#30251f] hover:bg-[#eadcc8]";
