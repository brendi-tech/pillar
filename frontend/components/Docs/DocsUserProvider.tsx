'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { apiClient, getStoredAccessToken } from '@/lib/admin/api-client';

interface DocsUserState {
  slug: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const DocsUserContext = createContext<DocsUserState>({
  slug: null,
  isAuthenticated: false,
  isLoading: true,
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
  const [state, setState] = useState<DocsUserState>({
    slug: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      setState({ slug: null, isAuthenticated: false, isLoading: false });
      return;
    }

    let cancelled = false;

    apiClient
      .get('/api/admin/configs/', { params: { page_size: 1 } })
      .then((response) => {
        if (cancelled) return;
        const products = response.data?.results;
        if (products?.length > 0) {
          setState({
            slug: products[0].subdomain || null,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          setState({ slug: null, isAuthenticated: true, isLoading: false });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setState({ slug: null, isAuthenticated: false, isLoading: false });
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <DocsUserContext.Provider value={state}>
      {children}
    </DocsUserContext.Provider>
  );
}
