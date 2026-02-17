"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PillarLogoWithName } from "@/components/marketing/LandingPage/PillarLogoWithName";
import { useAuth } from "@/providers/AuthProvider";
import {
  acceptInvitationMutation,
  declineInvitationMutation,
  invitationPreviewQuery,
} from "@/queries/organization.queries";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Mail, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { user, isLoading: authLoading, refreshUser, logout } = useAuth();

  const [mutationError, setMutationError] = useState<string | null>(null);
  const [emailMismatch, setEmailMismatch] = useState(false);

  const {
    data: invitation,
    isPending: isInvitationPending,
    isError: isInvitationError,
    error: invitationError,
  } = useQuery({
    ...invitationPreviewQuery(token || ""),
    enabled: !!token,
  });

  // If user is logged in but with different email, show mismatch message
  useEffect(() => {
    if (user && invitation && invitation.email !== user.email) {
      setEmailMismatch(true);
    } else {
      setEmailMismatch(false);
    }
  }, [invitation, user]);

  const acceptInvitation = useMutation({
    ...acceptInvitationMutation(),
    onSuccess: async () => {
      // Refetch user data to update organizations
      await refreshUser();
      // Redirect to dashboard after successful acceptance
      router.push("/knowledge?invitation_accepted=true");
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      console.error("Failed to accept invitation:", err);
      setMutationError(
        err.response?.data?.error ||
          "Failed to accept invitation. Please try again."
      );
    },
  });

  const declineInvitation = useMutation({
    ...declineInvitationMutation(),
    onSuccess: () => {
      // Redirect to dashboard after declining
      router.push("/knowledge?invitation_declined=true");
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      console.error("Failed to decline invitation:", err);
      setMutationError(
        err.response?.data?.error ||
          "Failed to decline invitation. Please try again."
      );
    },
  });

  // Handle missing token
  const hasTokenError = !token;
  const loading = isInvitationPending || authLoading;
  const accepting = acceptInvitation.isPending || declineInvitation.isPending;

  const error = hasTokenError
    ? "No invitation token provided"
    : isInvitationError
      ? ((invitationError as Error & { response?: { data?: { error?: string } } })
          ?.response?.data?.error || "This invitation is invalid or has expired")
      : mutationError;

  const handleAcceptInvitation = () => {
    if (!token) return;
    setMutationError(null);
    acceptInvitation.mutate(token);
  };

  const handleDeclineInvitation = () => {
    if (!token) return;
    setMutationError(null);
    declineInvitation.mutate(token);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="text-center">
          <Spinner size="xl" className="mx-auto mb-4 text-orange-500" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Loading invitation...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4">
        <div className="w-full max-w-md">
          <Card className="shadow-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <CardContent className="pt-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <X className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                Invalid Invitation
              </h1>
              <p className="mb-6 text-gray-500 dark:text-gray-400">{error}</p>
              <Link href="/knowledge">
                <Button className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white">
                  Go to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  // Accepting state
  if (accepting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="text-center">
          <Spinner size="xl" className="mx-auto mb-4 text-orange-500" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Processing invitation...
          </p>
        </div>
      </div>
    );
  }

  // Email mismatch - user is logged in with a different email
  if (emailMismatch && user && invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <PillarLogoWithName className="h-10" />
            </div>
          </div>

          <Card className="shadow-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <CardContent className="pt-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
                <X className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                Email Mismatch
              </h1>
              <div className="mb-6 space-y-3 text-sm text-gray-500 dark:text-gray-400">
                <p>
                  This invitation was sent to{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {invitation.email}
                  </span>
                </p>
                <p>
                  You are currently logged in as{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {user.email}
                  </span>
                </p>
                <p>
                  Please log out and sign in with the correct account to accept
                  this invitation.
                </p>
              </div>
              <Button
                onClick={logout}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
              >
                Log Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // If user is authenticated, show accept/decline options
  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <PillarLogoWithName className="h-10" />
            </div>
          </div>

          <Card className="shadow-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <CardContent className="pt-6">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
                <Mail className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>

              <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                You&apos;ve Been Invited!
              </h1>

              <div className="mb-6 space-y-3 text-sm text-gray-500 dark:text-gray-400">
                <p>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {invitation.invited_by.full_name}
                  </span>{" "}
                  ({invitation.invited_by.email}) has invited you to join
                </p>
                <div className="rounded-lg bg-gray-100 dark:bg-gray-700 p-4">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {invitation.organization.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    as{" "}
                    <span className="font-medium">
                      {invitation.role.charAt(0).toUpperCase() +
                        invitation.role.slice(1)}
                    </span>
                  </p>
                </div>
                <p className="text-xs">
                  This invitation will expire on{" "}
                  {format(new Date(invitation.expires_at), "MMMM d, yyyy")}
                </p>
              </div>

              <div className="mb-4 rounded-lg bg-orange-50 dark:bg-orange-900/10 p-3 text-sm">
                <p className="text-gray-700 dark:text-gray-300">
                  Logged in as:{" "}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {user.email}
                  </span>
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleAcceptInvitation}
                  disabled={accepting}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                >
                  {accepting ? "Processing..." : "Accept Invitation"}
                </Button>
                <Button
                  onClick={handleDeclineInvitation}
                  disabled={accepting}
                  variant="outline"
                  className="w-full"
                >
                  {accepting ? "Processing..." : "Decline"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show invitation details and prompt to login
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <PillarLogoWithName className="h-10" />
          </div>
        </div>

        <Card className="shadow-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <CardContent className="pt-6">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
              <Mail className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>

            <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
              You&apos;ve Been Invited!
            </h1>

            <div className="mb-6 space-y-3 text-sm text-gray-500 dark:text-gray-400">
              <p>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {invitation.invited_by.full_name}
                </span>{" "}
                ({invitation.invited_by.email}) has invited you to join
              </p>
              <div className="rounded-lg bg-gray-100 dark:bg-gray-700 p-4">
                <p className="font-semibold text-gray-900 dark:text-white">
                  {invitation.organization.name}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  as{" "}
                  <span className="font-medium">
                    {invitation.role.charAt(0).toUpperCase() +
                      invitation.role.slice(1)}
                  </span>
                </p>
              </div>
              <p className="text-xs">
                This invitation will expire on{" "}
                {format(new Date(invitation.expires_at), "MMMM d, yyyy")}
              </p>
            </div>

            <div className="space-y-3">
              {invitation.user_exists ? (
                <>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Sign in to accept this invitation:
                  </p>
                  <Link
                    href={`/login?returnTo=${encodeURIComponent(`/accept-invite?token=${token}`)}`}
                    className="block"
                  >
                    <Button className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white">
                      Sign In
                    </Button>
                  </Link>
                  <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                    Don&apos;t have an account?{" "}
                    <Link
                      href={`/signup?returnTo=${encodeURIComponent(`/accept-invite?token=${token}`)}&email=${encodeURIComponent(invitation.email)}`}
                      className="font-medium text-orange-600 hover:text-orange-500"
                    >
                      Create one
                    </Link>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Create an account to accept this invitation:
                  </p>
                  <Link
                    href={`/signup?returnTo=${encodeURIComponent(`/accept-invite?token=${token}`)}&email=${encodeURIComponent(invitation.email)}`}
                    className="block"
                  >
                    <Button className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white">
                      Create Account
                    </Button>
                  </Link>
                  <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                    Already have an account?{" "}
                    <Link
                      href={`/login?returnTo=${encodeURIComponent(`/accept-invite?token=${token}`)}`}
                      className="font-medium text-orange-600 hover:text-orange-500"
                    >
                      Sign in
                    </Link>
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
          <Spinner size="xl" className="text-orange-500" />
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
