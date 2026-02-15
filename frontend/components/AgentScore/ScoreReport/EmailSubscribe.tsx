"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mail, Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { subscribeEmailMutation } from "@/queries/agentScore.queries";

interface EmailSubscribeProps {
  reportId: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function EmailSubscribe({ reportId }: EmailSubscribeProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribe = useMutation({
    ...subscribeEmailMutation(),
    onSuccess: () => {
      setSubmitted(true);
      setError(null);
    },
    onError: () => {
      setError("Something went wrong. Try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email.");
      return;
    }
    if (!isValidEmail(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }

    subscribe.mutate({ reportId, email: trimmed });
  };

  if (submitted) {
    return (
      <div className="flex items-center justify-center gap-2 text-center">
        <Check className="h-3.5 w-3.5 text-[#0CCE6B] shrink-0" />
        <p className="text-sm text-[#6B6B6B]">
          We&apos;ll email your report to <strong className="text-[#1A1A1A]">{email.trim()}</strong>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center">
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <Mail className="h-3.5 w-3.5 text-[#6B6B6B] shrink-0" />
        <span className="text-sm text-[#6B6B6B] shrink-0">Notify me by email</span>
        <Input
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          disabled={subscribe.isPending}
          className="h-8 text-sm bg-white border-[#D4D4D4] placeholder:text-[#999] focus-visible:ring-[#FF6E00]/30 focus-visible:border-[#FF6E00] max-w-[220px]"
        />
        <Button
          type="submit"
          disabled={subscribe.isPending}
          className="h-8 px-3.5 text-sm font-medium bg-[#FF6E00] hover:bg-[#E06200] text-white shrink-0"
        >
          {subscribe.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Send"
          )}
        </Button>
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-[#FF4E42] font-medium text-center">{error}</p>
      )}
    </form>
  );
}
