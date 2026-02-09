import { usePillar } from '@pillar-ai/react';
import { useEffect } from 'react';

function ContextProvider() {
  const { setContext } = usePillar();

  useEffect(() => {
    setContext({
      currentPage: '/settings/billing',
      currentFeature: 'Billing Settings',
      userRole: 'admin',
      errorState: { code: 'PAYMENT_FAILED', message: 'Card declined' },
    });
  }, [setContext]);

  return null;
}
