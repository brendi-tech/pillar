"use client";

import { Spinner } from "@/components/ui/spinner";
import { getAuthToken, getRefreshToken } from "@/lib/admin/auth";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type Status = "checking" | "redirecting" | "error";

function CLIAuthContent() {
  const searchParams = useSearchParams();
  const port = searchParams.get("port");
  const state = searchParams.get("state");
  const [status, setStatus] = useState<Status>("checking");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!port || !state) {
      setErrorMessage(
        "Missing parameters. Please start authentication from the CLI with `pillar auth login`."
      );
      setStatus("error");
      return;
    }

    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
      setErrorMessage("Invalid callback port.");
      setStatus("error");
      return;
    }

    const timer = setTimeout(() => {
      const accessToken = getAuthToken();
      const refreshToken = getRefreshToken();

      if (accessToken && refreshToken) {
        setStatus("redirecting");
        const callbackUrl = new URL(`http://localhost:${portNum}/callback`);
        callbackUrl.searchParams.set("access", accessToken);
        callbackUrl.searchParams.set("refresh", refreshToken);
        callbackUrl.searchParams.set("state", state);
        window.location.href = callbackUrl.toString();
      } else {
        const returnTo = `/cli/auth?port=${portNum}&state=${encodeURIComponent(state)}`;
        window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [port, state]);

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
        <div className="text-center max-w-md px-6">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold mb-2">
            CLI Authentication Error
          </h1>
          <p className="text-muted-foreground">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
      <div className="text-center">
        <Spinner size="xl" />
        <p className="mt-4 text-muted-foreground">
          {status === "redirecting"
            ? "Sending credentials to CLI..."
            : "Checking authentication..."}
        </p>
      </div>
    </div>
  );
}

export default function CLIAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
          <Spinner size="xl" />
        </div>
      }
    >
      <CLIAuthContent />
    </Suspense>
  );
}
