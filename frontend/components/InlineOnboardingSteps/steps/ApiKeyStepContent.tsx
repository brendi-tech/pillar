"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { productsAPI } from "@/lib/admin/v2/products-api";
import {
  domainToWebsiteUrl,
  extractCompanyDomain,
} from "@/lib/utils/email-domain";
import { useAuth } from "@/providers/AuthProvider";
import { useProduct } from "@/providers/ProductProvider";
import {
  productKeys,
  updateProductMutation,
} from "@/queries/v2/products.queries";

import type { SubdomainStatus } from "../InlineOnboardingSteps.types";

interface ApiKeyStepContentProps {
  onComplete: () => void;
}

export function ApiKeyStepContent({ onComplete }: ApiKeyStepContentProps) {
  const { user } = useAuth();
  const { currentProduct, refetchProducts } = useProduct();
  const queryClient = useQueryClient();

  const isDraft = !currentProduct?.subdomain;
  const [agentSlug, setAgentSlug] = useState(currentProduct?.subdomain || "");
  const [agentSlugStatus, setAgentSlugStatus] = useState<SubdomainStatus>(
    currentProduct?.subdomain ? "available" : "idle"
  );
  const [agentSlugError, setAgentSlugError] = useState<string | null>(null);
  const [agentSlugSuggestion, setAgentSlugSuggestion] = useState<
    string | null
  >(null);
  const hasUserEdited = useRef(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const hasAttemptedAutofill = useRef(false);

  useEffect(() => {
    if (currentProduct?.subdomain && !hasUserEdited.current) {
      setAgentSlug(currentProduct.subdomain);
      setAgentSlugStatus("available");
      setAgentSlugError(null);
    }
  }, [currentProduct?.subdomain]);

  useEffect(() => {
    if (!isDraft) return;
    if (hasAttemptedAutofill.current || hasUserEdited.current || agentSlug.trim()) return;
    if (!currentProduct) return;

    hasAttemptedAutofill.current = true;

    const slug = currentProduct.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (slug.length >= 3) {
      productsAPI
        .checkSubdomain(slug)
        .then((response) => {
          if (hasUserEdited.current) return;
          if (response.valid) {
            const key = response.available
              ? response.subdomain
              : response.suggestion || response.subdomain;
            setAgentSlug(key);
            setAgentSlugStatus(response.available ? "available" : "taken");
            setAgentSlugError(
              response.available ? null : "This agent slug is already taken"
            );
          }
        })
        .catch(() => {});
      return;
    }

    if (!user?.email) return;
    const companyDomain = extractCompanyDomain(user.email);
    if (companyDomain) {
      const suggestedUrl = domainToWebsiteUrl(companyDomain);
      productsAPI
        .suggestSubdomain(suggestedUrl)
        .then((response) => {
          if (!hasUserEdited.current) {
            setAgentSlug(response.suggestion);
            setAgentSlugStatus(response.available ? "available" : "taken");
            setAgentSlugError(
              response.available ? null : "This agent slug is already taken"
            );
          }
        })
        .catch(() => {});
    }
  }, [isDraft, user?.email, agentSlug, currentProduct]);

  const checkAvailability = useCallback(async (value: string) => {
    if (!value.trim()) {
      setAgentSlugStatus("idle");
      setAgentSlugError(null);
      setAgentSlugSuggestion(null);
      return;
    }
    setAgentSlugStatus("checking");
    setAgentSlugSuggestion(null);
    try {
      const response = await productsAPI.checkSubdomain(value.trim());
      if (!response.valid) {
        setAgentSlugStatus("invalid");
        setAgentSlugError(response.error || "Invalid format");
        setAgentSlugSuggestion(null);
      } else if (!response.available) {
        setAgentSlugStatus("taken");
        setAgentSlugError("This agent slug is already taken");
        setAgentSlugSuggestion(response.suggestion || null);
      } else {
        setAgentSlugStatus("available");
        setAgentSlugError(null);
        setAgentSlugSuggestion(null);
      }
      if (response.subdomain !== value.trim()) {
        setAgentSlug(response.subdomain);
      }
    } catch {
      setAgentSlugStatus("idle");
      setAgentSlugError("Failed to check availability");
    }
  }, []);

  const handleAgentSlugChange = (value: string) => {
    hasUserEdited.current = true;
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setAgentSlug(sanitized);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => checkAvailability(sanitized), 300);
  };

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const updateProduct = useMutation({
    ...updateProductMutation(),
    onSuccess: async () => {
      await refetchProducts();
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });

  const handleContinue = async () => {
    if (agentSlugStatus !== "available") return;

    if (isDraft && currentProduct?.id) {
      try {
        await updateProduct.mutateAsync({
          id: currentProduct.id,
          data: { subdomain: agentSlug.trim(), name: agentSlug.trim() },
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to save agent slug";
        toast.error("Something went wrong", { description: message });
        return;
      }
    }
    onComplete();
  };

  const isReady = agentSlugStatus === "available";

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="agent-slug" className="text-sm font-medium">
          Agent Slug
        </Label>
        <div className="relative">
          <Input
            id="agent-slug"
            value={agentSlug}
            onChange={(e) => handleAgentSlugChange(e.target.value)}
            placeholder="your-agent-slug"
            className="h-11 pr-10 font-mono"
            disabled={!isDraft}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {agentSlugStatus === "checking" && <Spinner size="sm" />}
            {agentSlugStatus === "available" && (
              <Check className="h-4 w-4 text-green-600" />
            )}
            {(agentSlugStatus === "taken" ||
              agentSlugStatus === "invalid") && (
              <X className="h-4 w-4 text-destructive" />
            )}
          </div>
        </div>
        {agentSlugError ? (
          <div className="space-y-1">
            <p className="text-xs text-destructive">{agentSlugError}</p>
            {agentSlugSuggestion && (
              <p className="text-xs text-muted-foreground">
                Try{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAgentSlug(agentSlugSuggestion);
                    setAgentSlugStatus("available");
                    setAgentSlugError(null);
                    setAgentSlugSuggestion(null);
                    hasUserEdited.current = true;
                  }}
                  className="font-medium text-primary hover:underline"
                >
                  {agentSlugSuggestion}
                </button>{" "}
                instead
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Used as <code className="bg-muted px-1 rounded">PILLAR_SLUG</code>{" "}
            and in the SDK provider.
          </p>
        )}
      </div>

      <Button
        size="lg"
        className="w-full h-11"
        disabled={!isReady || updateProduct.isPending}
        onClick={handleContinue}
      >
        {updateProduct.isPending ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Saving...
          </>
        ) : (
          <>
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}
