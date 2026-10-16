import Link from "next/link";

type ProfileBadgeProps = { role: "admin" | "user"; active?: boolean };

/** Bottom-left badge of every dashboard sidebar. For admins ("CD") it opens the Account folder. */
export default function ProfileBadge({ role, active = false }: ProfileBadgeProps) {
  const wrapper = "mt-auto hidden border-t border-[#4b362a] pt-3 text-[11px] md:block";
  if (role !== "admin") return <div className={wrapper}>US</div>;
  return (
    <div className={wrapper}>
      <Link
        href="/dashboard/admin/account"
        title="Account settings"
        aria-label="Open account settings"
        aria-current={active ? "page" : undefined}
        className={`-mx-1 block rounded-md px-1 py-1.5 text-inherit no-underline transition hover:bg-[#805336] hover:text-white ${active ? "bg-[#805336] text-white" : ""}`}
      >
        CD
      </Link>
    </div>
  );
}
