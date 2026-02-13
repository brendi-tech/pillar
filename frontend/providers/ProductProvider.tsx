"use client";

import { adminFetch } from "@/lib/admin/api-client";
import type { AdminProduct } from "@/types/admin";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthProvider";
import { useOrganization } from "./OrganizationProvider";

// ============================================================================
// Product Context
// ============================================================================

const CURRENT_PRODUCT_KEY = "pillar_current_product_id";
const CURRENT_ORG_KEY = "pillar_current_organization_id";

interface ProductContextValue {
  currentProductId: string | null;
  currentProduct: AdminProduct | null;
  availableProducts: AdminProduct[];
  /** Switch to a product - updates org if needed, invalidates queries, saves to server */
  switchProduct: (productId: string) => void;
  /** Low-level setter, use switchProduct() for user-initiated switches */
  setCurrentProductId: (id: string | null) => void;
  isLoading: boolean;
  /** Manually refetch products (useful after updates) */
  refetchProducts: () => Promise<void>;
}

const ProductContext = createContext<ProductContextValue | undefined>(
  undefined
);

/**
 * Hook to access product context.
 */
export function useProduct(): ProductContextValue {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error("useProduct must be used within a ProductProvider");
  }
  return context;
}

/**
 * Get current product ID from localStorage (for api-client)
 */
export function getCurrentProductId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CURRENT_PRODUCT_KEY);
}

// ============================================================================
// Product Provider
// ============================================================================

interface ProductProviderProps {
  children: ReactNode;
}

/**
 * Provider that manages the current product selection.
 *
 * On mount:
 * 1. Fetches ALL products across user's organizations
 * 2. Checks localStorage for stored product ID
 * 3. Validates it exists in available products
 * 4. Falls back to default product or first available
 *
 * When switching products:
 * 1. Updates product in localStorage
 * 2. Updates organization if product belongs to different org
 * 3. Invalidates all cached queries
 * 4. Saves preference to server (async)
 */
