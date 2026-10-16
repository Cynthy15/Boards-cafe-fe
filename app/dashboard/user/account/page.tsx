import { redirect } from "next/navigation";

export default function UserAccountPage() {
  // Account management is restricted to administrators.
  redirect("/dashboard/user");
}
