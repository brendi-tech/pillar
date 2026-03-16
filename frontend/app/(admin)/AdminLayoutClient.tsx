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

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return <AdminShell>{children}</AdminShell>;
}

export function AdminLayoutClient({
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
