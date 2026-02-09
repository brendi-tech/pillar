import { redirect } from "next/navigation";

// TEMPORARILY DISABLED - Signup page redirects to login
// Original imports:
// "use client";
// import { SignupForm } from "@/components/SignupForm";
// import { Loader2 } from "lucide-react";
// import { Suspense } from "react";

export default function SignupPage() {
  // TEMPORARILY DISABLED - redirect to login instead
  redirect("/login");

  /* Original signup form - uncomment to restore:
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
  */
}
