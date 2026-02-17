"use client";

import { PillarLogoWithName } from "@/components/marketing/LandingPage/PillarLogoWithName";
import { OAuthButtons } from "@/components/OAuthButtons/";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRedirectToReturnPath, useReturnToValue } from "@/hooks";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/providers/AuthProvider";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface SignupFormProps {
  /** If true, requires an invite code to sign up */
  requireInviteCode?: boolean;
}

export function SignupForm({ requireInviteCode = false }: SignupFormProps) {
  const { signUp, loginWithTokens, isAuthenticated } = useAuth();
  const redirectToReturnPath = useRedirectToReturnPath();
  const returnTo = useReturnToValue();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Extract email from URL params (set by accept-invite page)
  const emailFromUrl = searchParams.get("email") || "";

  // Extract invitation_token from returnTo URL (e.g., "/accept-invite?token=xxx")
  const invitationToken = useMemo(() => {
    if (!returnTo) return null;
    try {
      const url = new URL(returnTo, window.location.origin);
      if (url.pathname === "/accept-invite") {
        return url.searchParams.get("token");
      }
    } catch {
      return null;
    }
    return null;
  }, [returnTo]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(emailFromUrl);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Store invitation token in sessionStorage for OAuth flow
  // OAuth redirects lose URL params, so we persist the token
  useEffect(() => {
    if (invitationToken) {
      sessionStorage.setItem("pending_invitation_token", invitationToken);
    }
  }, [invitationToken]);

  // If already authenticated, redirect appropriately
  useEffect(() => {
    if (isAuthenticated) {
      // If they have an invitation token, go to accept-invite page to complete the flow
      if (invitationToken) {
        router.push(`/accept-invite?token=${invitationToken}`);
      } else {
        redirectToReturnPath("/onboarding");
      }
    }
  }, [isAuthenticated, redirectToReturnPath, invitationToken, router]);

  // Show loading while redirecting authenticated user
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
        <Spinner size="xl" />
      </div>
    );
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (requireInviteCode && !inviteCode.trim()) {
      setError("Invite code is required");
      return;
    }

    setIsLoading(true);

    try {
      await signUp(
        email,
        password,
        fullName,
        requireInviteCode ? inviteCode : undefined,
        invitationToken || undefined
      );
      // If joining via invitation, skip onboarding and go directly to dashboard
      if (invitationToken) {
        router.push("/knowledge?invitation_accepted=true");
      } else {
        // New user goes to onboarding
        redirectToReturnPath("/onboarding");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSuccess = async (token: string, refreshToken: string) => {
    setIsLoading(true);
    try {
      await loginWithTokens(token, refreshToken);

      // Check for pending invitation token from before OAuth redirect
      const pendingToken = sessionStorage.getItem("pending_invitation_token");
      if (pendingToken) {
        sessionStorage.removeItem("pending_invitation_token");
        // Redirect to accept-invite page to complete the invitation flow
        // The user is now authenticated and can accept the invitation
        router.push(`/accept-invite?token=${pendingToken}`);
      } else {
        // OAuth signup goes to onboarding (unless returnTo specified)
        redirectToReturnPath("/onboarding");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthError = (errorMessage: string) => {
    setError(errorMessage);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-4">
            <PillarLogoWithName className="h-10" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Create Your Account
          </h1>
          <p className="text-muted-foreground text-lg">
            Start building your AI-powered product copilot
          </p>
        </div>

        {/* Signup Card */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
            )}

            <OAuthButtons
              onSuccess={handleOAuthSuccess}
              onError={handleOAuthError}
              disabled={isLoading}
            />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-card px-3 text-muted-foreground">
                  or continue with email
                </span>
              </div>
            </div>

            <form onSubmit={handleSignup} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium block">
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isLoading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium block">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium block">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters long
                </p>
              </div>

              {requireInviteCode && (
                <div className="space-y-2">
                  <Label htmlFor="inviteCode" className="text-sm font-medium">
                    Invite Code
                  </Label>
                  <Input
                    id="inviteCode"
                    type="text"
                    required
                    placeholder="Enter your invite code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    disabled={isLoading}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Beta access requires an invite code
                  </p>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={isLoading}
                className="w-full h-12 text-base font-medium"
              >
                {isLoading ? (
                  <>
                    <Spinner size="md" className="mr-2" />
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href={
                  returnTo
                    ? `/login?returnTo=${encodeURIComponent(returnTo)}`
                    : "/login"
                }
                className="font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>

        {/* Footer note */}
        <p className="text-center text-sm text-muted-foreground">
          By signing up, you agree to our{" "}
          <a
            href="https://trypillar.com/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 underline-offset-4 hover:underline"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href="https://trypillar.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 underline-offset-4 hover:underline"
          >
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}
