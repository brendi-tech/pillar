/**
 * Mock Personalization Data
 * 
 * Simulates data that would be returned by an API for logged-in users
 */

export interface PersonalizedCard {
  id: string;
  type: 'active_context' | 'alert' | 'suggested_action';
  title: string;
  description: string;
  icon: string;
  href?: string;
  actionLabel?: string;
  priority: number;
  metadata?: Record<string, string>;
}

export interface MockUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  accountStatus: 'active' | 'trial' | 'past_due';
  trialEndsAt?: string;
  lastLoginAt: string;
}

// Mock user data
export const MOCK_USER: MockUser = {
  id: 'user_123',
  name: 'Alex Johnson',
  email: 'alex@example.com',
  role: 'Admin',
  accountStatus: 'trial',
  trialEndsAt: '2025-01-15',
  lastLoginAt: '2024-12-10T10:30:00Z',
};

// Mock personalized cards based on user context
export const MOCK_PERSONALIZED_CARDS: PersonalizedCard[] = [
  {
    id: 'trial-ending',
    type: 'alert',
    title: 'Your trial ends in 5 days',
    description: 'Upgrade now to keep your projects and team access.',
    icon: 'Clock',
    href: '/billing/upgrade',
    actionLabel: 'View plans',
    priority: 1,
  },
  {
    id: 'incomplete-setup',
    type: 'suggested_action',
    title: 'Complete your team setup',
    description: 'Invite team members to collaborate on your projects.',
    icon: 'Users',
    href: '/getting-started/invite-team',
    actionLabel: 'Invite team',
    priority: 2,
  },
  {
    id: 'recent-deployment',
    type: 'active_context',
    title: 'Recent deployment failed',
    description: 'my-project deployment failed 2 hours ago. View logs to troubleshoot.',
    icon: 'AlertTriangle',
    href: '/troubleshooting/deployment-failed',
    actionLabel: 'Troubleshoot',
    priority: 3,
    metadata: {
      projectName: 'my-project',
      deploymentId: 'dep_abc123',
    },
  },
  {
    id: 'new-feature',
    type: 'suggested_action',
    title: 'Try AI-powered deployments',
    description: 'New feature: Let AI optimize your build configuration.',
    icon: 'Sparkles',
    href: '/tutorials/ai-deployments',
    actionLabel: 'Learn more',
    priority: 4,
  },
];

// Get cards based on user context
export function getPersonalizedCards(user: MockUser): PersonalizedCard[] {
  const cards: PersonalizedCard[] = [];
  
  // Add trial ending card if on trial
  if (user.accountStatus === 'trial') {
    cards.push(MOCK_PERSONALIZED_CARDS.find(c => c.id === 'trial-ending')!);
  }
  
  // Add past due alert
  if (user.accountStatus === 'past_due') {
    cards.push({
      id: 'past-due',
      type: 'alert',
      title: 'Payment failed',
      description: 'Please update your payment method to avoid service interruption.',
      icon: 'CreditCard',
      href: '/billing/payment-methods',
      actionLabel: 'Update payment',
      priority: 0,
    });
  }
  
  // Always add some suggested actions
  cards.push(
    ...MOCK_PERSONALIZED_CARDS.filter(c => 
      c.type === 'suggested_action' || c.type === 'active_context'
    ).slice(0, 3)
  );
  
  return cards.sort((a, b) => a.priority - b.priority);
}

// Quick actions for logged-in users
export const QUICK_ACTIONS = [
  { label: 'View my projects', href: '/dashboard/projects', icon: 'Folder' },
  { label: 'Account settings', href: '/dashboard/settings', icon: 'Settings' },
  { label: 'Billing & invoices', href: '/billing', icon: 'Receipt' },
  { label: 'API keys', href: '/account/security-settings', icon: 'Key' },
];


