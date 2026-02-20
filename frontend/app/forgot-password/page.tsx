"use client";

import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { Spinner } from "@/components/ui/spinner";
import { Suspense } from "react";

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
          <Spinner size="xl" />
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
