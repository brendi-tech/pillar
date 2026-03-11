"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { CheckCircle2, Mail } from "lucide-react";
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
    <div className="rounded-[18px] border border-[#D9D4CB] bg-white p-6 shadow-[0_12px_40px_rgba(26,26,26,0.08)] sm:p-8">
      <div className="mb-8">
        <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-[#1A1A1A]">
          Get in touch!
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#5F5A55]">
          A few lines of context is enough.
        </p>
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
              className="h-12 rounded-md border-[#D8D2C8] bg-white text-[#1A1A1A] placeholder:text-[#9B948C]"
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
              className="h-12 rounded-md border-[#D8D2C8] bg-white text-[#1A1A1A] placeholder:text-[#9B948C]"
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
            className="h-12 rounded-md border-[#D8D2C8] bg-white text-[#1A1A1A] placeholder:text-[#9B948C]"
          />
          {fieldErrors.company ? (
            <p className="text-sm text-[#C2410C]">{fieldErrors.company}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-message" className="text-[#1A1A1A]">
            Message
          </Label>
          <Textarea
            id="contact-message"
            value={formData.message}
            onChange={(event) => updateField("message", event.target.value)}
            placeholder="We want Pillar embedded in our product so users can take action without leaving the app."
            disabled={submitContact.isPending}
            aria-invalid={!!fieldErrors.message}
            className="min-h-40 rounded-md border-[#D8D2C8] bg-white text-[#1A1A1A] placeholder:text-[#9B948C]"
          />
          {fieldErrors.message ? (
            <p className="text-sm text-[#C2410C]">{fieldErrors.message}</p>
          ) : null}
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={submitContact.isPending}
            className="h-11 rounded-md bg-[#1A1A1A] px-5 text-sm font-medium text-white hover:bg-[#2C2C2C]"
          >
            {submitContact.isPending ? <Spinner size="xs" /> : null}
            Send Message
          </Button>
        </div>
      </form>
    </div>
  );
}
