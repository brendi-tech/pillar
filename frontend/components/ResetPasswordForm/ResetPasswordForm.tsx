"use client";

import { PillarLogoWithName } from "@/components/marketing/LandingPage/PillarLogoWithName";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { apiClient } from "@/lib/admin/api-client";
import { AxiosError } from "axios";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const missingParams = !uid || !token;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      await apiClient.post("/api/users/password-reset/confirm/", {
        uid,
        token,
        new_password: newPassword,
      });
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof AxiosError && err.response?.data) {
        const data = err.response.data;
        if (data.detail) {
          setError(data.detail);
        } else if (data.new_password) {
          const messages = Array.isArray(data.new_password)
            ? data.new_password
            : [data.new_password];
          setError(messages.join(" "));
        } else if (data.uid) {
          setError("This reset link is invalid.");
        } else {
          setError("Something went wrong. Please try again.");
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
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
            {isSuccess ? "Password Reset" : "Set New Password"}
          </h1>
          <p className="text-muted-foreground text-lg">
            {isSuccess
              ? "Your password has been updated successfully"
              : "Choose a new password for your account"}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isSuccess ? "All Done" : "New Password"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {missingParams ? (
              <div className="space-y-5">
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-sm font-medium text-destructive">
                    This reset link is invalid or incomplete.
                  </p>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  <Link
                    href="/forgot-password"
                    className="font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    Request a new reset link
                  </Link>
                </p>
              </div>
            ) : isSuccess ? (
              <div className="space-y-5">
                <div className="flex justify-center">
                  <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  You can now sign in with your new password.
                </p>
                <Button
                  asChild
                  size="lg"
                  className="w-full h-12 text-base font-medium"
                >
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            ) : (
              <>
                {error && (
                  <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                    <p className="text-sm font-medium text-destructive">
                      {error}
                    </p>
                    {error.includes("invalid") || error.includes("expired") ? (
                      <p className="text-sm text-destructive/80 mt-1">
                        <Link
                          href="/forgot-password"
                          className="underline underline-offset-4"
                        >
                          Request a new reset link
                        </Link>
                      </p>
                    ) : null}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label
                      htmlFor="new-password"
                      className="block text-sm font-medium"
                    >
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
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

                  <div className="space-y-2">
                    <Label
                      htmlFor="confirm-password"
                      className="block text-sm font-medium"
                    >
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isLoading}
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? (
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
                        Resetting...
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
