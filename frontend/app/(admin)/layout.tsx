"use client";

import { AdminShell } from "@/components/AdminLayout";
import {
  OrganizationProvider,
  ProductProvider,
  SourcesProvider,
  SystemNotificationProvider,
  useAuth,
  WebSocketProvider,
} from "@/providers";
import { PillarSyncProvider } from "@/providers/PillarSDKProvider";

/**
 * Inner component that uses the auth context.
 */
function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // User is guaranteed to exist after auth provider passes
  if (!user) {
    return null;
  }

  return <AdminShell>{children}</AdminShell>;
}

/**
 * Admin layout for the Pillar dashboard.
 * Uses a different shell with sidebar navigation.
 *
 * Note: QueryClientProvider and AdminAuthProvider are provided by the root
 * layout's AdminProviders wrapper for the admin subdomain.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OrganizationProvider>
      <ProductProvider>
        <WebSocketProvider>
          <SourcesProvider>
            <SystemNotificationProvider>
              <PillarSyncProvider>
                <AdminLayoutInner>{children}</AdminLayoutInner>
              </PillarSyncProvider>
            </SystemNotificationProvider>
          </SourcesProvider>
        </WebSocketProvider>
      </ProductProvider>
    </OrganizationProvider>
  );
}
