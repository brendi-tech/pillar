import { isAdminRequest } from "@/lib/api-client";
import { redirect } from "next/navigation";
import { AdminLayoutClient } from "./AdminLayoutClient";

/**
 * Admin layout for the Pillar dashboard.
 *
 * Server component guard: redirects non-admin requests (e.g. crawlers hitting
 * trypillar.com/team) before any client code renders, preventing useAuth()
 * from throwing outside AdminAuthProvider.
 *
 * QueryClientProvider and AdminAuthProvider are provided by the root
 * layout's AdminProviders wrapper for the admin subdomain.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAdmin = await isAdminRequest();
  if (!isAdmin) {
    redirect("/");
  }
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
