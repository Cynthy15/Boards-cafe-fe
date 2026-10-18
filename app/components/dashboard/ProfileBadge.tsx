"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { getUserDisplayName, logoutFromApi } from "../../../lib/api-client";
import { useAccessControl } from "./AccessControl";

type ProfileBadgeProps = { role: "admin" | "user"; active?: boolean };

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]).join("") || "U").toUpperCase();
}

/** Signed-in identity and the only logout control, shared by every dashboard sidebar. */
export default function ProfileBadge({ role, active = false }: ProfileBadgeProps) {
  const router = useRouter();
  const { profile, isLoading } = useAccessControl();
  const name = profile ? getUserDisplayName(profile, "User") : "User";
  const profileHref = role === "admin" ? "/dashboard/admin/account/my-profile" : "/dashboard/user/account";

  async function signOut() {
    await logoutFromApi();
    router.replace("/");
  }

  return (
    <div className="mt-auto hidden border-t border-[#4b362a] pt-3 md:block">
      <Link
        href={profileHref}
        title="Open your profile"
        aria-label="Open your profile"
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[#e9ddd1] no-underline transition hover:bg-[#805336] hover:text-white ${active ? "bg-[#805336] text-white" : ""}`}
      >
        <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#805336] text-[10px] font-semibold text-white">{isLoading ? "…" : initials(name)}</span>
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{isLoading ? "Loading…" : name}</span>
      </Link>
      <button type="button" onClick={() => { void signOut(); }} className="mt-1 flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs text-[#cbbcaf] transition hover:bg-[#805336] hover:text-white">
        Log out
      </button>
    </div>
  );
}
