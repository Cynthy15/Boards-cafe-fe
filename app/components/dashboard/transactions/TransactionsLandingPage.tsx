"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAccessControl } from "../AccessControl";
import type { TransactionRole } from "./TransactionLayout";

const firstAvailableTransaction = [
  ["sales.view", "sales"],
  ["purchasing.view", "purchases"],
  ["production.view", "production"],
  ["finance.view", "expenses"],
] as const;

/** Send each person to the first transaction area their API permissions allow. */
export default function TransactionsLandingPage({ role }: { role: TransactionRole }) {
  const router = useRouter();
  const { can, isLoading } = useAccessControl();

  useEffect(() => {
    if (isLoading) return;
    const destination = firstAvailableTransaction.find(([permission]) => can(permission))?.[1];
    router.replace(destination ? `/dashboard/${role}/transactions/${destination}` : `/dashboard/${role}`);
  }, [can, isLoading, role, router]);

  // There is no transaction content here: this route only chooses an allowed
  // destination after the effective permissions have loaded.
  return null;
}
