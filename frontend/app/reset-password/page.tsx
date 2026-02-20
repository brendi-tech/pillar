"use client";

import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { Spinner } from "@/components/ui/spinner";
import { Suspense } from "react";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
          <Spinner size="xl" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
