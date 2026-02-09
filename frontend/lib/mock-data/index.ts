/**
 * Mock Data Index
 * 
 * Central export for all mock data
 */

// Versions
export {
  PRODUCT_VERSIONS,
  getLatestVersion,
  getVersionById,
  type ProductVersion,
} from './versions';

// Categories
export {
  MOCK_CATEGORIES,
  getCategoryBySlug,
  type MockCategory,
} from './categories';

// Articles
export {
  MOCK_ARTICLES,
  getArticleBySlug,
  getArticlesByCategory,
  getArticleContent,
  type MockArticle,
  type ArticleVersion,
} from './articles';

// Tutorials
export {
  MOCK_TUTORIALS,
  getTutorialBySlug,
  getTutorialsByCategory,
  type MockTutorial,
  type TutorialStep,
} from './tutorials';

// Getting Started
export {
  GETTING_STARTED_STEPS,
  getTotalEstimatedTime,
  type GettingStartedStep,
} from './getting-started';

// Personalization
export {
  MOCK_USER,
  MOCK_PERSONALIZED_CARDS,
  QUICK_ACTIONS,
  getPersonalizedCards,
  type PersonalizedCard,
  type MockUser,
} from './personalization';


