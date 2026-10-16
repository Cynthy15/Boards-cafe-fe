"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { boardsApi, getSignedInUser, getUserRole } from "../../../lib/api-client";

type WorkspaceRole = "admin" | "user";

/** Keep a signed-in person in the workspace that matches their current API role. */
export default function WorkspaceRoleGuard({ role }: { role: WorkspaceRole }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    void boardsApi.profile()
      .then((profile) => {
        if (!active) return;
        // Some versions of the backend include the business role at sign-in
        // but omit it from the later profile response. Prefer a fresh value
        // whenever it is present, while retaining the verified sign-in role.
        const actualRole = getUserRole({ ...(getSignedInUser() ?? {}), ...profile });
        if (actualRole !== role) router.replace(pathname.replace(`/dashboard/${role}`, `/dashboard/${actualRole}`));
      })
      // The destination page will show a clear message if the session or connection needs attention.
      .catch(() => undefined);
    return () => { active = false; };
  }, [pathname, role, router]);

  return null;
}
