"use client";

import { LoginForm } from "@/components/LoginForm";
import { Spinner } from "@/components/ui/spinner";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
          <Spinner size="xl" className="text-primary" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
