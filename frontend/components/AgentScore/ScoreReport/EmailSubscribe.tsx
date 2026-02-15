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
      <div className="flex items-center gap-2.5 px-5 py-3.5 rounded-xl bg-[#F0FFF4] border border-[#C6F6D5]">
        <Check className="h-4 w-4 text-[#0CCE6B] shrink-0" />
        <p className="text-sm text-[#22543D]">
          We&apos;ll email your full report to <strong>{email.trim()}</strong> when it&apos;s ready.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl bg-[#FAFAF8] border border-[#E8E4DC] px-5 py-4">
      <div className="flex items-center gap-2 mb-2.5">
        <Mail className="h-4 w-4 text-[#FF6E00] shrink-0" />
        <p className="text-sm font-medium text-[#1A1A1A]">
          Get your scores by email
        </p>
      </div>
      <p className="text-[13px] text-[#6B6B6B] mb-3 leading-relaxed">
        Leave your email and we&apos;ll send you the full report when it&apos;s complete.
      </p>
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          disabled={subscribe.isPending}
          className="h-10 text-sm bg-white border-[#D4D4D4] placeholder:text-[#999] focus-visible:ring-[#FF6E00]/30 focus-visible:border-[#FF6E00]"
        />
        <Button
          type="submit"
          disabled={subscribe.isPending}
          className="h-10 px-5 text-sm font-medium bg-[#FF6E00] hover:bg-[#E06200] text-white shrink-0"
        >
          {subscribe.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Notify me"
          )}
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-[#FF4E42] font-medium">{error}</p>
      )}
    </form>
  );
}
