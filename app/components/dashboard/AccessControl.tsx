"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { boardsApi, getUserPermissions, setSignedInUser, type ApiRecord } from "../../../lib/api-client";

export type PermissionRequirement = string | readonly string[];

type AccessState = {
  isLoading: boolean;
  profile: ApiRecord | null;
  can: (requirement?: PermissionRequirement) => boolean;
};

let profileRequest: Promise<ApiRecord> | null = null;

function loadProfile() {
  profileRequest ??= boardsApi.profile()
    .then((profile) => {
      setSignedInUser(profile);
      return profile;
    })
    .finally(() => { profileRequest = null; });
  return profileRequest;
}

/**
 * Uses the API's effective permission list. A list requirement is satisfied by any
 * listed permission; use a single permission where an action has one clear grant.
 */
const AccessContext = createContext<AccessState | null>(null);

export function AccessProvider({ children }: { children: ReactNode }) {
  const access = useProfileAccess();
  return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}

export function useAccessControl(): AccessState {
  const access = useContext(AccessContext);
  if (!access) throw new Error("AccessProvider is required for dashboard pages.");
  return access;
}

function useProfileAccess(): AccessState {
  const [profile, setProfile] = useState<ApiRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void loadProfile()
      .then((next) => { if (active) setProfile(next); })
      .catch(() => { if (active) setProfile(null); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const permissions = useMemo(() => getUserPermissions(profile), [profile]);
  const can = (requirement?: PermissionRequirement) => {
    if (!requirement) return true;
    const required = Array.isArray(requirement) ? requirement : [requirement];
    return required.some((permission) => permissions.has("*") || permissions.has(permission.toLowerCase()));
  };

  return { isLoading, profile, can };
}

/** Do not render an action until the signed-in person has its effective API permission. */
export function Can({ permission, children, fallback = null }: { permission?: PermissionRequirement; children: ReactNode; fallback?: ReactNode }) {
  const { isLoading, can } = useAccessControl();
  if (isLoading || !can(permission)) return <>{fallback}</>;
  return <>{children}</>;
}

/** Redirects a person away from a protected screen as soon as their API profile is known. */
export function PermissionRouteGuard({ permission, fallback, children }: { permission?: PermissionRequirement; fallback: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, can } = useAccessControl();

  useEffect(() => {
    if (!isLoading && permission && !can(permission) && pathname !== fallback) router.replace(fallback);
  }, [can, fallback, isLoading, pathname, permission, router]);

  if (isLoading) return <div className="workspace-initial-loading" role="status"><span className="workspace-spinner" />Loading workspace…</div>;
  if (permission && !can(permission)) return <div className="workspace-initial-loading" role="status">Checking access…</div>;
  return <>{children}</>;
}
