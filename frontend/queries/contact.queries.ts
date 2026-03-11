import { contactAPI } from "@/lib/public/contact-api";

export const contactKeys = {
  all: ["contact"] as const,
};

export const createContactSubmissionMutation = () => ({
  mutationFn: contactAPI.submit,
});
