/**
 * V2 Types Index
 *
 * Exports all types for the new v2 API endpoints.
 */

// Products types
export * from './products';

// Content types
export * from './content';

// Sources types
export * from './sources';

// Common paginated response type
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
