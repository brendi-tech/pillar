/**
 * Debug utilities for performance analysis and troubleshooting.
 * 
 * Enable debugging by setting localStorage key 'pillar_debug' to 'true'
 * or by adding ?debug=true to the URL.
 * 
 * Usage:
 *   debug.log('auth', 'Starting login flow');
 *   debug.time('api', 'fetchUser');
 *   // ... do work ...
 *   debug.timeEnd('api', 'fetchUser');
 *   debug.renderCount('AuthProvider');
 */

type DebugCategory = 
  | 'auth'      // Authentication flows
  | 'api'       // API requests
  | 'render'    // React renders
  | 'router'    // Navigation
  | 'query'     // TanStack Query
  | 'websocket' // WebSocket connections
  | 'perf'      // Performance metrics
  | 'storage'   // localStorage/cookies
  | 'general';  // Everything else

interface PerfMark {
  start: number;
  category: DebugCategory;
}

interface RenderTracker {
  count: number;
  lastRender: number;
  timestamps: number[];
}

class DebugLogger {
  private enabled: boolean = false;
  private timers: Map<string, PerfMark> = new Map();
  private renderCounts: Map<string, RenderTracker> = new Map();
  private apiRequests: Array<{
    method: string;
    url: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    status?: number;
  }> = [];
  private categories: Set<DebugCategory> = new Set([
    'auth', 'api', 'render', 'router', 'query', 'websocket', 'perf', 'storage', 'general'
  ]);

