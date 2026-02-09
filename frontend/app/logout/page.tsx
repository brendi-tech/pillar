"use client";

import { PillarLogoWithName } from "@/components/marketing/LandingPage/PillarLogoWithName";
import { useAuth } from "@/providers/AuthProvider";
import { usePillar } from "@pillar-ai/react";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

/**
 * Logout page - clears all auth tokens and redirects to login.
 * Lives on the admin subdomain.
 */
export default function LogoutPage() {
  const { pillar } = usePillar();
  const { logout } = useAuth();

  useEffect(() => {
    // Also clear any other auth-related storage
    if (typeof window !== "undefined") {
      // Clear localStorage items
      localStorage.removeItem("pillar_current_organization_id");
      localStorage.removeItem("pillar_current_help_center_id");
    }

    pillar?.logout();

    // Use the AuthProvider logout which handles tokens, query cache, and navigation
    logout();
  }, [logout, pillar]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-4">
            <PillarLogoWithName className="h-10" />
          </div>
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground">Signing out...</p>
        </div>
      </div>
    </div>
  );
}
