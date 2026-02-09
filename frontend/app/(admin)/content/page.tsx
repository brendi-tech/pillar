'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

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
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

