'use client';

import { Info, AlertTriangle, Lightbulb, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CalloutType = 'info' | 'warning' | 'tip' | 'error';

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const calloutConfig = {
  info: {
    icon: Info,
    styles: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
    iconStyles: 'text-blue-600 dark:text-blue-400',
    titleStyles: 'text-blue-900 dark:text-blue-100',
    textStyles: 'text-blue-800 dark:text-blue-200',
  },
  warning: {
    icon: AlertTriangle,
    styles: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
    iconStyles: 'text-amber-600 dark:text-amber-400',
    titleStyles: 'text-amber-900 dark:text-amber-100',
    textStyles: 'text-amber-800 dark:text-amber-200',
  },
  tip: {
    icon: Lightbulb,
    styles: 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800',
    iconStyles: 'text-green-600 dark:text-green-400',
    titleStyles: 'text-green-900 dark:text-green-100',
    textStyles: 'text-green-800 dark:text-green-200',
  },
  error: {
    icon: XCircle,
    styles: 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800',
    iconStyles: 'text-red-600 dark:text-red-400',
    titleStyles: 'text-red-900 dark:text-red-100',
    textStyles: 'text-red-800 dark:text-red-200',
  },
};

export function Callout({ 
  type = 'info', 
  title, 
  children, 
  className 
}: CalloutProps) {
  const config = calloutConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'rounded-lg border p-4 my-4',
        config.styles,
        className
      )}
      role="note"
      aria-label={title || `${type} callout`}
    >
      <div className="flex gap-3 items-center">
        <Icon 
          className={cn('h-5 w-5 shrink-0', config.iconStyles)} 
          aria-hidden="true" 
        />
        <div className="flex-1 min-w-0">
          {title && (
            <p className={cn('font-semibold mb-1', config.titleStyles)}>
              {title}
            </p>
          )}
          <div className={cn('text-sm [&>p]:m-0', config.textStyles)}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// Shorthand components for convenience
export function InfoCallout(props: Omit<CalloutProps, 'type'>) {
  return <Callout type="info" {...props} />;
}

export function WarningCallout(props: Omit<CalloutProps, 'type'>) {
  return <Callout type="warning" {...props} />;
}

export function TipCallout(props: Omit<CalloutProps, 'type'>) {
  return <Callout type="tip" {...props} />;
}

export function ErrorCallout(props: Omit<CalloutProps, 'type'>) {
  return <Callout type="error" {...props} />;
}


