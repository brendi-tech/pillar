'use client';

import { FileQuestion, Search, BookOpen, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createElement, isValidElement, type ReactNode, type ComponentType } from 'react';

type IconType = 'search' | 'file' | 'book';

interface ActionObject {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface EmptyStateProps {
  icon?: IconType | LucideIcon | ReactNode;
  title: string;
  description?: string;
  /** Action button - can be an object with label/onClick/href, or a ReactNode */
  action?: ActionObject | ReactNode;
  className?: string;
}

const iconMap: Record<IconType, React.ComponentType<{ className?: string }>> = {
  search: Search,
  file: FileQuestion,
  book: BookOpen,
};

function isIconType(icon: IconType | LucideIcon | ReactNode): icon is IconType {
  return typeof icon === 'string' && icon in iconMap;
}

function isComponentType(icon: unknown): icon is ComponentType<{ className?: string }> {
  // Check if it's a function component or a forwardRef result (object with $$typeof)
  if (typeof icon === 'function') return true;
  if (typeof icon === 'object' && icon !== null && '$$typeof' in icon && !isValidElement(icon)) {
    return true;
  }
  return false;
}

function isActionObject(action: ActionObject | ReactNode): action is ActionObject {
  return typeof action === 'object' && action !== null && !isValidElement(action) && 'label' in action;
}

export function EmptyState({
  icon = 'file',
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  // Determine how to render the icon
  const renderIcon = (): ReactNode => {
    if (isIconType(icon)) {
      const IconComponent = iconMap[icon];
      return <IconComponent className="h-12 w-12 text-muted-foreground/50 mx-auto" />;
    }
    if (isComponentType(icon)) {
      // Use createElement for forwardRef components to avoid JSX issues
      return createElement(icon, { className: "h-12 w-12 text-muted-foreground/50 mx-auto" });
    }
    // Assume it's a ReactNode (already an element)
    // Cast is safe: IconType and ComponentType (including LucideIcon) are handled above
    return icon as ReactNode;
  };

  // Determine how to render the action
  const renderAction = () => {
    if (!action) return null;
    
    if (isActionObject(action)) {
      return action.href ? (
        <Button asChild>
          <a href={action.href}>{action.label}</a>
        </Button>
      ) : (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      );
    }
    
    // It's a ReactNode
    return action;
  };

  return (
    <div className={cn('text-center py-12 px-4', className)}>
      {/* Icon */}
      <div className="mx-auto mb-4">
        {renderIcon()}
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold mb-2">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
          {description}
        </p>
      )}

      {/* Action */}
      {renderAction()}
    </div>
  );
}

// Pre-configured empty states
export function NoSearchResults({ query }: { query?: string }) {
  return (
    <EmptyState
      icon="search"
      title="No results found"
      description={
        query
          ? `No articles match "${query}". Try different keywords or browse by category.`
          : 'Try searching for something else or browse by category.'
      }
      action={{
        label: 'Browse categories',
        href: '/',
      }}
    />
  );
}

export function NoArticles() {
  return (
    <EmptyState
      icon="book"
      title="No articles yet"
      description="This category doesn't have any articles yet. Check back soon!"
      action={{
        label: 'Go home',
        href: '/',
      }}
    />
  );
}


