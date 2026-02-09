/**
 * Server-side debug utilities for Next.js.
 * 
 * Enable by setting environment variable: DEBUG=true
 * or NEXT_PUBLIC_DEBUG=true
 * 
 * These logs appear in the terminal where Next.js is running.
 */

type ServerDebugCategory = 
  | 'middleware'
  | 'api'
  | 'rsc'      // React Server Components
  | 'fetch'
  | 'auth'
  | 'config';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const CATEGORY_COLORS: Record<ServerDebugCategory, string> = {
  middleware: COLORS.magenta,
  api: COLORS.blue,
  rsc: COLORS.cyan,
  fetch: COLORS.green,
  auth: COLORS.yellow,
  config: COLORS.gray,
};

class ServerDebugLogger {
  private enabled: boolean;
  private timers: Map<string, number> = new Map();

  constructor() {
    this.enabled = 
      process.env.DEBUG === 'true' || 
      process.env.NEXT_PUBLIC_DEBUG === 'true' ||
      process.env.NODE_ENV === 'development';
  }

  private formatMessage(category: ServerDebugCategory, message: string): string {
    const color = CATEGORY_COLORS[category];
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    return `${COLORS.gray}[${timestamp}]${COLORS.reset} ${color}[${category.toUpperCase()}]${COLORS.reset} ${message}`;
  }

  log(category: ServerDebugCategory, message: string, ...args: unknown[]): void {
    if (!this.enabled) return;
    console.log(this.formatMessage(category, message), ...args);
  }

  warn(category: ServerDebugCategory, message: string, ...args: unknown[]): void {
    if (!this.enabled) return;
    console.warn(`${COLORS.yellow}⚠️${COLORS.reset} ${this.formatMessage(category, message)}`, ...args);
  }

  error(category: ServerDebugCategory, message: string, ...args: unknown[]): void {
    // Errors always log
    console.error(`${COLORS.red}❌${COLORS.reset} ${this.formatMessage(category, message)}`, ...args);
  }

  time(category: ServerDebugCategory, label: string): void {
    if (!this.enabled) return;
    this.timers.set(`${category}:${label}`, performance.now());
    this.log(category, `⏱️ START: ${label}`);
  }

  timeEnd(category: ServerDebugCategory, label: string): number | undefined {
    if (!this.enabled) return;
    
    const key = `${category}:${label}`;
    const start = this.timers.get(key);
    if (!start) {
      this.warn(category, `Timer "${label}" not found`);
      return;
    }

    const duration = performance.now() - start;
    this.timers.delete(key);

    const durationStr = duration > 1000 
      ? `${(duration / 1000).toFixed(2)}s` 
      : `${duration.toFixed(0)}ms`;
    
    const color = duration > 1000 ? COLORS.red : duration > 500 ? COLORS.yellow : COLORS.green;
    
    console.log(
      `${CATEGORY_COLORS[category]}[${category.toUpperCase()}]${COLORS.reset} ⏱️ END: ${label} - ${color}${durationStr}${COLORS.reset}`
    );

    return duration;
  }

  /**
   * Log middleware request details
   */
  middleware(request: { method: string; url: string }, details?: Record<string, unknown>): void {
    this.log('middleware', `${request.method} ${request.url}`, details ?? '');
  }

  /**
   * Log server component render
   */
  serverComponent(name: string, props?: Record<string, unknown>): void {
    this.log('rsc', `Rendering ${name}`, props ?? '');
  }
}

export const serverDebug = new ServerDebugLogger();

export type { ServerDebugCategory };


