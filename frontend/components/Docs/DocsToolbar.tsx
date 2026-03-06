"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, Copy, LogIn } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { DocsLoginModal } from "./DocsLoginModal";
import { useDocsPreferences, type Framework } from "./DocsPreferencesProvider";
import { useDocsPreferencesDialog } from "./DocsLayoutClient";
import { useDocsUser, type DocsProduct } from "./DocsUserProvider";

const FRAMEWORK_SHORT: Record<Framework, string> = {
  React: "React",
  Vue: "Vue",
  Angular: "Angular",
  "Vanilla JS": "JS",
};

export function DocsToolbar() {
  const [copied, setCopied] = useState(false);
  const { framework } = useDocsPreferences();
  const openPreferences = useDocsPreferencesDialog();
  const {
    products,
    selectedProductId,
    setSelectedProduct,
    isAuthenticated,
    isLoading,
    slug,
  } = useDocsUser();
  const [loginOpen, setLoginOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const getPageMarkdown = useCallback(() => {
    const article = document.querySelector("article.prose");
    if (!article) return "";
    const h1 = article.querySelector("h1");
    const title =
      h1?.textContent || document.title.replace(" | Pillar Docs", "");
    const content =
      (article as HTMLElement).innerText || article.textContent || "";
    return `# ${title}\n\n${content}`;
  }, []);

  const handleCopyForLLM = async () => {
    const text = getPageMarkdown();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleViewAsMD = () => {
    const text = getPageMarkdown();
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const productsByOrg = useMemo(() => {
    const groups: Record<string, { orgName: string; products: DocsProduct[] }> =
      {};
    for (const product of products) {
      const key = product.organization_id || "_default";
      if (!groups[key]) {
        groups[key] = {
          orgName: product.organization_name || "Products",
          products: [],
        };
      }
      groups[key].products.push(product);
    }
    return Object.values(groups);
  }, [products]);

  const hasMultipleOrgs = productsByOrg.length > 1;

  return (
    <>
      <div className="flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
        <div className="flex items-center gap-1 flex-wrap">
          <ToolbarButton
            icon={
              copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )
            }
            onClick={handleCopyForLLM}
          >
            {copied ? "Copied!" : "Copy for LLM"}
          </ToolbarButton>
          <ToolbarButton
            icon={
              <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                className="h-3.5 w-3.5"
              >
                <path d="M2 3h12v1.5H2zm0 4h8v1.5H2zm0 4h10v1.5H2z" />
              </svg>
            }
            onClick={handleViewAsMD}
          >
            View as MD
          </ToolbarButton>
        </div>

        <div className="flex items-center gap-1.5">
          {!isLoading && <ProductSection
            isAuthenticated={isAuthenticated}
            products={products}
            selectedProductId={selectedProductId}
            slug={slug}
            productsByOrg={productsByOrg}
            hasMultipleOrgs={hasMultipleOrgs}
            pickerOpen={pickerOpen}
            setPickerOpen={setPickerOpen}
            setSelectedProduct={setSelectedProduct}
            onSignIn={() => setLoginOpen(true)}
          />}

          <button
            onClick={openPreferences}
            className="flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors shrink-0"
          >
            {FRAMEWORK_SHORT[framework]}
            <ChevronDown />
          </button>
        </div>
      </div>

      <DocsLoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}

function ProductSection({
  isAuthenticated,
  products,
  selectedProductId,
  slug,
  productsByOrg,
  hasMultipleOrgs,
  pickerOpen,
  setPickerOpen,
  setSelectedProduct,
  onSignIn,
}: {
  isAuthenticated: boolean;
  products: DocsProduct[];
  selectedProductId: string | null;
  slug: string | null;
  productsByOrg: { orgName: string; products: DocsProduct[] }[];
  hasMultipleOrgs: boolean;
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
  setSelectedProduct: (id: string) => void;
  onSignIn: () => void;
}) {
  if (!isAuthenticated) {
    return (
      <button
        onClick={onSignIn}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted/50 transition-colors shrink-0"
      >
        <LogIn className="h-3 w-3" />
        <span className="hidden sm:inline">Sign in to personalize</span>
        <span className="sm:hidden">Sign in</span>
      </button>
    );
  }

  if (products.length === 0 || !slug) return null;

  if (products.length === 1) {
    return (
      <div className="flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground shrink-0">
        <KeyIcon />
        <span className="font-mono">{slug}</span>
      </div>
    );
  }

  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors shrink-0">
          <KeyIcon />
          <span className="font-mono">{slug}</span>
          <ChevronDown />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1">
        {productsByOrg.map((group) => (
          <div key={group.orgName}>
            {hasMultipleOrgs && (
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.orgName}
              </div>
            )}
            {group.products.map((product) => (
              <button
                key={product.id}
                onClick={() => {
                  setSelectedProduct(product.id);
                  setPickerOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  product.id === selectedProductId
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <span className="flex-1 text-left truncate">
                  {product.name}
                </span>
                <span
                  className={cn(
                    "font-mono text-[11px]",
                    product.id === selectedProductId
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  )}
                >
                  {product.subdomain}
                </span>
              </button>
            ))}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function ToolbarButton({
  icon,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md",
        "text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </button>
  );
}

function ChevronDown() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className="h-3 w-3 opacity-50"
    >
      <path d="M4 6l4 4 4-4z" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className="h-3 w-3 opacity-40"
    >
      <path d="M10.5 1a4.5 4.5 0 0 0-4.37 5.57L2 10.7V14h3.3l.13-.13v-1.37h1.37v-1.37h1.37l1.26-1.26A4.5 4.5 0 1 0 10.5 1zm1 3a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
    </svg>
  );
}
