/**
 * Getting Started Flow
 * 
 * Onboarding steps for new users
 */

export interface GettingStartedStep {
  id: string;
  order: number;
  title: string;
  description: string;
  estimatedTime: string;
  icon: string;
  href: string;
  type: 'article' | 'tutorial';
}

export const GETTING_STARTED_STEPS: GettingStartedStep[] = [
  {
    id: 'create-account',
    order: 1,
    title: 'Create Your Account',
    description: 'Sign up and set up your workspace',
    estimatedTime: '2 min',
    icon: 'UserPlus',
    href: '/getting-started/quickstart',
    type: 'article',
  },
  {
    id: 'first-project',
    order: 2,
    title: 'Create a Project',
    description: 'Deploy your first application',
    estimatedTime: '5 min',
    icon: 'Rocket',
    href: '/tutorials/first-project',
    type: 'tutorial',
  },
  {
    id: 'custom-domain',
    order: 3,
    title: 'Add Custom Domain',
    description: 'Connect your own domain name',
    estimatedTime: '5 min',
    icon: 'Globe',
    href: '/tutorials/custom-domain',
    type: 'tutorial',
  },
  {
    id: 'invite-team',
    order: 4,
    title: 'Invite Your Team',
    description: 'Add collaborators to your workspace',
    estimatedTime: '2 min',
    icon: 'Users',
    href: '/getting-started/invite-team',
    type: 'article',
  },
  {
    id: 'first-integration',
    order: 5,
    title: 'Set Up Notifications',
    description: 'Connect Slack for deployment alerts',
    estimatedTime: '3 min',
    icon: 'Bell',
    href: '/tutorials/first-integration',
    type: 'tutorial',
  },
];

export function getTotalEstimatedTime(): number {
  return GETTING_STARTED_STEPS.reduce((acc, step) => {
    return acc + parseInt(step.estimatedTime);
  }, 0);
}


