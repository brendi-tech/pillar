"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle, Github, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * GitHub OAuth callback page.
 *
 * After successful GitHub OAuth, the backend redirects here with:
 * - github_connected=true: OAuth was successful
 * - github_error=<error>: OAuth failed with error
 *
 * This page signals success/failure and redirects back to the
 * source creation wizard.
 */
export default function GitHubOAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("Processing GitHub connection...");

  useEffect(() => {
    const processCallback = async () => {
      try {
        const connected = searchParams.get("github_connected");
        const error = searchParams.get("github_error");

        // Handle error case
        if (error) {
          setStatus("error");
          const errorMessages: Record<string, string> = {
            access_denied: "You denied access to GitHub",
            invalid_state: "Security validation failed. Please try again.",
            no_token: "Failed to receive access token from GitHub",
            token_invalid: "The GitHub token could not be verified",
            request_failed: "Failed to communicate with GitHub",
            server_error: "An unexpected error occurred",
          };
          setMessage(errorMessages[error] || `Authentication failed: ${error}`);
          return;
        }

        // Handle success case
        if (connected === "true") {
          // Mark GitHub as connected in sessionStorage
          sessionStorage.setItem(
            "github_oauth_success",
            JSON.stringify({
              connected: true,
              timestamp: new Date().toISOString(),
            })
          );

          setStatus("success");
          setMessage("GitHub connected successfully! Redirecting...");

          // Redirect back to the source wizard
          setTimeout(() => {
            router.push("/knowledge/new?step=2&provider=github");
          }, 1500);
          return;
        }

        // No clear status - might be a direct visit
        setStatus("error");
        setMessage("Invalid callback. Please start the OAuth flow again.");
      } catch (err) {
        setStatus("error");
        setMessage(
          `Error processing callback: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    };

    processCallback();
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-lg">
        {status === "loading" && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center">
              <Spinner size="lg" className="text-primary" />
            </div>
            <h1 className="mt-4 text-xl font-semibold">
              Connecting to GitHub...
            </h1>
            <p className="mt-2 text-muted-foreground">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Github className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CheckCircle className="mx-auto mt-2 h-6 w-6 text-green-500" />
            <h1 className="mt-4 text-xl font-semibold text-green-700 dark:text-green-400">
              GitHub Connected!
            </h1>
            <p className="mt-2 text-muted-foreground">{message}</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <Github className="h-6 w-6 text-destructive" />
            </div>
            <XCircle className="mx-auto mt-2 h-6 w-6 text-destructive" />
            <h1 className="mt-4 text-xl font-semibold text-destructive">
              Connection Failed
            </h1>
            <p className="mt-2 text-muted-foreground">{message}</p>
            <div className="mt-6 space-x-3">
              <Button
                variant="outline"
                onClick={() => router.push("/knowledge/new?provider=github")}
              >
                Try Again
              </Button>
              <Button variant="ghost" onClick={() => router.push("/knowledge")}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