  constructor() {
    this.checkEnabled();
    
    // Re-check on storage changes (for dynamic enable/disable)
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', () => this.checkEnabled());
    }
  }

  private checkEnabled(): void {
    if (typeof window === 'undefined') {
      this.enabled = false;
      return;
    }

    // Check URL param first
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === 'true') {
      localStorage.setItem('pillar_debug', 'true');
      this.enabled = true;
      return;
    }

    // Check localStorage
    this.enabled = localStorage.getItem('pillar_debug') === 'true';
  }

  /**
   * Check if debugging is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable debugging programmatically
   */
  enable(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pillar_debug', 'true');
      this.enabled = true;
      console.log('%c[DEBUG] Debugging enabled - refresh to see all logs', 'color: #22c55e; font-weight: bold');
    }
  }

  /**
   * Disable debugging programmatically
   */
  disable(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pillar_debug');
      this.enabled = false;
      console.log('%c[DEBUG] Debugging disabled', 'color: #ef4444; font-weight: bold');
    }
  }

  /**
   * Set which categories to show (or show all if empty)
   */
  setCategories(cats: DebugCategory[]): void {
    if (cats.length === 0) {
      this.categories = new Set([
        'auth', 'api', 'render', 'router', 'query', 'websocket', 'perf', 'storage', 'general'
      ]);
    } else {
      this.categories = new Set(cats);
    }
  }

  private getCategoryColor(category: DebugCategory): string {
    const colors: Record<DebugCategory, string> = {
      auth: '#a855f7',      // Purple
      api: '#3b82f6',       // Blue
      render: '#f59e0b',    // Amber
      router: '#10b981',    // Emerald
      query: '#06b6d4',     // Cyan
      websocket: '#ec4899', // Pink
      perf: '#ef4444',      // Red
      storage: '#8b5cf6',   // Violet
      general: '#6b7280',   // Gray
    };
    return colors[category];
  }

  private formatMessage(category: DebugCategory, message: string): string[] {
    const color = this.getCategoryColor(category);
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    return [
      `%c[${timestamp}] %c[${category.toUpperCase()}]%c ${message}`,
      'color: #6b7280',
      `color: ${color}; font-weight: bold`,
      'color: inherit'
    ];
  }

  /**
   * Log a debug message
   */
  log(category: DebugCategory, message: string, ...args: unknown[]): void {
    if (!this.enabled || !this.categories.has(category)) return;
    
    const [format, ...styles] = this.formatMessage(category, message);
    console.log(format, ...styles, ...args);
  }

  /**
   * Log a warning
   */
  warn(category: DebugCategory, message: string, ...args: unknown[]): void {
    if (!this.enabled || !this.categories.has(category)) return;
    
    const [format, ...styles] = this.formatMessage(category, message);
    console.warn(format, ...styles, ...args);
  }

  /**
   * Log an error (always logs even if debug disabled)
   */
  error(category: DebugCategory, message: string, ...args: unknown[]): void {
    const [format, ...styles] = this.formatMessage(category, message);
    console.error(format, ...styles, ...args);
  }

  /**
   * Start a timer
   */
  time(category: DebugCategory, label: string): void {
    if (!this.enabled) return;
    
    const key = `${category}:${label}`;
    this.timers.set(key, { start: performance.now(), category });
    this.log(category, `⏱️ START: ${label}`);
  }

  /**
   * End a timer and log the duration
   */
  timeEnd(category: DebugCategory, label: string): number | undefined {
    if (!this.enabled) return;
    
    const key = `${category}:${label}`;
    const mark = this.timers.get(key);
    if (!mark) {
      this.warn(category, `Timer "${label}" not found`);
      return;
    }
    
    const duration = performance.now() - mark.start;
    this.timers.delete(key);
    
    const durationStr = duration > 1000 
      ? `${(duration / 1000).toFixed(2)}s` 
      : `${duration.toFixed(2)}ms`;
    
    const color = duration > 1000 ? '#ef4444' : duration > 500 ? '#f59e0b' : '#22c55e';
    
    console.log(
      `%c[${mark.category.toUpperCase()}]%c ⏱️ END: ${label} - %c${durationStr}`,
      `color: ${this.getCategoryColor(mark.category)}; font-weight: bold`,
      'color: inherit',
      `color: ${color}; font-weight: bold`
    );
    
    return duration;
  }

  /**
   * Track component renders
   */
  renderCount(componentName: string): void {
    if (!this.enabled) return;
    
    const now = Date.now();
    let tracker = this.renderCounts.get(componentName);
    
    if (!tracker) {
      tracker = { count: 0, lastRender: now, timestamps: [] };
      this.renderCounts.set(componentName, tracker);
    }
    
    tracker.count++;
    tracker.timestamps.push(now);
    
    // Keep only last 100 timestamps
    if (tracker.timestamps.length > 100) {
      tracker.timestamps = tracker.timestamps.slice(-100);
    }
    
    // Calculate renders per second
    const oneSecondAgo = now - 1000;
    const recentRenders = tracker.timestamps.filter(t => t > oneSecondAgo).length;
    
    // Warn if rendering more than 5 times per second
    if (recentRenders > 5) {
      console.warn(
        `%c[RENDER]%c ⚠️ ${componentName} - Render #${tracker.count} (${recentRenders}/sec!)`,
        'color: #f59e0b; font-weight: bold',
        'color: inherit'
      );
    } else {
      this.log('render', `${componentName} - Render #${tracker.count}`);
    }
    
    tracker.lastRender = now;
  }

  /**
   * Track an API request
   */
  trackRequest(method: string, url: string): () => void {
    if (!this.enabled) return () => {};
    
    const request: {
      method: string;
      url: string;
      startTime: number;
      endTime?: number;
      duration?: number;
      status?: number;
    } = {
      method,
      url,
      startTime: performance.now(),
    };
    this.apiRequests.push(request);
    
    // Keep only last 50 requests
    if (this.apiRequests.length > 50) {
      this.apiRequests = this.apiRequests.slice(-50);
    }
    
    this.log('api', `➡️ ${method} ${url}`);
    
    // Return a function to mark the request as complete
    return (status?: number) => {
      request.endTime = performance.now();
      request.duration = request.endTime - request.startTime;
      request.status = status;
      
      const durationStr = request.duration > 1000 
        ? `${(request.duration / 1000).toFixed(2)}s` 
        : `${request.duration.toFixed(2)}ms`;
      
      const statusColor = status && status >= 400 ? '#ef4444' : '#22c55e';
      const durationColor = request.duration > 1000 ? '#ef4444' : '#22c55e';
      
      console.log(
        `%c[API]%c ⬅️ ${method} ${url} %c${status || ''}%c in %c${durationStr}`,
        'color: #3b82f6; font-weight: bold',
        'color: inherit',
        `color: ${statusColor}; font-weight: bold`,
        'color: inherit',
        `color: ${durationColor}; font-weight: bold`
      );
    };
  }

  /**
   * Log auth state changes
   */
  authState(state: string, details?: unknown): void {
    this.log('auth', `🔐 ${state}`, details ?? '');
  }

  /**
   * Log router navigation
   */
  navigate(from: string, to: string): void {
    this.log('router', `🔀 ${from} → ${to}`);
  }

  /**
   * Print a summary of collected metrics
   */
  summary(): void {
    if (typeof window === 'undefined') return;
    
    console.group('%c[DEBUG] Performance Summary', 'color: #3b82f6; font-weight: bold; font-size: 14px');
    
    // Render counts
    console.group('📊 Render Counts');
    const sortedRenders = Array.from(this.renderCounts.entries())
      .sort((a, b) => b[1].count - a[1].count);
    
    sortedRenders.forEach(([name, tracker]) => {
      const style = tracker.count > 10 ? 'color: #ef4444' : 'color: inherit';
      console.log(`%c${name}: ${tracker.count} renders`, style);
    });
    console.groupEnd();
    
    // Slow requests
    console.group('🐢 Slow API Requests (>500ms)');
    const slowRequests = this.apiRequests
      .filter(r => r.duration && r.duration > 500)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0));
    
    slowRequests.forEach(r => {
      console.log(
        `${r.method} ${r.url}: ${r.duration?.toFixed(0)}ms`,
        r.status ? `(${r.status})` : ''
      );
    });
    if (slowRequests.length === 0) console.log('None');
    console.groupEnd();
    
    // Active timers
    if (this.timers.size > 0) {
      console.group('⏳ Active Timers (not ended)');
      this.timers.forEach((mark, key) => {
        const elapsed = performance.now() - mark.start;
        console.log(`${key}: ${elapsed.toFixed(0)}ms (still running)`);
      });
      console.groupEnd();
    }
    
    console.groupEnd();
  }

  /**
   * Clear all tracked data
   */
  clear(): void {
    this.timers.clear();
    this.renderCounts.clear();
    this.apiRequests = [];
    console.log('%c[DEBUG] Cleared all debug data', 'color: #6b7280');
  }
}

// Create singleton instance
export const debug = new DebugLogger();

// Export type for use in hooks
export type { DebugCategory };

// Attach to window for console access
if (typeof window !== 'undefined') {
  (window as unknown as { pillarDebug: DebugLogger }).pillarDebug = debug;
  
  // Log instructions on first load if not enabled
  if (!debug.isEnabled()) {
    console.log(
      '%c[Pillar Debug] Enable debugging with: pillarDebug.enable() or add ?debug=true to URL',
      'color: #6b7280; font-style: italic'
    );
  } else {
    console.log(
      '%c[Pillar Debug] Debugging is ENABLED. Disable with: pillarDebug.disable()',
      'color: #22c55e; font-weight: bold'
    );
    console.log(
      '%c[Pillar Debug] Show summary with: pillarDebug.summary()',
      'color: #6b7280'
    );
  }
}


