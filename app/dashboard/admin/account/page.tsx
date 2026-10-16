import { redirect } from "next/navigation";

export default function AccountIndexPage() {
  // Clicking "CD" opens the Account folder, which starts on Stations.
  redirect("/dashboard/admin/account/stations");
}
