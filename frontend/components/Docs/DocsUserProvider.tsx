'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient, getStoredAccessToken } from '@/lib/admin/api-client';

const DOCS_SELECTED_PRODUCT_KEY = 'pillar_docs_selected_product';

export interface DocsProduct {
  id: string;
  name: string;
  subdomain: string;
  organization_id?: string;
  organization_name?: string;
}

interface DocsUserState {
  slug: string | null;
  products: DocsProduct[];
  selectedProductId: string | null;
  setSelectedProduct: (id: string) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  refetch: () => void;
}

const DocsUserContext = createContext<DocsUserState>({
  slug: null,
  products: [],
  selectedProductId: null,
  setSelectedProduct: () => {},
  isAuthenticated: false,
  isLoading: true,
  refetch: () => {},
});

export function useDocsUser() {
  return useContext(DocsUserContext);
}

const SLUG_PLACEHOLDERS = [
  'your-product-key',
  'your-product-slug',
  'your-help-center-slug',
];

export function replaceSlugPlaceholders(code: string, slug: string | null): string {
  if (!slug) return code;
  let result = code;
  for (const placeholder of SLUG_PLACEHOLDERS) {
    result = result.replaceAll(placeholder, slug);
  }
  return result;
}

interface DocsUserProviderProps {
  children: React.ReactNode;
}

export function DocsUserProvider({ children }: DocsUserProviderProps) {
  const [products, setProducts] = useState<DocsProduct[]>([]);
  const [selectedProductId, setSelectedProductIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(DOCS_SELECTED_PRODUCT_KEY);
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      setProducts([]);
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    apiClient
      .get('/api/admin/configs/')
      .then((response) => {
        if (cancelled) return;
        const results = response.data?.results;
        if (results?.length > 0) {
          const mapped: DocsProduct[] = results.map((p: Record<string, unknown>) => ({
            id: p.id as string,
            name: (p.name as string) || (p.subdomain as string) || '',
            subdomain: (p.subdomain as string) || '',
            organization_id: p.organization_id as string | undefined,
            organization_name: p.organization_name as string | undefined,
          }));
          setProducts(mapped);

          const storedId = typeof window !== 'undefined'
            ? localStorage.getItem(DOCS_SELECTED_PRODUCT_KEY)
            : null;
          const storedExists = storedId && mapped.some((p) => p.id === storedId);
          if (!storedExists) {
            setSelectedProductIdState(mapped[0].id);
            if (typeof window !== 'undefined') {
              localStorage.setItem(DOCS_SELECTED_PRODUCT_KEY, mapped[0].id);
            }
          }
        } else {
          setProducts([]);
        }
        setIsAuthenticated(true);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setProducts([]);
        setIsAuthenticated(false);
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [fetchKey]);

  const setSelectedProduct = useCallback((id: string) => {
    setSelectedProductIdState(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(DOCS_SELECTED_PRODUCT_KEY, id);
    }
  }, []);

  const slug = useMemo(() => {
    if (products.length === 0) return null;
    const selected = products.find((p) => p.id === selectedProductId);
    return selected?.subdomain || products[0]?.subdomain || null;
  }, [products, selectedProductId]);

  const value = useMemo<DocsUserState>(
    () => ({
      slug,
      products,
      selectedProductId,
      setSelectedProduct,
      isAuthenticated,
      isLoading,
      refetch,
    }),
    [slug, products, selectedProductId, setSelectedProduct, isAuthenticated, isLoading, refetch],
  );

  return (
    <DocsUserContext.Provider value={value}>
      {children}
    </DocsUserContext.Provider>
  );
}
