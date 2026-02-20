"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";

export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/setup");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
      <Spinner size="lg" />
    </div>
  );
}
