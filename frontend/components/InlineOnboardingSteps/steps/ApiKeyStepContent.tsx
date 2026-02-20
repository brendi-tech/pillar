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
  const [productKey, setProductKey] = useState(currentProduct?.subdomain || "");
  const [productKeyStatus, setProductKeyStatus] = useState<SubdomainStatus>(
    currentProduct?.subdomain ? "available" : "idle"
  );
  const [productKeyError, setProductKeyError] = useState<string | null>(null);
  const [productKeySuggestion, setProductKeySuggestion] = useState<
    string | null
  >(null);
  const hasUserEdited = useRef(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const hasAttemptedAutofill = useRef(false);

  useEffect(() => {
    if (currentProduct?.subdomain && !hasUserEdited.current) {
      setProductKey(currentProduct.subdomain);
      setProductKeyStatus("available");
      setProductKeyError(null);
    }
  }, [currentProduct?.subdomain]);

  useEffect(() => {
    if (!isDraft) return;
    if (
      hasAttemptedAutofill.current ||
      hasUserEdited.current ||
      productKey.trim()
    )
      return;
    hasAttemptedAutofill.current = true;
    if (!user?.email) return;

    const companyDomain = extractCompanyDomain(user.email);
    if (companyDomain) {
      const suggestedUrl = domainToWebsiteUrl(companyDomain);
      productsAPI
        .suggestSubdomain(suggestedUrl)
        .then((response) => {
          if (!hasUserEdited.current) {
            setProductKey(response.suggestion);
            setProductKeyStatus(response.available ? "available" : "taken");
            setProductKeyError(
              response.available ? null : "This product key is already taken"
            );
          }
        })
        .catch(() => {});
    }
  }, [isDraft, user?.email, productKey]);

  const checkAvailability = useCallback(async (value: string) => {
    if (!value.trim()) {
      setProductKeyStatus("idle");
      setProductKeyError(null);
      setProductKeySuggestion(null);
      return;
    }
    setProductKeyStatus("checking");
    setProductKeySuggestion(null);
    try {
      const response = await productsAPI.checkSubdomain(value.trim());
      if (!response.valid) {
        setProductKeyStatus("invalid");
        setProductKeyError(response.error || "Invalid format");
        setProductKeySuggestion(null);
      } else if (!response.available) {
        setProductKeyStatus("taken");
        setProductKeyError("This product key is already taken");
        setProductKeySuggestion(response.suggestion || null);
      } else {
        setProductKeyStatus("available");
        setProductKeyError(null);
        setProductKeySuggestion(null);
      }
      if (response.subdomain !== value.trim()) {
        setProductKey(response.subdomain);
      }
    } catch {
      setProductKeyStatus("idle");
      setProductKeyError("Failed to check availability");
    }
  }, []);

  const handleProductKeyChange = (value: string) => {
    hasUserEdited.current = true;
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setProductKey(sanitized);
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
    if (productKeyStatus !== "available") return;

    if (isDraft && currentProduct?.id) {
      try {
        await updateProduct.mutateAsync({
          id: currentProduct.id,
          data: { subdomain: productKey.trim(), name: productKey.trim() },
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to save product key";
        toast.error("Something went wrong", { description: message });
        return;
      }
    }
    onComplete();
  };

  const isReady = productKeyStatus === "available";

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="product-key" className="text-sm font-medium">
          Product Key
        </Label>
        <div className="relative">
          <Input
            id="product-key"
            value={productKey}
            onChange={(e) => handleProductKeyChange(e.target.value)}
            placeholder="your-product"
            className="h-11 pr-10 font-mono"
            disabled={!isDraft}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {productKeyStatus === "checking" && <Spinner size="sm" />}
            {productKeyStatus === "available" && (
              <Check className="h-4 w-4 text-green-600" />
            )}
            {(productKeyStatus === "taken" ||
              productKeyStatus === "invalid") && (
              <X className="h-4 w-4 text-destructive" />
            )}
          </div>
        </div>
        {productKeyError ? (
          <div className="space-y-1">
            <p className="text-xs text-destructive">{productKeyError}</p>
            {productKeySuggestion && (
              <p className="text-xs text-muted-foreground">
                Try{" "}
                <button
                  type="button"
                  onClick={() => {
                    setProductKey(productKeySuggestion);
                    setProductKeyStatus("available");
                    setProductKeyError(null);
                    setProductKeySuggestion(null);
                    hasUserEdited.current = true;
                  }}
                  className="font-medium text-primary hover:underline"
                >
                  {productKeySuggestion}
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
