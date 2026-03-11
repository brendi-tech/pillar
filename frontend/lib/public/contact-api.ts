import axios from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_PILLAR_API_URL || "http://localhost:8003";

const publicClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export interface ContactSubmissionPayload {
  name: string;
  email: string;
  company: string;
  message: string;
  source_path?: string;
}

export interface ContactSubmissionResponse {
  detail: string;
}

export class PublicApiValidationError extends Error {
  fieldErrors: Record<string, string[]>;

  constructor(message: string, fieldErrors: Record<string, string[]>) {
    super(message);
    this.name = "PublicApiValidationError";
    this.fieldErrors = fieldErrors;
  }

  getFieldError(field: string): string | undefined {
    return this.fieldErrors[field]?.[0];
  }
}

function toPublicApiError(error: unknown): never {
  if (!axios.isAxiosError(error)) {
    throw error;
  }

  const errorData = error.response?.data as Record<string, unknown> | undefined;
  if (errorData && typeof errorData === "object") {
    const nestedErrors =
      errorData.errors && typeof errorData.errors === "object"
        ? (errorData.errors as Record<string, unknown>)
        : null;

    if (typeof errorData.detail === "string") {
      throw new Error(errorData.detail);
    }

    const fieldErrors: Record<string, string[]> = {};
    let hasFieldErrors = false;

    for (const [key, value] of Object.entries(nestedErrors ?? errorData)) {
      if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
        fieldErrors[key] = value as string[];
        hasFieldErrors = true;
      }
    }

    if (hasFieldErrors) {
      throw new PublicApiValidationError(
        Object.values(fieldErrors).flat().join(", "),
        fieldErrors
      );
    }
  }

  throw new Error("Something went wrong. Please try again.");
}

export const contactAPI = {
  submit: async (
    payload: ContactSubmissionPayload
  ): Promise<ContactSubmissionResponse> => {
    try {
      const { data } = await publicClient.post<ContactSubmissionResponse>(
        "/api/public/contact/",
        payload
      );
      return data;
    } catch (error) {
      toPublicApiError(error);
    }
  },
};
