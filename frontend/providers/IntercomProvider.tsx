'use client';

import { useEffect } from 'react';
import Intercom from '@intercom/messenger-js-sdk';
import { useAuth } from './AuthProvider';

export function IntercomProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    // Only on admin subdomain
    const hostname = window.location.hostname;
    const isAdmin = hostname === 'admin.localhost' || 
                    hostname.startsWith('admin.') || 
                    hostname === 'admin';
    
    if (!isAdmin) return;

    if (isAuthenticated && user) {
      Intercom({
        app_id: 'eq73zptj',
        user_id: user.id,
        name: user.name,
        email: user.email,
        alignment: 'right',
        hide_default_launcher: true, // Only show via "Support" tab
      });
    } else {
      // Boot for anonymous visitors (login/signup pages)
      Intercom({ 
        app_id: 'eq73zptj', 
        alignment: 'right',
        hide_default_launcher: true, // Only show via "Support" tab
      });
    }
  }, [user, isAuthenticated]);

  return <>{children}</>;
}
