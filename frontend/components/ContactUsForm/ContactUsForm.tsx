"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  type ContactSubmissionPayload,
  PublicApiValidationError,
} from "@/lib/public/contact-api";
import { createContactSubmissionMutation } from "@/queries/contact.queries";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Mail, MessageSquareMore, Sparkles } from "lucide-react";
import { useState } from "react";

const INITIAL_FORM: ContactSubmissionPayload = {
  name: "",
  email: "",
  company: "",
  message: "",
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function ContactUsForm() {
  const [formData, setFormData] = useState<ContactSubmissionPayload>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const submitContact = useMutation({
    ...createContactSubmissionMutation(),
    onSuccess: (data) => {
      setSuccessMessage(data.detail);
      setFieldErrors({});
      setFormError(null);
      setFormData(INITIAL_FORM);
    },
    onError: (error: unknown) => {
      if (error instanceof PublicApiValidationError) {
        setFieldErrors({
          name: error.getFieldError("name") || "",
          email: error.getFieldError("email") || "",
          company: error.getFieldError("company") || "",
          message: error.getFieldError("message") || "",
        });
        setFormError(null);
        return;
      }

      setFieldErrors({});
      setFormError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    },
  });

  const updateField = (
    field: keyof ContactSubmissionPayload,
    value: ContactSubmissionPayload[keyof ContactSubmissionPayload]
  ) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
    setFormError(null);
  };

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!formData.name.trim()) nextErrors.name = "Enter your name.";
    if (!formData.email.trim()) {
      nextErrors.email = "Enter your email.";
    } else if (!isValidEmail(formData.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!formData.company.trim()) nextErrors.company = "Enter your company.";
    if (!formData.message.trim()) nextErrors.message = "Tell us a bit more.";

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage(null);
    setFormError(null);

    if (!validate()) {
      return;
    }

    submitContact.mutate({
      name: formData.name.trim(),
      email: formData.email.trim(),
      company: formData.company.trim(),
      message: formData.message.trim(),
      source_path:
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "/contact",
    });
  };

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-[#D9D4CB] bg-white shadow-[0_18px_70px_rgba(26,26,26,0.1)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(135deg,rgba(255,110,0,0.12),rgba(255,255,255,0)_62%)]" />
      <div className="relative p-6 sm:p-8">
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#F1D6BF] bg-[#FFF2E7] text-[#FF6E00] shadow-[0_8px_20px_rgba(255,110,0,0.08)]">
            <MessageSquareMore className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-[#D8D2C8] bg-white/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-[#9A6A45]"
              >
                Start the Conversation
              </Badge>
              <Badge className="bg-[#1A1A1A] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white">
                Demos to deployment
              </Badge>
            </div>
            <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.03em] text-[#1A1A1A]">
              Tell us what you are building.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#5F5A55]">
              A few lines of context is enough. We can take it from there.
            </p>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#E7DED2] bg-[#FCFBF8] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#9A6A45]">
              Best for
            </p>
            <p className="mt-2 text-sm font-medium text-[#1A1A1A]">
              Product teams evaluating Pillar
            </p>
          </div>
          <div className="rounded-2xl border border-[#E7DED2] bg-[#FCFBF8] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#9A6A45]">
              Useful details
            </p>
            <p className="mt-2 text-sm font-medium text-[#1A1A1A]">
              Product URL, use case, rollout timeline
            </p>
          </div>
          <div className="rounded-2xl border border-[#E7DED2] bg-[#FCFBF8] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#9A6A45]">
              Routed to
            </p>
            <p className="mt-2 text-sm font-medium text-[#1A1A1A]">
              founders@trypillar.com
            </p>
          </div>
        </div>

        {successMessage ? (
          <Alert variant="success" className="border-green-200 bg-green-50/70">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="text-sm text-green-800">
              {successMessage}
            </AlertDescription>
          </Alert>
        ) : null}

        {formError ? (
          <Alert variant="destructive" className="mt-4">
            <Mail className="h-4 w-4" />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact-name" className="text-[#1A1A1A]">
                Name
              </Label>
              <Input
                id="contact-name"
                value={formData.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Jane Doe"
                disabled={submitContact.isPending}
                aria-invalid={!!fieldErrors.name}
                className="h-12 rounded-xl border-[#D8D2C8] bg-[#FCFBF8] text-[#1A1A1A] placeholder:text-[#9B948C]"
              />
              {fieldErrors.name ? (
                <p className="text-sm text-[#C2410C]">{fieldErrors.name}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-email" className="text-[#1A1A1A]">
                Work Email
              </Label>
              <Input
                id="contact-email"
                type="email"
                value={formData.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="jane@company.com"
                disabled={submitContact.isPending}
                aria-invalid={!!fieldErrors.email}
                className="h-12 rounded-xl border-[#D8D2C8] bg-[#FCFBF8] text-[#1A1A1A] placeholder:text-[#9B948C]"
              />
              {fieldErrors.email ? (
                <p className="text-sm text-[#C2410C]">{fieldErrors.email}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-company" className="text-[#1A1A1A]">
              Company
            </Label>
            <Input
              id="contact-company"
              value={formData.company}
              onChange={(event) => updateField("company", event.target.value)}
              placeholder="Acme"
              disabled={submitContact.isPending}
              aria-invalid={!!fieldErrors.company}
              className="h-12 rounded-xl border-[#D8D2C8] bg-[#FCFBF8] text-[#1A1A1A] placeholder:text-[#9B948C]"
            />
            {fieldErrors.company ? (
              <p className="text-sm text-[#C2410C]">{fieldErrors.company}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-message" className="text-[#1A1A1A]">
              What can we help with?
            </Label>
            <Textarea
              id="contact-message"
              value={formData.message}
              onChange={(event) => updateField("message", event.target.value)}
              placeholder="We want Pillar embedded in our product so users can take action without leaving the app."
              disabled={submitContact.isPending}
              aria-invalid={!!fieldErrors.message}
              className="min-h-36 rounded-2xl border-[#D8D2C8] bg-[#FCFBF8] text-[#1A1A1A] placeholder:text-[#9B948C]"
            />
            {fieldErrors.message ? (
              <p className="text-sm text-[#C2410C]">{fieldErrors.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 rounded-[24px] border border-[#EEE7DD] bg-[#FBF8F3] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-[#1A1A1A]">
                <Sparkles className="h-4 w-4 text-[#FF6E00]" />
                Keep it short.
              </p>
              <p className="mt-1 text-sm leading-6 text-[#6C655E]">
                We just need enough context to know how to respond.
              </p>
            </div>
            <Button
              type="submit"
              disabled={submitContact.isPending}
              className="h-12 rounded-xl bg-[#1A1A1A] px-5 text-sm font-medium text-white hover:bg-[#2C2C2C]"
            >
              {submitContact.isPending ? <Spinner size="xs" /> : null}
              Send Message
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
