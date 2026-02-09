'use client';

import { ArrowRight, Link2, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface WelcomeBannerProps {
  userName?: string;
}

export function WelcomeBanner({ userName = 'there' }: WelcomeBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-orange-200/50 bg-gradient-to-br from-orange-50 via-amber-50/50 to-white dark:border-orange-800/30 dark:from-orange-950/30 dark:via-amber-950/20 dark:to-[var(--admin-surface)]">
      {/* Decorative background elements */}
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-orange-200/30 to-transparent blur-3xl dark:from-orange-600/10" />
      <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-gradient-to-tr from-amber-200/30 to-transparent blur-2xl dark:from-amber-600/10" />
      
      <button
        onClick={() => setIsDismissed(true)}
        className="absolute right-4 top-4 rounded-full p-1 text-[var(--hc-text-muted)] transition-colors hover:bg-orange-100 hover:text-[var(--hc-text)] dark:hover:bg-orange-900/30 admin-press"
      >
        <X className="h-4 w-4" />
      </button>
      
      <div className="relative px-6 py-6">
        <h2 
          className="text-xl text-[var(--hc-text)]"
          style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif' }}
        >
          Welcome to Pillar, {userName}! 
          <span className="ml-1 inline-block animate-[wave_2s_ease-in-out_infinite]">👋</span>
        </h2>
        <p className="mt-1 text-sm text-[var(--hc-text-muted)]">
          Here&apos;s how to get started with your knowledge base.
        </p>
        
        <div className="mt-5">
          <Link
            href="/knowledge"
            className="group flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-elevated)] p-4 transition-all duration-200 hover:border-violet-300 hover:shadow-md hover:shadow-violet-500/5 dark:hover:border-violet-700 admin-press"
          >
            <div className="rounded-xl bg-gradient-to-br from-violet-100 to-purple-50 p-2.5 shadow-sm dark:from-violet-900/40 dark:to-purple-900/20">
              <Link2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--hc-text)] group-hover:text-violet-600 dark:group-hover:text-violet-400">
                Import existing content
              </p>
              <p className="text-xs text-[var(--hc-text-muted)]">
                Connect Zendesk, Notion, or more
              </p>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 text-[var(--hc-text-muted)] opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
          </Link>
        </div>
      </div>
    </div>
  );
}


