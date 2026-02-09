'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface MermaidProps {
  chart: string;
  className?: string;
}

// Mermaid configuration - applied once when library loads
const MERMAID_CONFIG = {
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    // Background colors
    primaryColor: '#3b82f6', // blue-500
    primaryTextColor: '#f8fafc', // slate-50
    primaryBorderColor: '#60a5fa', // blue-400
    
    // Secondary colors
    secondaryColor: '#1e293b', // slate-800
    secondaryTextColor: '#e2e8f0', // slate-200
    secondaryBorderColor: '#475569', // slate-600
    
    // Tertiary colors  
    tertiaryColor: '#0f172a', // slate-900
    tertiaryTextColor: '#cbd5e1', // slate-300
    tertiaryBorderColor: '#334155', // slate-700
    
    // Background
    background: '#0f172a', // slate-900
    mainBkg: '#1e293b', // slate-800
    
    // Lines and text
    lineColor: '#64748b', // slate-500
    textColor: '#e2e8f0', // slate-200
    
    // Fonts - keep readable but compact
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: '16px',
    
    // Node colors
    nodeBorder: '#475569',
    clusterBkg: '#1e293b',
    clusterBorder: '#475569',
    
    // Note styling
    noteBkgColor: '#1e293b',
    noteTextColor: '#e2e8f0',
    noteBorderColor: '#475569',
  },
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
    padding: 12,
    nodeSpacing: 30,
    rankSpacing: 40,
    diagramPadding: 8,
    useMaxWidth: true,
  },
} as const;

// Track if mermaid has been initialized
let mermaidInitialized = false;

/**
 * Mermaid diagram component for MDX
 * Renders mermaid charts with a dark theme matching the docs
 * Lazy-loads the mermaid library to reduce initial bundle size
 */
export function Mermaid({ chart, className }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const renderChart = async () => {
      if (!containerRef.current || !chart) return;

      try {
        // Dynamically import mermaid only when needed
        const mermaid = (await import('mermaid')).default;
        
        // Initialize only once
        if (!mermaidInitialized) {
          mermaid.initialize(MERMAID_CONFIG);
          mermaidInitialized = true;
        }

        // Generate unique ID for this chart
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        
        // Render the chart - let mermaid handle sizing naturally
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        setSvg(renderedSvg);
        setError(null);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      } finally {
        setIsLoading(false);
      }
    };

    renderChart();
  }, [chart]);

  if (error) {
    return (
      <div className={cn(
        'bg-red-950/50 border border-red-800 rounded-lg p-4 my-4',
        'text-red-200 text-sm font-mono',
        className
      )}>
        <p className="font-semibold mb-2">Mermaid Diagram Error:</p>
        <pre className="whitespace-pre-wrap">{error}</pre>
        <details className="mt-2">
          <summary className="cursor-pointer text-red-300 hover:text-red-100">
            Show diagram source
          </summary>
          <pre className="mt-2 p-2 bg-red-950 rounded text-xs overflow-x-auto">
            {chart}
          </pre>
        </details>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          'my-6 p-4 rounded-lg overflow-x-auto',
          'bg-slate-900 border border-slate-700',
          'flex justify-center items-center',
          'h-32 animate-pulse',
          className
        )}
      >
        <span className="text-slate-500 text-sm">Loading diagram...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'my-6 p-4 rounded-lg overflow-x-auto',
        'bg-slate-900 border border-slate-700',
        'flex justify-center items-center',
        className
      )}
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
