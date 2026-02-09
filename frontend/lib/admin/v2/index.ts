/**
 * V2 API Index
 *
 * Exports all v2 API modules for the new domain-specific endpoints.
 */

// API Client
export * from './api-client';

// Products API
export {
  productsAPI,
  platformsAPI,
  actionsAPI,
  actionExecutionLogsAPI,
} from './products-api';

// Content API
export {
  articlesAPI,
  categoriesAPI,
  articleVersionsAPI,
  articleLocalizationsAPI,
  articleRelationshipsAPI,
  articleFeedbackAPI,
  personasAPI,
  tutorialsAPI,
  tutorialStepsAPI,
} from './content-api';

// Note: Sources API removed - use Knowledge API from '@/lib/admin/knowledge-api' instead
