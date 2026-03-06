"use client";

import { OAuthButtons } from "@/components/OAuthButtons/";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  apiClient,
  setStoredAccessToken,
  setStoredRefreshToken,
} from "@/lib/admin/api-client";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useDocsUser } from "./DocsUserProvider";

interface DocsLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocsLoginModal({ open, onOpenChange }: DocsLoginModalProps) {
  const { refetch } = useDocsUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiClient.post("/api/auth/token/", {
        email,
        password,
      });
      const { access, refresh } = response.data;
      setStoredAccessToken(access);
      setStoredRefreshToken(refresh);
      onOpenChange(false);
      resetForm();
      refetch();
    } catch {
      setError("Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSuccess = async (token: string, refreshToken: string) => {
    setIsLoading(true);
    try {
      setStoredAccessToken(token);
      setStoredRefreshToken(refreshToken);
      onOpenChange(false);
      resetForm();
      refetch();
    } catch {
      setError("Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to personalize docs</DialogTitle>
          <DialogDescription>
            Sign in to see your product key in code examples.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
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
              <span className="bg-background px-3 text-muted-foreground">
                or continue with email
              </span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="docs-email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="docs-email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="docs-password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="docs-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="h-10 pr-10"
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
              disabled={isLoading}
              className="w-full h-10"
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
