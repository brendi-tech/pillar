"use client";

import { OAuthButtons } from "@/components/OAuthButtons/";
import { PillarLogoWithName } from "@/components/marketing/LandingPage/PillarLogoWithName";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRedirectToReturnPath, useReturnToValue } from "@/hooks";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/providers/AuthProvider";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";

export function LoginForm() {
  const { login, loginWithTokens, isAuthenticated } = useAuth();
  const redirectToReturnPath = useRedirectToReturnPath();
  const returnTo = useReturnToValue();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // If already authenticated, redirect to return path
  useEffect(() => {
    if (isAuthenticated) {
      redirectToReturnPath("/knowledge");
    }
  }, [isAuthenticated, redirectToReturnPath]);

  // Show loading while redirecting authenticated user
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
        <Spinner size="xl" />
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      redirectToReturnPath("/knowledge");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSuccess = async (token: string, refreshToken: string) => {
    setIsLoading(true);
    try {
      await loginWithTokens(token, refreshToken);
      redirectToReturnPath("/knowledge");
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
          <h1 className="text-3xl font-bold tracking-tight">Welcome Back</h1>
          <p className="text-muted-foreground text-lg">
            Sign in to manage your product copilot
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
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

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="block text-sm font-medium">
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
                <Label htmlFor="password" className="block text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="Enter your password"
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
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={isLoading}
                className="w-full h-12 text-base font-medium"
              >
                {isLoading ? (
                  <>
                    <Spinner size="md" className="mr-2" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href={
                  returnTo
                    ? `/signup?returnTo=${encodeURIComponent(returnTo)}`
                    : "/signup"
                }
                className="font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                Sign up
              </Link>
            </p>
          </CardContent>
        </Card>

        {/* Footer note */}
        <p className="text-center text-sm text-muted-foreground">
          By signing in, you agree to our{" "}
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
