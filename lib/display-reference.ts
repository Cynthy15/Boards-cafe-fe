/** Compact presentation only; never use this value in API requests. */
export function compactReference(value: unknown): string {
  return String(value ?? "").replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    (uuid) => uuid.slice(0, 8).toUpperCase(),
  );
}