export function ProductProvider({ children }: ProductProviderProps) {
  const { user } = useAuth();
  const { currentOrganizationId, setCurrentOrganizationId } = useOrganization();
  const queryClient = useQueryClient();

  const [availableProducts, setAvailableProducts] = useState<AdminProduct[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [hasRestoredFromServer, setHasRestoredFromServer] = useState(false);

  const [currentProductId, setCurrentProductIdState] = useState<string | null>(
    () => {
      if (typeof window === "undefined") return null;
      return localStorage.getItem(CURRENT_PRODUCT_KEY);
    }
  );

  // Low-level setter - just updates state and localStorage
  const setCurrentProductId = useCallback((id: string | null) => {
    console.log("[ProductProvider] Setting product:", id);
    setCurrentProductIdState(id);

    if (typeof window !== "undefined") {
      if (id) {
        localStorage.setItem(CURRENT_PRODUCT_KEY, id);
      } else {
        localStorage.removeItem(CURRENT_PRODUCT_KEY);
      }
    }
  }, []);

  // High-level switch function - handles org sync, cache invalidation, and server persistence
  const switchProduct = useCallback(
    (productId: string) => {
      const product = availableProducts.find((p) => p.id === productId);
      if (!product) {
        console.warn("[ProductProvider] Product not found:", productId);
        return;
      }

      console.log(
        "[ProductProvider] Switching to product:",
        product.name,
        productId
      );

      // 1. Update product selection
      setCurrentProductId(productId);

      // 2. Update organization if different
      if (
        product.organization_id &&
        product.organization_id !== currentOrganizationId
      ) {
        console.log(
          "[ProductProvider] Switching organization to:",
          product.organization_id
        );
        setCurrentOrganizationId(product.organization_id);
        if (typeof window !== "undefined") {
          localStorage.setItem(CURRENT_ORG_KEY, product.organization_id);
        }
      }

      // 3. Invalidate all cached queries to force refetch with new context
      queryClient.resetQueries();
    },
    [
      availableProducts,
      currentOrganizationId,
      setCurrentProductId,
      setCurrentOrganizationId,
      queryClient,
    ]
  );

  // Fetch ALL products across user's organizations
  const refetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch products without filtering by organization
      // The backend filters by user's accessible organizations automatically
      // Use skipAutoContext to avoid adding org/product params that would filter results
      const response = await adminFetch<{
        results: AdminProduct[];
        count: number;
      }>("/configs/", {
        skipAutoContext: true,
      });
      console.log(
        "[ProductProvider] Fetched products:",
        response.results.length
      );
      setAvailableProducts(response.results);
    } catch (error) {
      console.error("[ProductProvider] Failed to fetch products:", error);
      setAvailableProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch products on mount
  useEffect(() => {
    refetchProducts();
  }, [refetchProducts]);

  // Restore product from server preference (only once, on initial load)
  useEffect(() => {
    if (
      hasRestoredFromServer ||
      isLoading ||
      availableProducts.length === 0 ||
      !user
    ) {
      return;
    }

    // If no product selected in localStorage but server has a preference, use it
    const localStorageProductId =
      typeof window !== "undefined"
        ? localStorage.getItem(CURRENT_PRODUCT_KEY)
        : null;

    if (!localStorageProductId && user.last_selected_product_id) {
      const serverProduct = availableProducts.find(
        (p) => p.id === user.last_selected_product_id
      );
      if (serverProduct) {
        console.log(
          "[ProductProvider] Restoring product from server preference:",
          user.last_selected_product_id
        );
        setCurrentProductId(user.last_selected_product_id);

        // Also sync organization
        if (
          serverProduct.organization_id &&
          serverProduct.organization_id !== currentOrganizationId
        ) {
          setCurrentOrganizationId(serverProduct.organization_id);
          if (typeof window !== "undefined") {
            localStorage.setItem(
              CURRENT_ORG_KEY,
              serverProduct.organization_id
            );
          }
        }
      }
    }

    setHasRestoredFromServer(true);
  }, [
    hasRestoredFromServer,
    isLoading,
    availableProducts,
    user,
    currentOrganizationId,
    setCurrentProductId,
    setCurrentOrganizationId,
  ]);

  // Auto-select product when available products change
  useEffect(() => {
    if (isLoading || availableProducts.length === 0) {
      return;
    }

    // If we have a stored product ID, validate it exists
    if (currentProductId) {
      const exists = availableProducts.some((p) => p.id === currentProductId);
      if (exists) {
        console.log(
          "[ProductProvider] Stored product is valid:",
          currentProductId
        );

        // Ensure organization matches the product's organization
        const product = availableProducts.find(
          (p) => p.id === currentProductId
        );
        if (
          product?.organization_id &&
          product.organization_id !== currentOrganizationId
        ) {
          console.log(
            "[ProductProvider] Syncing organization to product's org:",
            product.organization_id
          );
          setCurrentOrganizationId(product.organization_id);
          if (typeof window !== "undefined") {
            localStorage.setItem(CURRENT_ORG_KEY, product.organization_id);
          }
        }
        return;
      }
      console.log(
        "[ProductProvider] Stored product no longer accessible, will use default"
      );
    }

    // No valid stored product, use default or first available
    // Prefer a product from current organization if available
    const currentOrgProducts = availableProducts.filter(
      (p) => p.organization_id === currentOrganizationId
    );
    const productsToCheck =
      currentOrgProducts.length > 0 ? currentOrgProducts : availableProducts;

    const defaultProduct = productsToCheck.find((p) => p.is_default);
    if (defaultProduct) {
      console.log(
        "[ProductProvider] Setting default product:",
        defaultProduct.id
      );
      setCurrentProductId(defaultProduct.id);
      // Sync org if needed
      if (
        defaultProduct.organization_id &&
        defaultProduct.organization_id !== currentOrganizationId
      ) {
        setCurrentOrganizationId(defaultProduct.organization_id);
        if (typeof window !== "undefined") {
          localStorage.setItem(CURRENT_ORG_KEY, defaultProduct.organization_id);
        }
      }
    } else if (productsToCheck.length > 0) {
      console.log(
        "[ProductProvider] Setting first available product:",
        productsToCheck[0].id
      );
      setCurrentProductId(productsToCheck[0].id);
      // Sync org if needed
      if (
        productsToCheck[0].organization_id &&
        productsToCheck[0].organization_id !== currentOrganizationId
      ) {
        setCurrentOrganizationId(productsToCheck[0].organization_id);
        if (typeof window !== "undefined") {
          localStorage.setItem(
            CURRENT_ORG_KEY,
            productsToCheck[0].organization_id
          );
        }
      }
    }
  }, [
    isLoading,
    availableProducts,
    currentProductId,
    currentOrganizationId,
    setCurrentProductId,
    setCurrentOrganizationId,
  ]);

  const currentProduct = useMemo(() => {
    if (!currentProductId) return null;
    return availableProducts.find((p) => p.id === currentProductId) || null;
  }, [currentProductId, availableProducts]);

  const contextValue = useMemo(
    () => ({
      currentProductId,
      currentProduct,
      availableProducts,
      switchProduct,
      setCurrentProductId,
      isLoading,
      refetchProducts,
    }),
    [
      currentProductId,
      currentProduct,
      availableProducts,
      switchProduct,
      setCurrentProductId,
      isLoading,
      refetchProducts,
    ]
  );

  return (
    <ProductContext.Provider value={contextValue}>
      {children}
    </ProductContext.Provider>
  );
}
