import type { ReactNode } from "react";
import { AccessProvider } from "../components/dashboard/AccessControl";
import { NavigationProvider } from "../components/dashboard/NavigationLink";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AccessProvider><NavigationProvider>{children}</NavigationProvider></AccessProvider>;
}
