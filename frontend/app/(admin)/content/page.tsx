'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';

/**
 * Content page - redirects to /knowledge.
 * 
 * The /content route is referenced in navigation and middleware,
 * but content management is now integrated into the knowledge page.
 * This page provides a seamless redirect.
 */
export default function ContentPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/knowledge');
  }, [router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

