"use client";

import { OrganizationProvider, ProductProvider, useAuth } from "@/providers";
import { redirect } from "next/navigation";

/**
 * Minimal layout for onboarding flow.
 * No sidebar, just the auth check and organization context.
 */
function OnboardingLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  // Show nothing while loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    redirect("/login");
  }

  return <>{children}</>;
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OrganizationProvider>
      <ProductProvider>
        <OnboardingLayoutInner>{children}</OnboardingLayoutInner>
      </ProductProvider>
    </OrganizationProvider>
  );
}
