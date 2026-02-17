"use client";

import { SignupForm } from "@/components/SignupForm";
import { Spinner } from "@/components/ui/spinner";
import { Suspense } from "react";

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
          <Spinner size="xl" className="text-primary" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
