"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HEARD_ABOUT_US_OPTIONS = [
  { value: "google_search", label: "Google Search" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter", label: "Twitter/X" },
  { value: "friend_colleague", label: "Friend or Colleague" },
  { value: "blog_article", label: "Blog or Article" },
  { value: "book_face", label: "Bookface" },
  { value: "podcast", label: "Podcast" },
  { value: "youtube", label: "YouTube" },
  { value: "conference_event", label: "Conference or Event" },
  { value: "hacker_news", label: "Hacker News" },
  { value: "reddit", label: "Reddit" },
  { value: "other", label: "Other" },
] as const;

interface EarlyAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEntryId?: string | null;
  initialStep?: Step;
}

type Step = "email" | "details" | "complete";
type FormStatus = "idle" | "submitting" | "error";

export function EarlyAccessModal({
  open,
  onOpenChange,
  initialEntryId,
  initialStep,
}: EarlyAccessModalProps) {
  const [step, setStep] = useState<Step>(initialStep ?? "email");
  const [email, setEmail] = useState("");
  const [entryId, setEntryId] = useState<string | null>(initialEntryId ?? null);

  // Sync step/entryId when props change (e.g., hero inline form opens modal at step 2)
  useEffect(() => {
    if (open) {
      if (initialStep) setStep(initialStep);
      if (initialEntryId) setEntryId(initialEntryId);
    }
  }, [open, initialStep, initialEntryId]);

  const [detailsData, setDetailsData] = useState({
    name: "",
    company: "",
    use_case: "",
    heard_about_us: "",
    heard_about_us_other: "",
  });
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const getBackendUrl = () => {
    // In browser, derive API URL from current domain
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (hostname === "trypillar.com" || hostname.endsWith(".trypillar.com")) {
        return "https://help-api.trypillar.com";
      }
    }
    // Fallback for SSR or local development
    return process.env.NEXT_PUBLIC_PILLAR_API_URL || "http://localhost:8003";
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/public/waitlist/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setEntryId(data.id);
        setStep("details");
        setStatus("idle");
      } else {
        setErrorMessage(data.detail || "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Skip if no details provided
    if (!detailsData.name && !detailsData.company && !detailsData.use_case && !detailsData.heard_about_us) {
      setStep("complete");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/public/waitlist/${entryId}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(detailsData),
      });

      if (response.ok) {
        setStep("complete");
        setStatus("idle");
      } else {
        // Even if update fails, still show complete since email was captured
        setStep("complete");
        setStatus("idle");
      }
    } catch {
      // Even if update fails, still show complete since email was captured
      setStep("complete");
      setStatus("idle");
    }
  };

  const handleSkip = () => {
    setStep("complete");
  };

  const handleClose = () => {
    // Reset all state when closing
    setStep("email");
    setEmail("");
    setEntryId(null);
    setDetailsData({ name: "", company: "", use_case: "", heard_about_us: "", heard_about_us_other: "" });
    setStatus("idle");
    setErrorMessage("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-white">
        {/* Step 1: Email Capture */}
        {step === "email" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                Join the Waitlist
              </DialogTitle>
              <DialogDescription className="text-foreground/60">
                Be first to know when Pillar launches.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEmailSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={status === "submitting"}
                  autoFocus
                />
              </div>

              {status === "error" && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {errorMessage}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-foreground text-white hover:bg-foreground/90"
                disabled={status === "submitting"}
              >
                {status === "submitting" ? "Joining..." : "Join Waitlist"}
              </Button>
            </form>
          </>
        )}

        {/* Step 2: Optional Details */}
        {step === "details" && (
          <>
            <div className="py-4 text-center">
              <div className="mb-4 text-4xl">🎉</div>
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-center">
                  You&apos;re on the list!
                </DialogTitle>
                <DialogDescription className="text-center text-foreground/60 mt-2">
                  Help our founders understand what you want to do
                  <span className="block text-sm mt-1">(optional)</span>
                </DialogDescription>
              </DialogHeader>
            </div>
            <form onSubmit={handleDetailsSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Your name"
                  value={detailsData.name}
                  onChange={(e) =>
                    setDetailsData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  disabled={status === "submitting"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  placeholder="Your company"
                  value={detailsData.company}
                  onChange={(e) =>
                    setDetailsData((prev) => ({ ...prev, company: e.target.value }))
                  }
                  disabled={status === "submitting"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="use_case">
                  What are you hoping to accomplish with Pillar?
                </Label>
                <Textarea
                  id="use_case"
                  placeholder="Tell us about your goals..."
                  value={detailsData.use_case}
                  onChange={(e) =>
                    setDetailsData((prev) => ({ ...prev, use_case: e.target.value }))
                  }
                  rows={3}
                  disabled={status === "submitting"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="heard_about_us">
                  How did you hear about us?
                </Label>
                <Select
                  value={detailsData.heard_about_us}
                  onValueChange={(value) =>
                    setDetailsData((prev) => ({ 
                      ...prev, 
                      heard_about_us: value,
                      // Clear "other" text if not selecting "other"
                      heard_about_us_other: value === "other" ? prev.heard_about_us_other : ""
                    }))
                  }
                  disabled={status === "submitting"}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an option..." />
                  </SelectTrigger>
                  <SelectContent>
                    {HEARD_ABOUT_US_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {detailsData.heard_about_us === "other" && (
                  <Input
                    id="heard_about_us_other"
                    placeholder="Please specify..."
                    value={detailsData.heard_about_us_other}
                    onChange={(e) =>
                      setDetailsData((prev) => ({ ...prev, heard_about_us_other: e.target.value }))
                    }
                    disabled={status === "submitting"}
                    className="mt-2"
                  />
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleSkip}
                  disabled={status === "submitting"}
                >
                  Skip for now
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-foreground text-white hover:bg-foreground/90"
                  disabled={status === "submitting"}
                >
                  {status === "submitting" ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </form>
          </>
        )}

        {/* Step 3: Complete */}
        {step === "complete" && (
          <div className="py-8 text-center">
            <div className="mb-4 text-4xl">✨</div>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-center">
                Thanks for joining!
              </DialogTitle>
              <DialogDescription className="text-center text-foreground/60 mt-2">
                We&apos;ll be in touch soon with updates on Pillar.
              </DialogDescription>
            </DialogHeader>
            <Button
              onClick={handleClose}
              className="mt-6 bg-foreground text-white hover:bg-foreground/90"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Also export as WaitlistModal for semantic clarity
export { EarlyAccessModal as WaitlistModal };
