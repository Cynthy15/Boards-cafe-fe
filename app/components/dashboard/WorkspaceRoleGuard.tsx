"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { getSignedInUser, getUserRole } from "../../../lib/api-client";

import { useAccessControl } from "./AccessControl";

type WorkspaceRole = "admin" | "user";

/** Keep a signed-in person in the workspace that matches their current API role. */
export default function WorkspaceRoleGuard({ role }: { role: WorkspaceRole }) {
  const pathname = usePathname();
  const router = useRouter();

  const { profile, isLoading } = useAccessControl();
  useEffect(() => {
    if (isLoading || !profile) return;
    const actualRole = getUserRole({ ...(getSignedInUser() ?? {}), ...profile });
    if (actualRole !== role) router.replace(pathname.replace(`/dashboard/${role}`, `/dashboard/${actualRole}`));
  }, [isLoading, profile, pathname, role, router]);

  return null;
}
