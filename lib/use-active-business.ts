"use client";

import { useCallback, useEffect, useState } from "react";

import { boardsApi, listApiRecords, type ApiRecord } from "./api-client";

/** Loads the workspace business selected by the API (its active profile, or the first profile). */
export function useActiveBusiness() {
  const [business, setBusiness] = useState<ApiRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const businesses = listApiRecords(await boardsApi.businesses());
      setBusiness(businesses.find((item) => item.is_active === true) ?? businesses[0] ?? null);
      setError("");
    } catch (requestError) {
      setBusiness(null);
      setError(requestError instanceof Error ? requestError.message : "Unable to load business settings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);

  const id = typeof business?.id === "number" || typeof business?.id === "string" ? business.id : null;
  return { business, businessId: id, isLoading, error, reload };
}
