/** Compact presentation only; never use this value in API requests. */
export function compactReference(value: unknown): string {
  return String(value ?? "").replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    (uuid) => uuid.slice(0, 8).toUpperCase(),
  );
}

/** Use the real numeric record ID for a stable, readable display reference. */
export function recordReference(id: unknown, fallback: unknown = ""): string {
  const value = String(id ?? "").trim();
  if (/^\d+$/.test(value)) return value.replace(/^0+(?=\d)/, "").padStart(3, "0");
  return compactReference(fallback || value);
}
