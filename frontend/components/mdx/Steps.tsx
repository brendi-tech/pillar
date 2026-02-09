'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import React from 'react';

interface Step {
  title: string;
  content: React.ReactNode;
}

interface StepsProps {
  steps?: Step[];
  children?: React.ReactNode;
  className?: string;
}

/**
 * Steps container component.
 * 
 * Can be used two ways:
 * 1. With `steps` prop: Pass an array of step objects
 * 2. With children: Wrap StepItem components (auto-handles isLast)
 */
export function Steps({ steps, children, className }: StepsProps) {
  // If steps array is provided, render from that
  if (steps && steps.length > 0) {
    return (
      <div className={cn('my-4', className)}>
        {steps.map((step, index) => (
          <div key={index} className="relative flex gap-3 pb-3">
            {/* Step number + connector */}
            <div className="relative flex shrink-0 flex-col items-center">
              <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full border border-primary bg-background text-sm font-semibold text-primary">
                {index + 1}
              </div>
              {index < steps.length - 1 && (
                <div className="mt-1 w-px flex-1 bg-border" />
              )}
            </div>

            {/* Content */}
            <div className="min-w-0">
              <div className="text-base font-semibold text-foreground leading-6">
                {step.title}
              </div>
              {step.content && (
                <div className="mt-1 text-sm text-muted-foreground leading-5 [&>p]:m-0 [&>p]:leading-5">
                  {step.content}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // If children are provided, clone them with proper isLast prop
  const childArray = React.Children.toArray(children).filter(
    (child): child is React.ReactElement<StepItemProps> => React.isValidElement(child)
  );

  return (
    <div className={cn('my-4', className)}>
      {childArray.map((child, index) => {
        return React.cloneElement(child, {
          isLast: index === childArray.length - 1,
          number: (child.props as StepItemProps).number ?? index + 1,
        });
      })}
    </div>
  );
}

// Individual step component for composition
interface StepItemProps {
  number?: number;
  title: string;
  children?: React.ReactNode;
  isLast?: boolean;
  isCompleted?: boolean;
  className?: string;
}

export function StepItem({
  number = 1,
  title,
  children,
  isLast = false,
  isCompleted = false,
  className,
}: StepItemProps) {
  return (
    <div className={cn('relative flex gap-3 pb-3', className)}>
      {/* Step number + connector */}
      <div className="relative flex shrink-0 flex-col items-center">
        <div
          className={cn(
            'relative z-10 flex h-6 w-6 items-center justify-center rounded-full border text-sm font-semibold',
            isCompleted
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-primary bg-background text-primary'
          )}
        >
          {isCompleted ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <span>{number}</span>
          )}
        </div>
        {!isLast && (
          <div
            className={cn(
              'mt-1 w-px flex-1',
              isCompleted ? 'bg-primary' : 'bg-border'
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0">
        <div className="text-base font-semibold text-foreground leading-6">
          {title}
        </div>
        {children && (
          <div className="mt-1 text-sm text-muted-foreground leading-5 [&>p]:m-0 [&>p]:leading-5">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}


