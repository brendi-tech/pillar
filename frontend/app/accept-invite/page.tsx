"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PillarLogoWithName } from "@/components/marketing/LandingPage/PillarLogoWithName";
import { useAuth } from "@/providers/AuthProvider";
import {
  acceptInvitationMutation,
  declineInvitationMutation,
  invitationPreviewQuery,
} from "@/queries/organization.queries";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertCircle, Mail, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";

const PAGE_BG =
  "min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4";

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
      await refreshUser();
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

  const hasTokenError = !token;
  const loading = isInvitationPending || authLoading;
  const accepting = acceptInvitation.isPending || declineInvitation.isPending;

  const error = hasTokenError
    ? "No invitation token provided"
    : isInvitationError
      ? ((invitationError as Error & { response?: { data?: { error?: string } } })
          ?.response?.data?.error || "This invitation has expired or is no longer valid")
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

  if (loading) {
    return (
      <div className={PAGE_BG}>
        <div className="text-center">
          <Spinner size="xl" className="mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            Loading invitation...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={PAGE_BG}>
        <div className="w-full max-w-lg space-y-8">
          <div className="text-center space-y-3">
            <div className="flex justify-center mb-4">
              <PillarLogoWithName className="h-10" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Invalid Invitation
            </h1>
            <p className="text-muted-foreground text-lg">
              This invitation could not be loaded
            </p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <CardTitle>Unable to Accept</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/knowledge">
                <Button size="lg" className="w-full h-12 text-base font-medium">
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

  if (accepting) {
    return (
      <div className={PAGE_BG}>
        <div className="text-center">
          <Spinner size="xl" className="mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            Processing invitation...
          </p>
        </div>
      </div>
    );
  }

  if (emailMismatch && user && invitation) {
    return (
      <div className={PAGE_BG}>
        <div className="w-full max-w-lg space-y-8">
          <div className="text-center space-y-3">
            <div className="flex justify-center mb-4">
              <PillarLogoWithName className="h-10" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Email Mismatch
            </h1>
            <p className="text-muted-foreground text-lg">
              You&apos;re signed in with a different account
            </p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle>Wrong Account</CardTitle>
              <CardDescription>
                Please log out and sign in with the correct account to accept
                this invitation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between rounded-md bg-muted/50 p-3">
                  <span className="text-muted-foreground">Invitation sent to</span>
                  <span className="font-medium text-foreground">
                    {invitation.email}
                  </span>
                </div>
                <div className="flex justify-between rounded-md bg-muted/50 p-3">
                  <span className="text-muted-foreground">Logged in as</span>
                  <span className="font-medium text-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
              <Button
                onClick={logout}
                size="lg"
                className="w-full h-12 text-base font-medium"
              >
                Log Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className={PAGE_BG}>
        <div className="w-full max-w-lg space-y-8">
          <div className="text-center space-y-3">
            <div className="flex justify-center mb-4">
              <PillarLogoWithName className="h-10" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              You&apos;ve Been Invited
            </h1>
            <p className="text-muted-foreground text-lg">
              Join a team on Pillar
            </p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>{invitation.organization.name}</CardTitle>
              <CardDescription>
                <span className="font-medium text-foreground">
                  {invitation.invited_by.full_name}
                </span>{" "}
                ({invitation.invited_by.email}) invited you as{" "}
                <span className="font-medium">
                  {invitation.role.charAt(0).toUpperCase() +
                    invitation.role.slice(1)}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <p className="text-muted-foreground">
                  Logged in as{" "}
                  <span className="font-medium text-foreground">
                    {user.email}
                  </span>
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                This invitation expires on{" "}
                {format(new Date(invitation.expires_at), "MMMM d, yyyy")}
              </p>

              <div className="space-y-3">
                <Button
                  onClick={handleAcceptInvitation}
                  disabled={accepting}
                  size="lg"
                  className="w-full h-12 text-base font-medium"
                >
                  {accepting ? (
                    <>
                      <Spinner size="md" className="mr-2" />
                      Processing...
                    </>
                  ) : (
                    "Accept Invitation"
                  )}
                </Button>
                <Button
                  onClick={handleDeclineInvitation}
                  disabled={accepting}
                  variant="outline"
                  size="lg"
                  className="w-full h-12 text-base font-medium"
                >
                  Decline
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_BG}>
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-4">
            <PillarLogoWithName className="h-10" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            You&apos;ve Been Invited
          </h1>
          <p className="text-muted-foreground text-lg">
            Join a team on Pillar
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>{invitation.organization.name}</CardTitle>
            <CardDescription>
              <span className="font-medium text-foreground">
                {invitation.invited_by.full_name}
              </span>{" "}
              ({invitation.invited_by.email}) invited you as{" "}
              <span className="font-medium">
                {invitation.role.charAt(0).toUpperCase() +
                  invitation.role.slice(1)}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              This invitation expires on{" "}
              {format(new Date(invitation.expires_at), "MMMM d, yyyy")}
            </p>

            <div className="space-y-3">
              {invitation.user_exists ? (
                <>
                  <p className="text-sm font-medium text-foreground">
                    Sign in to accept this invitation:
                  </p>
                  <Link
                    href={`/login?returnTo=${encodeURIComponent(`/accept-invite?token=${token}`)}`}
                    className="block"
                  >
                    <Button size="lg" className="w-full h-12 text-base font-medium">
                      Sign In
                    </Button>
                  </Link>
                  <p className="text-center text-sm text-muted-foreground">
                    Don&apos;t have an account?{" "}
                    <Link
                      href={`/signup?returnTo=${encodeURIComponent(`/accept-invite?token=${token}`)}&email=${encodeURIComponent(invitation.email)}`}
                      className="font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      Create one
                    </Link>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">
                    Create an account to accept this invitation:
                  </p>
                  <Link
                    href={`/signup?returnTo=${encodeURIComponent(`/accept-invite?token=${token}`)}&email=${encodeURIComponent(invitation.email)}`}
                    className="block"
                  >
                    <Button size="lg" className="w-full h-12 text-base font-medium">
                      Create Account
                    </Button>
                  </Link>
                  <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link
                      href={`/login?returnTo=${encodeURIComponent(`/accept-invite?token=${token}`)}`}
                      className="font-semibold text-primary hover:text-primary/80 transition-colors"
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
        <div className={PAGE_BG}>
          <Spinner size="xl" />
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
