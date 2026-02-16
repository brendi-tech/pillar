"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Globe,
  Loader2,
  LogOut,
  Mail,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { productsAPI } from "@/lib/admin/v2/products-api";
import { extractCompanyDomain, domainToWebsiteUrl } from "@/lib/utils/email-domain";
import { useAuth } from "@/providers/AuthProvider";
import { useProduct } from "@/providers/ProductProvider";
import {
  createKnowledgeSourceMutation,
  knowledgeSourceKeys,
  triggerKnowledgeSourceSyncMutation,
} from "@/queries/sources.queries";
import {
  createProductMutation,
  productKeys,
  updateProductMutation,
} from "@/queries/v2/products.queries";
import type { CrawlConfig } from "@/types/sources";

// =============================================================================
// Types
// =============================================================================

interface WebsiteCrawlOnboardingProps {
  /** Custom redirect path after completion (defaults to /knowledge) */
  redirectTo?: string;
  /** Callback when step is complete (used when embedded in OnboardingSteps) */
  onComplete?: () => void;
  /** Whether this is creating a new product (vs updating existing) */
  isNewProduct?: boolean;
}

type SubdomainStatus = "idle" | "checking" | "available" | "taken" | "invalid";

// =============================================================================
// Component
// =============================================================================

export function WebsiteCrawlOnboarding({
  redirectTo = "/knowledge",
  onComplete,
  isNewProduct = false,
}: WebsiteCrawlOnboardingProps) {
  // When onComplete is provided, we're embedded in a parent stepper
  const isEmbedded = !!onComplete;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentProductId, setCurrentProductId, refetchProducts } = useProduct();

  // Form state
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [subdomainStatus, setSubdomainStatus] = useState<SubdomainStatus>("idle");
  const [subdomainError, setSubdomainError] = useState<string | null>(null);
  const [subdomainSuggestion, setSubdomainSuggestion] = useState<string | null>(null);
  const [maxPages, setMaxPages] = useState<number>(1000);
  const [includePaths, setIncludePaths] = useState("");
  const [excludePaths, setExcludePaths] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  
  // Track if URL was auto-filled from email (for UI hint)
  const [wasAutoFilledFromEmail, setWasAutoFilledFromEmail] = useState(false);

  // Track if we've auto-suggested (to not overwrite user edits)
  const hasUserEditedSubdomain = useRef(false);
  const hasUserEditedUrl = useRef(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const urlDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  const hasAttemptedEmailAutofill = useRef(false);

  // Derive name from URL if not set (safely handle partial URLs)
  const getHostname = (urlString: string): string => {
    // Try to extract hostname from various formats
    const trimmed = urlString.trim();
    // Add protocol if missing so URL parsing works
    const withProtocol = trimmed.match(/^https?:\/\//) ? trimmed : `https://${trimmed}`;
    try {
      return new URL(withProtocol).hostname;
    } catch {
      // Fallback: just return the trimmed value up to first slash
      return trimmed.split('/')[0];
    }
  };
  const derivedName = name || getHostname(url);

  // Auto-fill URL and subdomain from user's email domain on mount (if not a generic email)
  useEffect(() => {
    // Only attempt once, and only if URL is empty and user hasn't edited it
    if (hasAttemptedEmailAutofill.current || hasUserEditedUrl.current || url.trim()) {
      return;
    }
    hasAttemptedEmailAutofill.current = true;

    if (!user?.email) return;

    const companyDomain = extractCompanyDomain(user.email);
    if (companyDomain) {
      const suggestedUrl = domainToWebsiteUrl(companyDomain);
      setUrl(suggestedUrl);
      setWasAutoFilledFromEmail(true);
      
      // Directly fetch subdomain suggestion (don't rely on separate effect)
      productsAPI.suggestSubdomain(suggestedUrl).then((response) => {
        if (!hasUserEditedSubdomain.current) {
          setSubdomain(response.suggestion);
          setSubdomainStatus(response.available ? "available" : "taken");
          setSubdomainError(response.available ? null : "This subdomain is already taken");
        }
      }).catch((error) => {
        console.warn("Failed to suggest subdomain from email domain:", error);
      });
    }
  }, [user?.email, url]);

  // Auto-suggest subdomain when URL changes (debounced)
  useEffect(() => {
    // Clear previous timer
    if (urlDebounceTimer.current) {
      clearTimeout(urlDebounceTimer.current);
    }

    // Don't suggest if user has edited subdomain or URL is empty
    if (!url.trim() || hasUserEditedSubdomain.current) return;

    // Debounce the API call - wait 500ms after user stops typing
    urlDebounceTimer.current = setTimeout(async () => {
      // Only suggest for valid URLs
      try {
        new URL(url.trim());
      } catch {
        return;
      }

      try {
        const response = await productsAPI.suggestSubdomain(url.trim());
        if (!hasUserEditedSubdomain.current) {
          setSubdomain(response.suggestion);
          setSubdomainStatus(response.available ? "available" : "taken");
          setSubdomainError(response.available ? null : "This subdomain is already taken");
          setSubdomainSuggestion(null); // Clear any previous suggestion
        }
      } catch (error) {
        console.warn("Failed to suggest subdomain:", error);
      }
    }, 500);
  }, [url]);

  // Check subdomain availability with debounce
  const checkSubdomainAvailability = useCallback(async (value: string) => {
    if (!value.trim()) {
      setSubdomainStatus("idle");
      setSubdomainError(null);
      setSubdomainSuggestion(null);
      return;
    }

    setSubdomainStatus("checking");
    setSubdomainSuggestion(null);

    try {
      const response = await productsAPI.checkSubdomain(value.trim());

      if (!response.valid) {
        setSubdomainStatus("invalid");
        setSubdomainError(response.error || "Invalid subdomain format");
        setSubdomainSuggestion(null);
      } else if (!response.available) {
        setSubdomainStatus("taken");
        setSubdomainError("This subdomain is already taken");
        // Store the suggestion for display
        setSubdomainSuggestion(response.suggestion || null);
      } else {
        setSubdomainStatus("available");
        setSubdomainError(null);
        setSubdomainSuggestion(null);
      }

      // Update with sanitized value if different
      if (response.subdomain !== value.trim()) {
        setSubdomain(response.subdomain);
      }
    } catch (error) {
      console.error("Failed to check subdomain:", error);
      setSubdomainStatus("idle");
      setSubdomainError("Failed to check availability");
      setSubdomainSuggestion(null);
    }
  }, []);

  // Handle subdomain input change with debounce
  const handleSubdomainChange = (value: string) => {
    hasUserEditedSubdomain.current = true;
    setSubdomain(value.toLowerCase().replace(/[^a-z0-9-]/g, ""));

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Debounce the API call
    debounceTimer.current = setTimeout(() => {
      checkSubdomainAvailability(value);
    }, 300);
  };

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (urlDebounceTimer.current) {
        clearTimeout(urlDebounceTimer.current);
      }
    };
  }, []);

  // Mutations
  const createSource = useMutation({
    ...createKnowledgeSourceMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeSourceKeys.lists() });
    },
  });

  const triggerSync = useMutation({
    ...triggerKnowledgeSourceSyncMutation(),
  });

  const updateProduct = useMutation({
    ...updateProductMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });

  const createProduct = useMutation({
    ...createProductMutation(),
    onSuccess: (newProduct) => {
      // Switch to the new product immediately (don't refetch here - it causes re-renders)
      setCurrentProductId(newProduct.id);
    },
  });

  // Validation
  const isValidUrl = (urlString: string) => {
    const trimmed = urlString.trim();
    // Must have at least one dot (e.g., example.com)
    return trimmed.includes('.');
  };

  const isValid =
    url.trim() !== "" &&
    isValidUrl(url.trim()) &&
    subdomain.trim() !== "" &&
    subdomainStatus === "available";
  const isSubmitting =
    createSource.isPending ||
    triggerSync.isPending ||
    updateProduct.isPending ||
    createProduct.isPending;

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) return;

    const crawlConfig: CrawlConfig = {
      max_pages: maxPages,
      include_paths: includePaths
        ? includePaths
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
        : undefined,
      exclude_paths: excludePaths
        ? excludePaths
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
        : undefined,
    };

    try {
      if (isNewProduct) {
        // CREATE new product
        const newProduct = await createProduct.mutateAsync({
          name: derivedName || "My Product",
          subdomain: subdomain.trim(),
          website_url: url.trim(),
        });
        // The onSuccess handler already switches to the new product
        // Wait a bit for the context to update before creating the source
        await new Promise((resolve) => setTimeout(resolve, 100));
      } else if (currentProductId) {
        // UPDATE existing product subdomain and website URL
        await updateProduct.mutateAsync({
          id: currentProductId,
          data: {
            subdomain: subdomain.trim(),
            website_url: url.trim(),
          },
        });
      }

      // Create the knowledge source (uses current product from context)
      const newSource = await createSource.mutateAsync({
        source_type: "website_crawl",
        name: derivedName || "My Website",
        url: url.trim(),
        crawl_config: crawlConfig,
      });

      // Trigger the crawl
      try {
        await triggerSync.mutateAsync({ id: newSource.id });
      } catch (syncErr) {
        console.warn("Failed to trigger initial sync:", syncErr);
        // Don't fail the whole flow if sync trigger fails
      }

      toast.success("Crawl started!", {
        description: `We're crawling ${derivedName || url}. This may take a few minutes.`,
      });

      // Call onComplete if embedded, otherwise redirect
      if (onComplete) {
        onComplete();
      } else {
        router.push(redirectTo);
      }

      // Refresh products AFTER navigation to avoid re-renders that reset step state
      await refetchProducts();
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create source";
      toast.error("Something went wrong", { description: message });
    }
  };

  // The form card content - shared between embedded and standalone modes
  const formCard = (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Website Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* URL Field */}
          <div className="space-y-2">
            <Label htmlFor="url" className="text-sm font-medium">
              Website URL
            </Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => {
                hasUserEditedUrl.current = true;
                setWasAutoFilledFromEmail(false);
                setUrl(e.target.value);
              }}
              placeholder="https://docs.example.com"
              className="h-11"
              autoFocus
            />
            {wasAutoFilledFromEmail ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                Detected from your email — feel free to change it
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Enter your docs site, marketing site, or knowledge base URL
              </p>
            )}
          </div>

          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Display Name{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={derivedName || "My Docs"}
              className="h-11"
            />
          </div>

          {/* Subdomain Field */}
          <div className="space-y-2">
            <Label htmlFor="subdomain" className="text-sm font-medium">
              Pillar Subdomain
            </Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  id="subdomain"
                  value={subdomain}
                  onChange={(e) => handleSubdomainChange(e.target.value)}
                  placeholder="your-company"
                  className="h-11 pr-10"
                />
                {/* Status indicator */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {subdomainStatus === "checking" && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {subdomainStatus === "available" && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                  {(subdomainStatus === "taken" || subdomainStatus === "invalid") && (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                .trypillar.com
              </span>
            </div>
            {subdomainError ? (
              <div className="space-y-1">
                <p className="text-xs text-destructive">{subdomainError}</p>
                {subdomainSuggestion && (
                  <p className="text-xs text-muted-foreground">
                    Try{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setSubdomain(subdomainSuggestion);
                        setSubdomainStatus("available");
                        setSubdomainError(null);
                        setSubdomainSuggestion(null);
                        hasUserEditedSubdomain.current = true;
                      }}
                      className="font-medium text-primary hover:underline"
                    >
                      {subdomainSuggestion}
                    </button>{" "}
                    instead
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                This will be your Pillar subdomain
              </p>
            )}
          </div>

          {/* Advanced Settings */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 px-0 text-muted-foreground hover:text-foreground -ml-1"
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    advancedOpen ? "rotate-180" : ""
                  }`}
                />
                Advanced Settings
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="maxPages">Max Pages</Label>
                <Input
                  id="maxPages"
                  type="number"
                  min={1}
                  max={10000}
                  value={maxPages}
                  onChange={(e) =>
                    setMaxPages(parseInt(e.target.value) || 1000)
                  }
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of pages to crawl. Default is 1000.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="includePaths">Include Paths</Label>
                <Input
                  id="includePaths"
                  value={includePaths}
                  onChange={(e) => setIncludePaths(e.target.value)}
                  placeholder="/docs, /help, /guides"
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground">
                  Only crawl pages under these paths (comma-separated)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="excludePaths">Exclude Paths</Label>
                <Input
                  id="excludePaths"
                  value={excludePaths}
                  onChange={(e) => setExcludePaths(e.target.value)}
                  placeholder="/blog, /changelog"
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground">
                  Skip pages under these paths (comma-separated)
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            className="w-full h-12 text-base font-medium"
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Starting Crawl...
              </>
            ) : (
              <>
                {isEmbedded ? "Continue" : "Start Crawling"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  // When embedded in OnboardingSteps, just return the card
  if (isEmbedded) {
    return formCard;
  }

  // Standalone mode - full page layout
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4 relative">
      {/* Logout Button */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        onClick={() => router.push("/logout")}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Logout
      </Button>

      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Add Your Knowledge Source
          </h1>
          <p className="text-muted-foreground text-lg">
            We&apos;ll crawl your website to give the AI context about your
            product.
          </p>
        </div>

        {formCard}

        {/* Footer note */}
        <p className="text-center text-sm text-muted-foreground">
          The crawl typically takes 2-5 minutes depending on site size.
          <br />
          You can continue setting up while we work.
        </p>
      </div>
    </div>
  );
}
