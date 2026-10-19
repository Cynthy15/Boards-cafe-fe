"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { getUserDisplayName, logoutFromApi } from "../../../lib/api-client";
import { useAccessControl } from "./AccessControl";

type ProfileBadgeProps = { role: "admin" | "user"; active?: boolean; breakpoint?: "md" | "lg" };

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]).join("") || "U").toUpperCase();
}

/** Signed-in identity and the only logout control, shared by every dashboard sidebar. */
export default function ProfileBadge({ role, active = false, breakpoint = "lg" }: ProfileBadgeProps) {
  const { profile, isLoading } = useAccessControl();
  const name = profile ? getUserDisplayName(profile, "User") : "User";
  const profileHref = role === "admin" ? "/dashboard/admin/account/my-profile" : "/dashboard/user/account";

  return (
    <div className={`mt-3 grid min-w-0 gap-2 border-t border-[#4b362a] pt-3 ${breakpoint === "md" ? "md:mt-auto" : "lg:mt-auto"}`}>
      <Link
        href={profileHref}
        title="Open your profile"
        aria-label="Open your profile"
        aria-current={active ? "page" : undefined}
        className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-[#e9ddd1] no-underline transition hover:bg-[#805336] hover:text-white ${active ? "bg-[#805336] text-white" : ""}`}
      >
        <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#805336] text-[10px] font-semibold text-white">{isLoading ? "…" : initials(name)}</span>
        <span className="grid min-w-0 flex-1 gap-1 text-[11px] font-medium">
          <span className="truncate">{isLoading ? "Loading…" : name}</span>
          {typeof profile?.email === "string" && profile.email !== name && <span className="break-all text-[#cbbcaf]">{profile.email}</span>}
        </span>
      </Link>
      <LogoutButton className={`flex min-h-11 w-auto shrink-0 lg:mt-1 lg:w-full items-center gap-2 rounded-md px-2.5 text-left text-xs text-[#cbbcaf] transition hover:bg-[#805336] hover:text-white`} />
    </div>
  );
}

function LogoutButton({ className }: { className: string }) {
  const router = useRouter();
  async function signOut() {
    await logoutFromApi();
    router.replace("/");
  }

  return <button type="button" onClick={() => { void signOut(); }} className={className}>Log out</button>;
}
