'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConfigReferenceContext } from './ConfigReference';

/**
 * PropertyList - Plaid-style API parameter documentation
 * 
 * Usage in MDX:
 * <PropertyList>
 *   <Property name="enabled" type="boolean" defaultValue="true">
 *     Whether the feature is enabled.
 *   </Property>
 *   <Property name="panel" type="object">
 *     Panel configuration options.
 *     <PropertyList nested>
 *       <Property name="position" type="'left' | 'right'" defaultValue="'right'">
 *         Which side the panel appears on.
 *       </Property>
 *     </PropertyList>
 *   </Property>
 * </PropertyList>
 */

interface PropertyProps {
  /** Property name */
  name: string;
  /** Type annotation */
  type: string;
  /** Whether this property is required */
  required?: boolean;
  /** Default value */
  defaultValue?: string;
  /** Description and optional nested properties */
  children: React.ReactNode;
  /** Internal: whether this is inside a nested PropertyList */
  isNested?: boolean;
}

export function Property({
  name,
  type,
  required = false,
  defaultValue,
  children,
  isNested = false,
}: PropertyProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Check if children contains nested PropertyList
  const hasNestedProperties = containsNestedPropertyList(children);
  
  // Separate description from nested PropertyList
  const { description, nestedList } = separateChildren(children);

  return (
    <div
      className={cn(
        'border-b border-border last:border-b-0',
        isNested ? 'py-3 first:pt-0' : 'py-3 first:pt-0'
      )}
    >
      {/* Header row: name on left, type + badges on right */}
      <div className="flex items-baseline justify-between gap-2">
        <code className="text-[13px] font-semibold text-foreground bg-transparent px-0">
          {name}
        </code>
        <div className="flex items-baseline gap-2 flex-shrink-0">
          {required && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-500">
              required
            </span>
          )}
          <span className="text-xs text-muted-foreground font-mono">
            {type}
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="mt-1 text-sm text-muted-foreground leading-relaxed">
        {description}
        {defaultValue && (
          <span className="ml-1 text-xs">
            Defaults to <code className="text-xs bg-muted px-1 py-0.5 rounded">{defaultValue}</code>.
          </span>
        )}
      </div>

      {/* Expandable nested properties */}
      {hasNestedProperties && (
        <div className="mt-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
            aria-expanded={isExpanded}
          >
            <ChevronRight
              className={cn(
                'h-3 w-3 transition-transform duration-200',
                isExpanded && 'rotate-90'
              )}
            />
            {isExpanded ? 'Hide object' : 'View object...'}
          </button>
          
          <div
            className={cn(
              'overflow-hidden transition-all duration-200',
              isExpanded ? 'max-h-[2000px] opacity-100 mt-3' : 'max-h-0 opacity-0'
            )}
          >
            <div className="pl-4 border-l-2 border-border">
              {nestedList}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PropertyListProps {
  /** Title for the property group */
  title?: string;
  /** Whether this is a nested list (affects styling) */
  nested?: boolean;
  children: React.ReactNode;
}

export function PropertyList({ title, nested = false, children }: PropertyListProps) {
  return (
    <div className={cn('my-4', nested && 'my-0')}>
      {title && (
        <h4 className="text-sm font-semibold text-foreground mb-3">{title}</h4>
      )}
      <div className={cn(!nested && 'border-t border-border')}>
        {children}
      </div>
    </div>
  );
}

/**
 * PropertyGroup - Collapsible group of related properties
 * Use for organizing large config objects into logical sections
 * 
 * Integrates with ConfigReference context for expand/collapse all
 */
interface PropertyGroupProps {
  /** Group title */
  title: string;
  /** Optional description */
  description?: string;
  /** Whether expanded by default */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function PropertyGroup({
  title,
  description,
  defaultOpen = false,
  children,
}: PropertyGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const configContext = useConfigReferenceContext();
  
  // Sync with expand all context
  useEffect(() => {
    if (configContext) {
      setIsOpen(configContext.expandAll);
    }
  }, [configContext]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left bg-muted/30 hover:bg-muted/50 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <ChevronRight
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-90'
            )}
          />
          <div>
            <code className="font-semibold text-foreground text-sm">{title}</code>
            {description && (
              <span className="text-sm text-muted-foreground ml-2">— {description}</span>
            )}
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          object
        </span>
      </button>
      
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="px-4 pb-3 pt-1 border-t border-border">
          {children}
        </div>
      </div>
    </div>
  );
}

// Helper to check if children contain a nested PropertyList
function containsNestedPropertyList(children: React.ReactNode): boolean {
  if (!children) return false;
  
  const childArray = Array.isArray(children) ? children : [children];
  
  return childArray.some((child) => {
    if (!child || typeof child !== 'object' || !('type' in child)) return false;
    // Check if it's a PropertyList component
    return (child as any).type === PropertyList || 
           (child as any).type?.displayName === 'PropertyList';
  });
}

// Helper to separate description content from nested PropertyList
function separateChildren(children: React.ReactNode): {
  description: React.ReactNode;
  nestedList: React.ReactNode;
} {
  if (!children) return { description: null, nestedList: null };
  
  const childArray = Array.isArray(children) ? children : [children];
  
  const description: React.ReactNode[] = [];
  let nestedList: React.ReactNode = null;
  
  childArray.forEach((child) => {
    if (child && typeof child === 'object' && 'type' in child) {
      const childType = (child as any).type;
      if (childType === PropertyList || childType?.displayName === 'PropertyList') {
        nestedList = child;
        return;
      }
    }
    description.push(child);
  });
  
  return {
    description: description.length > 0 ? description : null,
    nestedList,
  };
}

PropertyList.displayName = 'PropertyList';
