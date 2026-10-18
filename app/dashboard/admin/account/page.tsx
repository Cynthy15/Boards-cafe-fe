import { redirect } from "next/navigation";

export default function AccountIndexPage() {
  redirect("/dashboard/admin/account/business-details");
}
