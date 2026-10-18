"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { boardsApi, getSignedInUser, getUserPermissions, setSignedInUser, type ApiRecord } from "../../../lib/api-client";

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
export function useAccessControl(): AccessState {
  const [profile, setProfile] = useState<ApiRecord | null>(() => getSignedInUser());
  const [isLoading, setIsLoading] = useState(() => !getSignedInUser());

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

  if (isLoading || (permission && !can(permission))) return null;
  return <>{children}</>;
}
