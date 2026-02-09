/**
 * Mock Articles with Version Support - Markdown Format
 */

export interface ArticleVersion {
  id: string;
  isLatest: boolean;
  /** Content in markdown format */
  content: string;
  lastUpdated: string;
  screenshots?: string[];
}

export interface MockArticle {
  id: string;
  slug: string;
  title: string;
  description: string;
  categoryId: string;
  categorySlug: string;
  readingTime: string;
  author: string;
  tags: string[];
  relatedArticles: string[];
  versions: ArticleVersion[];
}

export const MOCK_ARTICLES: MockArticle[] = [
  // Getting Started
  {
    id: 'quickstart',
    slug: 'quickstart',
    title: 'Quickstart Guide',
    description: 'Get up and running with Acme in 5 minutes.',
    categoryId: 'getting-started',
    categorySlug: 'getting-started',
    readingTime: '5 min',
    author: 'Acme Team',
    tags: ['quickstart', 'installation', 'cli'],
    relatedArticles: ['configuration', 'invite-team'],
    versions: [
      {
        id: '2024.2',
        isLatest: true,
        lastUpdated: '2024-12-01',
        content: `Welcome to Acme! This guide will help you get started in just 5 minutes.

## Prerequisites

Before you begin, make sure you have:

- An Acme account ([sign up here](https://acme.com/signup))
- Node.js 18+ installed
- A terminal application

## Step 1: Install the CLI

Open your terminal and run:

\`\`\`bash
npm install -g @acme/cli
\`\`\`

> **Tip:** You can also use yarn or pnpm: \`yarn global add @acme/cli\` or \`pnpm add -g @acme/cli\`

## Step 2: Authenticate

Log in to your Acme account:

\`\`\`bash
acme login
\`\`\`

This will open a browser window for authentication. After logging in, your credentials will be saved securely.

> **Info:** Your API key is stored in \`~/.acmerc\`. Keep this file secure!

## Step 3: Create Your First Project

Now let's create and deploy your first project:

\`\`\`bash
acme init my-project
cd my-project
acme deploy
\`\`\`

That's it! Your project is now live at \`https://my-project.acme.app\`.

## What's Next?

- [Configure your project](/getting-started/configuration) - Customize settings and environment variables
- [Invite your team](/getting-started/invite-team) - Add collaborators to your project
- [Explore the API](/api/overview) - Build integrations with our REST API

> **Tip:** **New in 2024.2:** You can now use \`acme ai suggest\` to get AI-powered recommendations for your project setup!`,
      },
      {
        id: '2024.1',
        isLatest: false,
        lastUpdated: '2024-08-15',
        content: `Welcome to Acme! This guide will help you get started in just 5 minutes.

## Prerequisites

Before you begin, make sure you have:

- An Acme account ([sign up here](https://acme.com/signup))
- Node.js 16+ installed
- A terminal application

## Step 1: Install the CLI

Open your terminal and run:

\`\`\`bash
npm install -g @acme/cli
\`\`\`

## Step 2: Authenticate

Log in to your Acme account:

\`\`\`bash
acme login
\`\`\`

This will open a browser window for authentication.

> **Info:** Your API key is stored in \`~/.acmerc\`.

## Step 3: Create Your First Project

\`\`\`bash
acme init my-project
cd my-project
acme deploy
\`\`\`

Your project is now live!

## What's Next?

- [Configure your project](/getting-started/configuration)
- [Invite your team](/getting-started/invite-team)`,
      },
    ],
  },
  {
    id: 'configuration',
    slug: 'configuration',
    title: 'Project Configuration',
    description: 'Learn how to configure your Acme project settings.',
    categoryId: 'getting-started',
    categorySlug: 'getting-started',
    readingTime: '8 min',
    author: 'Acme Team',
    tags: ['configuration', 'settings', 'environment'],
    relatedArticles: ['quickstart', 'environment-variables'],
    versions: [
      {
        id: '2024.2',
        isLatest: true,
        lastUpdated: '2024-11-20',
        content: `Learn how to configure your Acme project for different environments and use cases.

## Configuration File

Acme uses an \`acme.config.js\` file in your project root:

\`\`\`javascript
// acme.config.js
module.exports = {
  name: 'my-project',
  region: 'us-east-1',

  build: {
    command: 'npm run build',
    output: './dist',
  },

  env: {
    API_URL: process.env.API_URL,
    DEBUG: process.env.DEBUG || 'false',
  },
};
\`\`\`

## Environment Variables

**Via Dashboard:**

1. Go to your project settings
2. Click "Environment Variables"
3. Add your variables
4. Click "Save"

**Via CLI:**

\`\`\`bash
acme env set API_URL=https://api.example.com
acme env set DEBUG=true
\`\`\`

> **Warning:** Never commit sensitive environment variables to version control!

## Regions

Available regions:

- \`us-east-1\` - US East (Virginia)
- \`us-west-2\` - US West (Oregon)
- \`eu-west-1\` - Europe (Ireland)
- \`ap-southeast-1\` - Asia Pacific (Singapore)

## Advanced Configuration

### Custom Build Commands

You can specify custom build commands for different environments:

\`\`\`javascript
build: {
  command: process.env.NODE_ENV === 'production'
    ? 'npm run build:prod'
    : 'npm run build',
}
\`\`\`

### Custom Domains

Add custom domains in your config:

\`\`\`javascript
domains: ['example.com', 'www.example.com'],
\`\`\``,
      },
    ],
  },
  {
    id: 'invite-team',
    slug: 'invite-team',
    title: 'Invite Your Team',
    description: 'Add team members and manage permissions.',
    categoryId: 'getting-started',
    categorySlug: 'getting-started',
    readingTime: '4 min',
    author: 'Acme Team',
    tags: ['team', 'collaboration', 'permissions'],
    relatedArticles: ['quickstart', 'roles-permissions'],
    versions: [
      {
        id: '2024.2',
        isLatest: true,
        lastUpdated: '2024-10-15',
        content: `Collaborate with your team by adding members to your Acme workspace.

## Adding Team Members

1. Go to **Settings → Team**
2. Click **Invite Member**
3. Enter their email address
4. Select a role (Admin, Developer, or Viewer)
5. Click **Send Invite**

> **Info:** Invited users will receive an email with instructions to join your workspace.

## Roles & Permissions

**Admin** - Full access, can manage team and billing

**Developer** - Can create and deploy projects

**Viewer** - Read-only access to projects

## Managing Members

To change a member's role or remove them:

1. Go to **Settings → Team**
2. Find the member in the list
3. Click the **⋮** menu
4. Select **Change Role** or **Remove**

> **Warning:** Removing a member will immediately revoke their access to all projects.`,
      },
    ],
  },

  // Account & Settings
  {
    id: 'profile-settings',
    slug: 'profile-settings',
    title: 'Profile Settings',
    description: 'Update your profile, avatar, and notification preferences.',
    categoryId: 'account',
    categorySlug: 'account',
    readingTime: '3 min',
    author: 'Acme Team',
    tags: ['profile', 'settings', 'notifications'],
    relatedArticles: ['security-settings', 'email-preferences'],
    versions: [
      {
        id: '2024.2',
        isLatest: true,
        lastUpdated: '2024-11-10',
        content: `Manage your personal profile and preferences.

## Updating Your Profile

1. Click your avatar in the top-right corner
2. Select **Settings**
3. Update your information:
   - Display name
   - Email address
   - Avatar
   - Time zone

> **Tip:** Your display name is shown in comments, activity feeds, and team member lists.

## Notification Preferences

Control what notifications you receive:

- **Email notifications** - Daily digest, important alerts
- **In-app notifications** - Real-time updates
- **Slack notifications** - If connected

## Two-Factor Authentication

We strongly recommend enabling 2FA:

1. Go to **Settings → Security**
2. Click **Enable 2FA**
3. Scan the QR code with your authenticator app
4. Enter the verification code

> **Warning:** Save your backup codes in a secure location!`,
      },
    ],
  },
  {
    id: 'security-settings',
    slug: 'security-settings',
    title: 'Security Settings',
    description: 'Manage passwords, 2FA, and security preferences.',
    categoryId: 'account',
    categorySlug: 'account',
    readingTime: '5 min',
    author: 'Acme Team',
    tags: ['security', '2fa', 'password'],
    relatedArticles: ['profile-settings', 'api-keys'],
    versions: [
      {
        id: '2024.2',
        isLatest: true,
        lastUpdated: '2024-12-05',
        content: `Keep your account secure with these settings.

## Password Requirements

Your password must:

- Be at least 12 characters long
- Include uppercase and lowercase letters
- Include at least one number
- Include at least one special character

## Changing Your Password

1. Go to **Settings → Security**
2. Click **Change Password**
3. Enter your current password
4. Enter and confirm your new password

## Active Sessions

View and manage your active sessions:

- See all devices where you're logged in
- Revoke access to specific sessions
- Sign out of all sessions at once

> **Info:** We'll notify you by email when a new device logs into your account.

## API Keys

Manage your personal API keys for programmatic access:

\`\`\`bash
# List your API keys
acme keys list

# Create a new key
acme keys create --name "CI/CD Pipeline"

# Revoke a key
acme keys revoke <key-id>
\`\`\``,
      },
    ],
  },

  // Billing
  {
    id: 'subscription-plans',
    slug: 'subscription-plans',
    title: 'Subscription Plans',
    description: 'Compare plans and find the right one for your team.',
    categoryId: 'billing',
    categorySlug: 'billing',
    readingTime: '4 min',
    author: 'Acme Team',
    tags: ['billing', 'plans', 'pricing'],
    relatedArticles: ['upgrade-plan', 'invoices'],
    versions: [
      {
        id: '2024.2',
        isLatest: true,
        lastUpdated: '2024-11-01',
        content: `Choose the plan that's right for your team.

## Available Plans

**Free Plan:**

- 3 projects
- 1 team member
- 1 GB storage
- Community support

**Pro Plan:**

- Unlimited projects
- 10 team members
- 100 GB storage
- Priority support
- AI Features

**Enterprise Plan:**

- Unlimited projects
- Unlimited team members
- 1 TB storage
- Dedicated support
- AI Features
- SSO

## Upgrading Your Plan

1. Go to **Settings → Billing**
2. Click **Upgrade**
3. Select your new plan
4. Enter payment information
5. Confirm the upgrade

> **Info:** Upgrades take effect immediately. You'll be charged a prorated amount for the remainder of the billing period.

## Downgrading

If you need to downgrade:

- Your plan will change at the end of the current billing period
- You'll retain access to all features until then
- Data exceeding the new plan's limits will be preserved but read-only`,
      },
    ],
  },
  {
    id: 'invoices',
    slug: 'invoices',
    title: 'View and Download Invoices',
    description: 'Access your billing history and download invoices.',
    categoryId: 'billing',
    categorySlug: 'billing',
    readingTime: '2 min',
    author: 'Acme Team',
    tags: ['billing', 'invoices', 'receipts'],
    relatedArticles: ['subscription-plans', 'payment-methods'],
    versions: [
      {
        id: '2024.2',
        isLatest: true,
        lastUpdated: '2024-10-20',
        content: `Access your complete billing history.

## Finding Your Invoices

1. Go to **Settings → Billing**
2. Click **Billing History**
3. You'll see a list of all invoices

## Downloading Invoices

For each invoice, you can:

- **View** - Open the invoice in your browser
- **Download PDF** - Save a PDF copy
- **Download CSV** - Export line items as CSV

## Invoice Details

Each invoice includes:

- Invoice number and date
- Billing period
- Line items (subscription, overages, etc.)
- Taxes (if applicable)
- Payment method used

> **Tip:** Need invoices sent to a specific email? Update your billing email in Settings → Billing → Billing Contact.`,
      },
    ],
  },

  // Integrations
  {
    id: 'slack-integration',
    slug: 'slack-integration',
    title: 'Slack Integration',
    description: 'Get notifications and interact with Acme from Slack.',
    categoryId: 'integrations',
    categorySlug: 'integrations',
    readingTime: '6 min',
    author: 'Acme Team',
    tags: ['slack', 'integration', 'notifications'],
    relatedArticles: ['webhook-setup', 'github-integration'],
    versions: [
      {
        id: '2024.2',
        isLatest: true,
        lastUpdated: '2024-11-15',
        content: `Connect Acme to Slack for real-time notifications and commands.

## Setting Up

1. Go to **Settings → Integrations**
2. Find **Slack** and click **Connect**
3. Authorize Acme to access your Slack workspace
4. Select the channel for notifications

## Available Notifications

Choose which events to receive:

- Deployment started
- Deployment completed
- Deployment failed
- New team member added
- Billing alerts

## Slash Commands

Use these commands in Slack:

\`\`\`
/acme status              # Check project status
/acme deploy <project>    # Trigger a deployment
/acme logs <project>      # Get recent logs
/acme help                # Show all commands
\`\`\`

> **Info:** Slash commands respect your Acme permissions. You can only deploy projects you have access to.

## Troubleshooting

### Not receiving notifications?

1. Check that the Slack channel is public or Acme is invited
2. Verify notification settings in Acme
3. Check Slack's notification preferences

### Commands not working?

1. Ensure you're logged in to Acme
2. Run \`/acme login\` to re-authenticate
3. Check your permissions for the requested action`,
      },
      {
        id: '2024.1',
        isLatest: false,
        lastUpdated: '2024-07-20',
        content: `Connect Acme to Slack for notifications.

## Setting Up

1. Go to **Settings → Integrations**
2. Find **Slack** and click **Connect**
3. Authorize Acme to access your Slack workspace

## Notifications

Acme will send notifications for:

- Deployment started
- Deployment completed
- Deployment failed

> **Info:** Slash commands are available in version 2024.2+`,
      },
    ],
  },
  {
    id: 'webhook-setup',
    slug: 'webhook-setup',
    title: 'Webhook Setup',
    description: 'Configure webhooks to receive events from Acme.',
    categoryId: 'integrations',
    categorySlug: 'integrations',
    readingTime: '8 min',
    author: 'Acme Team',
    tags: ['webhooks', 'api', 'events'],
    relatedArticles: ['slack-integration', 'api-overview'],
    versions: [
      {
        id: '2024.2',
        isLatest: true,
        lastUpdated: '2024-12-01',
        content: `Webhooks allow you to receive real-time notifications when events occur in Acme.

## Creating a Webhook

1. Go to **Settings → Webhooks**
2. Click **Add Webhook**
3. Enter your endpoint URL
4. Select the events to subscribe to
5. Click **Create**

## Event Types

- \`deployment.started\` - A deployment has begun
- \`deployment.completed\` - A deployment finished successfully
- \`deployment.failed\` - A deployment failed
- \`project.created\` - A new project was created
- \`team.member_added\` - A new team member joined

## Webhook Payload

\`\`\`json
{
  "id": "evt_123abc",
  "type": "deployment.completed",
  "created_at": "2024-12-01T10:30:00Z",
  "data": {
    "project_id": "proj_abc",
    "deployment_id": "dep_xyz",
    "status": "success",
    "url": "https://my-project.acme.app"
  }
}
\`\`\`

## Verifying Webhooks

We sign all webhook requests with a secret. Verify like this:

\`\`\`javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
\`\`\`

> **Warning:** Always verify webhook signatures to ensure requests are from Acme!`,
      },
    ],
  },

  // API
  {
    id: 'api-overview',
    slug: 'overview',
    title: 'API Overview',
    description: 'Introduction to the Acme REST API.',
    categoryId: 'api',
    categorySlug: 'api',
    readingTime: '5 min',
    author: 'Acme Team',
    tags: ['api', 'rest', 'authentication'],
    relatedArticles: ['api-authentication', 'api-projects'],
    versions: [
      {
        id: '2024.2',
        isLatest: true,
        lastUpdated: '2024-11-25',
        content: `The Acme REST API allows you to programmatically manage your projects and deployments.

## Base URL

All API requests should be made to:

\`\`\`
https://api.acme.com/v1
\`\`\`

## Authentication

Include your API key in the Authorization header:

\`\`\`bash
curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://api.acme.com/v1/projects
\`\`\`

## Response Format

All responses are JSON:

\`\`\`json
{
  "data": { ... },
  "meta": {
    "request_id": "req_abc123"
  }
}
\`\`\`

## Error Handling

Errors include a code and message:

\`\`\`json
{
  "error": {
    "code": "not_found",
    "message": "Project not found",
    "status": 404
  }
}
\`\`\`

## Rate Limits

- **Free** - 60 requests/minute
- **Pro** - 600 requests/minute
- **Enterprise** - 6000 requests/minute

> **Info:** Rate limit headers are included in every response: \`X-RateLimit-Remaining\` and \`X-RateLimit-Reset\`.

## SDKs

We provide official SDKs:

**JavaScript:**

\`\`\`bash
npm install @acme/sdk
\`\`\`

\`\`\`javascript
import { Acme } from '@acme/sdk';

const acme = new Acme({ apiKey: 'YOUR_API_KEY' });
const projects = await acme.projects.list();
\`\`\`

**Python:**

\`\`\`bash
pip install acme-sdk
\`\`\`

\`\`\`python
from acme import Acme

acme = Acme(api_key="YOUR_API_KEY")
projects = acme.projects.list()
\`\`\``,
      },
    ],
  },
  {
    id: 'api-authentication',
    slug: 'authentication',
    title: 'API Authentication',
    description: 'How to authenticate with the Acme API.',
    categoryId: 'api',
    categorySlug: 'api',
    readingTime: '4 min',
    author: 'Acme Team',
    tags: ['api', 'authentication', 'api-keys'],
    relatedArticles: ['api-overview', 'security-settings'],
    versions: [
      {
        id: '2024.2',
        isLatest: true,
        lastUpdated: '2024-10-30',
        content: `Learn how to authenticate your API requests.

## API Keys

Create API keys in your account settings:

1. Go to **Settings → API Keys**
2. Click **Create Key**
3. Give it a name (e.g., "Production Server")
4. Copy the key immediately (it won't be shown again!)

> **Warning:** Treat API keys like passwords. Never commit them to version control or expose them in client-side code.

## Using API Keys

Include your key in the Authorization header:

\`\`\`bash
curl -H "Authorization: Bearer sk_live_abc123..." \\
  https://api.acme.com/v1/projects
\`\`\`

## Key Types

- **Live** (\`sk_live_\`) - Production access
- **Test** (\`sk_test_\`) - Development/testing

## Key Permissions

When creating a key, you can restrict its permissions:

- **Read only** - Can only GET resources
- **Write** - Can create and update resources
- **Full access** - All operations including delete

## Revoking Keys

If a key is compromised:

1. Go to **Settings → API Keys**
2. Find the key
3. Click **Revoke**

The key will be immediately invalidated.`,
      },
    ],
  },

  // Troubleshooting
  {
    id: 'deployment-failed',
    slug: 'deployment-failed',
    title: 'Deployment Failed',
    description: 'Common reasons deployments fail and how to fix them.',
    categoryId: 'troubleshooting',
    categorySlug: 'troubleshooting',
    readingTime: '6 min',
    author: 'Acme Team',
    tags: ['deployment', 'errors', 'troubleshooting'],
    relatedArticles: ['build-errors', 'logs'],
    versions: [
      {
        id: '2024.2',
        isLatest: true,
        lastUpdated: '2024-11-20',
        content: `Your deployment didn't complete? Here's how to diagnose and fix common issues.

## Check the Logs

First, check your deployment logs:

\`\`\`bash
acme logs --deployment latest
\`\`\`

Or in the dashboard: **Project → Deployments → Click the failed deployment**

## Common Issues

### Build command failed

**Symptom:** Error during the build step

**Solutions:**

1. Check that your build command works locally
2. Verify all dependencies are in \`package.json\`
3. Check for missing environment variables

### Out of memory

**Symptom:** Process killed during build

**Solutions:**

1. Upgrade to a larger build instance
2. Optimize your build process
3. Add \`NODE_OPTIONS=--max_old_space_size=4096\`

### Port already in use

**Symptom:** EADDRINUSE error

**Solutions:**

1. Make sure your app uses \`process.env.PORT\`
2. Don't hardcode port numbers

### Missing environment variables

**Symptom:** "Cannot read property of undefined"

**Solutions:**

1. Check your environment variables are set in Acme
2. Use \`acme env list\` to verify
3. Remember: local \`.env\` files are not deployed

## Still Stuck?

> **Info:** Contact support with your deployment ID and we'll help you debug.`,
      },
    ],
  },
  {
    id: 'slow-performance',
    slug: 'slow-performance',
    title: 'Slow Performance',
    description: 'Diagnose and fix performance issues with your deployment.',
    categoryId: 'troubleshooting',
    categorySlug: 'troubleshooting',
    readingTime: '7 min',
    author: 'Acme Team',
    tags: ['performance', 'optimization', 'troubleshooting'],
    relatedArticles: ['deployment-failed', 'monitoring'],
    versions: [
      {
        id: '2024.2',
        isLatest: true,
        lastUpdated: '2024-10-25',
        content: `Is your application running slowly? Here's how to identify and fix performance issues.

## Check Metrics

View your performance metrics in the dashboard:

1. Go to your project
2. Click **Analytics**
3. Check **Response Time** and **CPU Usage**

## Common Causes

### Cold Starts

Serverless functions may have cold starts. Solutions:

- Enable "Always On" in project settings (Pro plan)
- Optimize your function initialization
- Reduce bundle size

### Database Queries

Slow queries are a common bottleneck:

\`\`\`javascript
// Bad: N+1 query
for (const user of users) {
  const posts = await db.posts.findMany({ userId: user.id });
}

// Good: Single query with join
const usersWithPosts = await db.users.findMany({
  include: { posts: true }
});
\`\`\`

### Large Responses

Sending too much data:

- Paginate large lists
- Use GraphQL to fetch only needed fields
- Enable gzip compression

## Performance Tips

> **Tip:** Enable caching headers for static assets to reduce server load and improve load times.

\`\`\`javascript
// Example: Cache static assets for 1 year
res.setHeader('Cache-Control', 'public, max-age=31536000');
\`\`\``,
      },
    ],
  },
];

export function getArticleBySlug(categorySlug: string, slug: string): MockArticle | undefined {
  return MOCK_ARTICLES.find(a => a.categorySlug === categorySlug && a.slug === slug);
}

export function getArticlesByCategory(categorySlug: string): MockArticle[] {
  return MOCK_ARTICLES.filter(a => a.categorySlug === categorySlug);
}

export function getArticleContent(article: MockArticle, versionId?: string): ArticleVersion {
  if (versionId) {
    const version = article.versions.find(v => v.id === versionId);
    if (version) return version;
  }
  // Default to latest
  return article.versions.find(v => v.isLatest) || article.versions[0];
}
