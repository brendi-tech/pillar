/**
 * Mock Categories
 */

export interface MockCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  order: number;
  articleCount: number;
}

export const MOCK_CATEGORIES: MockCategory[] = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    slug: 'getting-started',
    description: 'New to Acme? Start here to learn the basics.',
    icon: 'Rocket',
    order: 1,
    articleCount: 5,
  },
  {
    id: 'account',
    name: 'Account & Settings',
    slug: 'account',
    description: 'Manage your profile, team, and preferences.',
    icon: 'User',
    order: 2,
    articleCount: 8,
  },
  {
    id: 'billing',
    name: 'Billing & Payments',
    slug: 'billing',
    description: 'Subscriptions, invoices, and payment methods.',
    icon: 'CreditCard',
    order: 3,
    articleCount: 6,
  },
  {
    id: 'integrations',
    name: 'Integrations',
    slug: 'integrations',
    description: 'Connect Acme with your favorite tools.',
    icon: 'Plug',
    order: 4,
    articleCount: 12,
  },
  {
    id: 'api',
    name: 'API Reference',
    slug: 'api',
    description: 'Developer documentation and API guides.',
    icon: 'Code',
    order: 5,
    articleCount: 15,
  },
  {
    id: 'troubleshooting',
    name: 'Troubleshooting',
    slug: 'troubleshooting',
    description: 'Common issues and how to fix them.',
    icon: 'Wrench',
    order: 6,
    articleCount: 10,
  },
];

export function getCategoryBySlug(slug: string): MockCategory | undefined {
  return MOCK_CATEGORIES.find(c => c.slug === slug);
}


