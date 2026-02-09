'use client';

import { useState, createContext, useContext } from 'react';
import { ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CopyableCodeBlock } from './CopyableCodeBlock';
import { CodeWithIndentGuides } from './CodeWithIndentGuides';

/**
 * ConfigReference - Two-column configuration documentation
 * 
 * Left: Collapsible property groups
 * Right: Code example (sticky within the section, constrained to properties height)
 * 
 * Usage in MDX:
 * <ConfigReference
 *   title="Configuration Options"
 *   description="All configuration is optional."
 *   codeExample={`<PillarProvider config={{...}} />`}
 * >
 *   <PropertyGroup title="edgeTrigger">...</PropertyGroup>
 *   <PropertyGroup title="panel">...</PropertyGroup>
 * </ConfigReference>
 */

// Context for expand/collapse all functionality
interface ConfigReferenceContextValue {
  expandAll: boolean;
  setExpandAll: (value: boolean) => void;
}

const ConfigReferenceContext = createContext<ConfigReferenceContextValue | null>(null);

export function useConfigReferenceContext() {
  return useContext(ConfigReferenceContext);
}

interface ConfigReferenceProps {
  /** Section title */
  title?: string;
  /** Section description */
  description?: string;
  /** Code example to show in the right panel */
  codeExample: string;
  /** Language for syntax highlighting */
  codeLanguage?: string;
  /** Code panel title */
  codeTitle?: string;
  /** Children (PropertyGroups) */
  children: React.ReactNode;
}

export function ConfigReference({
  title,
  description,
  codeExample,
  codeLanguage = 'tsx',
  codeTitle = 'Example',
  children,
}: ConfigReferenceProps) {
  const [expandAll, setExpandAll] = useState(false);
  const [isCodeCollapsed, setIsCodeCollapsed] = useState(false);

  return (
    <ConfigReferenceContext.Provider value={{ expandAll, setExpandAll }}>
      <div className="my-6">
        {/* Header */}
        {(title || description) && (
          <div className="mb-4">
            {title && (
              <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        )}

        {/* Two-column grid - both columns same height */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-6 items-start">
          {/* Left column: Properties */}
          <div className="min-w-0">
            {/* Expand/Collapse all toggle */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
              <span className="text-sm font-medium text-muted-foreground">
                Properties
              </span>
              <button
                onClick={() => setExpandAll(!expandAll)}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                {expandAll ? (
                  <>
                    <Minimize2 className="h-3 w-3" />
                    Collapse all
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3 w-3" />
                    Expand all
                  </>
                )}
              </button>
            </div>

            {/* Property groups */}
            <div className="space-y-2">
              {children}
            </div>
          </div>

          {/* Right column: Code example */}
          <div className="hidden lg:block">
            <div className="sticky top-20">
              {/* Code panel header */}
              <div className="mb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {codeTitle}
                </span>
              </div>

              {/* Code block with indent guides */}
              <CopyableCodeBlock>
                <CodeWithIndentGuides
                  code={codeExample}
                  language={codeLanguage}
                  className="max-h-[calc(100vh-120px)] overflow-y-auto"
                />
              </CopyableCodeBlock>
            </div>
          </div>
        </div>

        {/* Mobile: Code example below properties */}
        <div className="lg:hidden mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {codeTitle}
            </span>
            <button
              onClick={() => setIsCodeCollapsed(!isCodeCollapsed)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={cn(
                  'h-3 w-3 transition-transform duration-200',
                  isCodeCollapsed && '-rotate-90'
                )}
              />
              {isCodeCollapsed ? 'Show' : 'Hide'}
            </button>
          </div>

          <div
            className={cn(
              'transition-all duration-200 overflow-hidden',
              isCodeCollapsed ? 'max-h-0' : 'max-h-[500px]'
            )}
          >
            <CopyableCodeBlock>
              <CodeWithIndentGuides
                code={codeExample}
                language={codeLanguage}
                className="max-h-[400px] overflow-y-auto"
              />
            </CopyableCodeBlock>
          </div>
        </div>
      </div>
    </ConfigReferenceContext.Provider>
  );
}
