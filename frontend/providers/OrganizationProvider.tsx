'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import type { AdminOrganization } from '@/types/admin';

// ============================================================================
// Organization Context
// ============================================================================

const CURRENT_ORG_KEY = 'pillar_current_organization_id';

interface OrganizationContextValue {
  currentOrganizationId: string | null;
  currentOrganization: AdminOrganization | null;
  availableOrganizations: AdminOrganization[];
  setCurrentOrganizationId: (orgId: string | null) => void;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

/**
 * Hook to access organization context.
 */
export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

// ============================================================================
// Organization Provider
// ============================================================================

interface OrganizationProviderProps {
  children: ReactNode;
}

/**
 * Provider that manages the current organization selection.
 *
 * On mount:
 * 1. Checks localStorage for stored organization ID
 * 2. Validates it exists in user's organizations
 * 3. Falls back to primary_organization_id or first available org
 */
export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const { user } = useAuth();

  const [currentOrganizationId, setCurrentOrganizationIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(CURRENT_ORG_KEY);
  });

  const availableOrganizations = useMemo(() => user?.organizations || [], [user?.organizations]);

  const setCurrentOrganizationId = useCallback((orgId: string | null) => {
    console.log('[OrganizationProvider] Setting organization:', orgId);
    setCurrentOrganizationIdState(orgId);

    if (typeof window !== 'undefined') {
      if (orgId) {
        localStorage.setItem(CURRENT_ORG_KEY, orgId);
      } else {
        localStorage.removeItem(CURRENT_ORG_KEY);
      }
    }
  }, []);

  // Auto-select organization on mount or when user changes
  useEffect(() => {
    // Clear org if user logs out
    if (!user) {
      console.log('[OrganizationProvider] User logged out, clearing organization');
      setCurrentOrganizationId(null);
      return;
    }

    // Wait for organizations to load
    if (availableOrganizations.length === 0) {
      console.log('[OrganizationProvider] Waiting for organizations to load...');
      return;
    }

    // If we have a stored org ID, validate it exists in user's organizations
    if (currentOrganizationId) {
      const orgExists = availableOrganizations.some(
        (org) => org.id === currentOrganizationId
      );
      if (orgExists) {
        console.log(
          '[OrganizationProvider] Stored organization is valid, keeping selection:',
          currentOrganizationId
        );
        return;
      }
      console.log(
        '[OrganizationProvider] Stored organization no longer accessible, will use default'
      );
    }

    // No valid stored org, use primary or first available
    if (
      user.primary_organization_id &&
      availableOrganizations.some((org) => org.id === user.primary_organization_id)
    ) {
      console.log(
        '[OrganizationProvider] Setting primary organization:',
        user.primary_organization_id
      );
      setCurrentOrganizationId(user.primary_organization_id);
    } else if (availableOrganizations.length > 0) {
      console.log(
        '[OrganizationProvider] Setting first available organization:',
        availableOrganizations[0].id
      );
      setCurrentOrganizationId(availableOrganizations[0].id);
    }
  }, [user, currentOrganizationId, setCurrentOrganizationId, availableOrganizations]);

  const currentOrganization = useMemo(() => {
    if (!currentOrganizationId) return null;
    return availableOrganizations.find((org) => org.id === currentOrganizationId) || null;
  }, [currentOrganizationId, availableOrganizations]);

  const contextValue = useMemo(
    () => ({
      currentOrganizationId,
      currentOrganization,
      availableOrganizations,
      setCurrentOrganizationId,
    }),
    [currentOrganizationId, currentOrganization, availableOrganizations, setCurrentOrganizationId]
  );

  return (
    <OrganizationContext.Provider value={contextValue}>
      {children}
    </OrganizationContext.Provider>
  );
}
