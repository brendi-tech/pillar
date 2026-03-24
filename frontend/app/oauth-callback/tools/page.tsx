"use client";

import { CheckCircle, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function ToolOAuthCallbackPage() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const error = searchParams.get("error");

  const isSuccess = status === "success";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-lg">
        {isSuccess ? (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="mt-4 text-xl font-semibold text-green-700 dark:text-green-400">
              Account Connected
            </h1>
            <p className="mt-2 text-muted-foreground">
              You can close this window and continue your conversation.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <h1 className="mt-4 text-xl font-semibold text-destructive">
              Connection Failed
            </h1>
            <p className="mt-2 text-muted-foreground">
              {error || "Something went wrong. Please try again from the conversation."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
