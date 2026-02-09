/**
 * Mock Tutorials with Step-by-Step Progress
 */

export interface TutorialStep {
  id: string;
  order: number;
  title: string;
  content: string;
  screenshot?: {
    url: string;
    alt: string;
    caption?: string;
  };
  callout?: {
    type: 'info' | 'warning' | 'tip';
    content: string;
  };
}

export interface MockTutorial {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  thumbnail: string;
  category: string;
  tags: string[];
  steps: TutorialStep[];
  prerequisites?: string[];
  nextTutorial?: string;
}

export const MOCK_TUTORIALS: MockTutorial[] = [
  {
    id: 'first-project',
    slug: 'first-project',
    title: 'Create Your First Project',
    description: 'Learn how to create, configure, and deploy your first Acme project from scratch.',
    difficulty: 'beginner',
    estimatedTime: '10 min',
    thumbnail: '/images/tutorials/first-project.png',
    category: 'getting-started',
    tags: ['quickstart', 'deployment', 'basics'],
    nextTutorial: 'custom-domain',
    steps: [
      {
        id: 'step-1',
        order: 1,
        title: 'Install the Acme CLI',
        content: `First, you'll need to install the Acme CLI on your computer.

Open your terminal and run:

\`\`\`bash
npm install -g @acme/cli
\`\`\`

Verify the installation:

\`\`\`bash
acme --version
\`\`\`

You should see the version number printed.`,
        screenshot: {
          url: 'https://placehold.co/800x450/1a1a2e/ffffff?text=Terminal+with+acme+--version',
          alt: 'Terminal showing acme CLI version',
          caption: 'The CLI should show the current version number',
        },
        callout: {
          type: 'tip',
          content: 'If you get a permission error, try running with sudo or fix your npm permissions.',
        },
      },
      {
        id: 'step-2',
        order: 2,
        title: 'Log in to your account',
        content: `Authenticate with your Acme account:

\`\`\`bash
acme login
\`\`\`

This will open a browser window where you can log in. Once authenticated, you'll see a success message in your terminal.`,
        screenshot: {
          url: 'https://placehold.co/800x450/1a1a2e/ffffff?text=Browser+Login+Screen',
          alt: 'Acme login screen in browser',
          caption: 'Log in with your email or SSO provider',
        },
      },
      {
        id: 'step-3',
        order: 3,
        title: 'Create a new project',
        content: `Now let's create your first project. Navigate to where you want to create it and run:

\`\`\`bash
acme init my-first-project
\`\`\`

You'll be asked a few questions:
- **Framework**: Choose your framework (Next.js, React, Vue, etc.)
- **Template**: Select a starter template or blank project
- **Region**: Choose the deployment region closest to your users`,
        screenshot: {
          url: 'https://placehold.co/800x450/1a1a2e/ffffff?text=acme+init+prompts',
          alt: 'CLI prompts for project creation',
          caption: 'Answer the prompts to configure your project',
        },
      },
      {
        id: 'step-4',
        order: 4,
        title: 'Explore the project structure',
        content: `Navigate into your new project:

\`\`\`bash
cd my-first-project
\`\`\`

You'll see the following structure:

\`\`\`
my-first-project/
├── acme.config.js    # Acme configuration
├── package.json      # Dependencies
├── src/              # Your source code
└── public/           # Static assets
\`\`\`

The \`acme.config.js\` file contains your deployment settings.`,
        callout: {
          type: 'info',
          content: 'The project structure may vary depending on the framework you chose.',
        },
      },
      {
        id: 'step-5',
        order: 5,
        title: 'Run locally',
        content: `Before deploying, let's make sure everything works locally:

\`\`\`bash
npm install
npm run dev
\`\`\`

Open http://localhost:3000 in your browser to see your app running.`,
        screenshot: {
          url: 'https://placehold.co/800x450/1a1a2e/ffffff?text=Local+Dev+Server',
          alt: 'Application running locally',
          caption: 'Your app running on localhost',
        },
      },
      {
        id: 'step-6',
        order: 6,
        title: 'Deploy to production',
        content: `Ready to go live? Deploy with a single command:

\`\`\`bash
acme deploy
\`\`\`

Acme will:
1. Build your project
2. Upload the assets
3. Deploy to the edge network
4. Provide you with a live URL`,
        screenshot: {
          url: 'https://placehold.co/800x450/1a1a2e/ffffff?text=Deployment+Success',
          alt: 'Successful deployment output',
          caption: 'Your deployment URL will be shown when complete',
        },
        callout: {
          type: 'tip',
          content: 'Bookmark your deployment URL! It will be something like my-first-project.acme.app',
        },
      },
      {
        id: 'step-7',
        order: 7,
        title: 'View your live site',
        content: `Congratulations! Your site is now live. 

Click the URL in your terminal or visit it in your browser. You should see your application running on Acme's global edge network.

**What's next?**
- Set up a custom domain
- Configure environment variables
- Invite your team`,
        screenshot: {
          url: 'https://placehold.co/800x450/1a1a2e/ffffff?text=Live+Site',
          alt: 'Live site on Acme',
          caption: 'Your site is now live on the internet!',
        },
      },
    ],
  },
  {
    id: 'custom-domain',
    slug: 'custom-domain',
    title: 'Set Up a Custom Domain',
    description: 'Connect your own domain name to your Acme project.',
    difficulty: 'intermediate',
    estimatedTime: '8 min',
    thumbnail: '/images/tutorials/custom-domain.png',
    category: 'getting-started',
    tags: ['domain', 'dns', 'ssl'],
    prerequisites: ['first-project'],
    nextTutorial: 'first-integration',
    steps: [
      {
        id: 'step-1',
        order: 1,
        title: 'Open project settings',
        content: `Navigate to your project in the Acme dashboard:

1. Click on your project name
2. Go to **Settings**
3. Click **Domains**`,
        screenshot: {
          url: 'https://placehold.co/800x450/1a1a2e/ffffff?text=Project+Settings',
          alt: 'Project settings page',
          caption: 'Find the Domains section in Settings',
        },
      },
      {
        id: 'step-2',
        order: 2,
        title: 'Add your domain',
        content: `Click **Add Domain** and enter your domain name:

- For the root domain, enter: \`example.com\`
- For a subdomain, enter: \`app.example.com\`

Click **Add** to continue.`,
        callout: {
          type: 'info',
          content: 'You can add multiple domains to the same project.',
        },
      },
      {
        id: 'step-3',
        order: 3,
        title: 'Configure DNS records',
        content: `Acme will show you the DNS records to add. Go to your domain registrar and add:

**For root domain (example.com):**
\`\`\`
Type: A
Name: @
Value: 76.76.21.21
\`\`\`

**For subdomain (app.example.com):**
\`\`\`
Type: CNAME
Name: app
Value: cname.acme.app
\`\`\``,
        screenshot: {
          url: 'https://placehold.co/800x450/1a1a2e/ffffff?text=DNS+Configuration',
          alt: 'DNS configuration screen',
          caption: 'Add these records at your DNS provider',
        },
        callout: {
          type: 'warning',
          content: 'DNS changes can take up to 48 hours to propagate, but usually complete within an hour.',
        },
      },
      {
        id: 'step-4',
        order: 4,
        title: 'Verify domain ownership',
        content: `Once you've added the DNS records, click **Verify** in the Acme dashboard.

If the records are properly configured, you'll see a green checkmark.`,
      },
      {
        id: 'step-5',
        order: 5,
        title: 'SSL certificate',
        content: `Acme automatically provisions an SSL certificate for your domain.

This usually takes 1-2 minutes after verification. Once complete, your site will be accessible via HTTPS.`,
        callout: {
          type: 'tip',
          content: 'Acme uses Let\'s Encrypt certificates that auto-renew every 90 days.',
        },
      },
      {
        id: 'step-6',
        order: 6,
        title: 'Test your domain',
        content: `Visit your custom domain in a browser:

\`\`\`
https://example.com
\`\`\`

You should see your Acme project! The SSL certificate should show as valid.`,
        screenshot: {
          url: 'https://placehold.co/800x450/1a1a2e/ffffff?text=Custom+Domain+Live',
          alt: 'Site on custom domain',
          caption: 'Your site is now live on your custom domain with HTTPS',
        },
      },
    ],
  },
  {
    id: 'first-integration',
    slug: 'first-integration',
    title: 'Set Up Your First Integration',
    description: 'Connect Acme with Slack to receive deployment notifications.',
    difficulty: 'intermediate',
    estimatedTime: '6 min',
    thumbnail: '/images/tutorials/integration.png',
    category: 'integrations',
    tags: ['slack', 'integration', 'notifications'],
    prerequisites: ['first-project'],
    steps: [
      {
        id: 'step-1',
        order: 1,
        title: 'Open integrations settings',
        content: `Go to your workspace settings:

1. Click your workspace name in the top left
2. Select **Settings**
3. Click **Integrations**`,
        screenshot: {
          url: 'https://placehold.co/800x450/1a1a2e/ffffff?text=Integrations+Page',
          alt: 'Integrations settings page',
          caption: 'Find Slack in the integrations list',
        },
      },
      {
        id: 'step-2',
        order: 2,
        title: 'Connect Slack',
        content: `Find **Slack** in the list and click **Connect**.

You'll be redirected to Slack to authorize the connection. Make sure you're logged into the correct Slack workspace.`,
      },
      {
        id: 'step-3',
        order: 3,
        title: 'Choose a channel',
        content: `Select which Slack channel should receive notifications.

You can create a dedicated channel like \`#deployments\` or use an existing one.`,
        callout: {
          type: 'tip',
          content: 'Using a dedicated channel keeps deployment notifications organized and easy to find.',
        },
      },
      {
        id: 'step-4',
        order: 4,
        title: 'Configure notifications',
        content: `Choose which events trigger Slack notifications:

- ✅ Deployment started
- ✅ Deployment completed
- ✅ Deployment failed
- ☐ New team member added
- ☐ Billing alerts

Click **Save** when done.`,
        screenshot: {
          url: 'https://placehold.co/800x450/1a1a2e/ffffff?text=Notification+Settings',
          alt: 'Notification configuration',
          caption: 'Select the events you want to be notified about',
        },
      },
      {
        id: 'step-5',
        order: 5,
        title: 'Test the integration',
        content: `Let's verify it works! Trigger a test notification:

1. Click **Test Connection**
2. Check your Slack channel

You should see a test message from Acme.`,
        screenshot: {
          url: 'https://placehold.co/800x450/1a1a2e/ffffff?text=Slack+Notification',
          alt: 'Slack notification from Acme',
          caption: 'A test notification in your Slack channel',
        },
      },
      {
        id: 'step-6',
        order: 6,
        title: 'Deploy and see it in action',
        content: `Now deploy a change and watch the notification appear:

\`\`\`bash
acme deploy
\`\`\`

Check your Slack channel - you should see notifications for deployment started and completed.

**Congratulations!** You've connected your first integration.`,
      },
    ],
  },
  {
    id: 'api-basics',
    slug: 'api-basics',
    title: 'Getting Started with the API',
    description: 'Learn the basics of using the Acme REST API.',
    difficulty: 'advanced',
    estimatedTime: '15 min',
    thumbnail: '/images/tutorials/api.png',
    category: 'api',
    tags: ['api', 'authentication', 'rest'],
    prerequisites: ['first-project'],
    steps: [
      {
        id: 'step-1',
        order: 1,
        title: 'Create an API key',
        content: `First, create an API key for authentication:

1. Go to **Settings → API Keys**
2. Click **Create Key**
3. Name it something descriptive like "Tutorial Key"
4. Copy the key immediately!`,
        screenshot: {
          url: 'https://placehold.co/800x450/1a1a2e/ffffff?text=Create+API+Key',
          alt: 'API key creation',
          caption: 'Copy your key - you won\'t be able to see it again!',
        },
        callout: {
          type: 'warning',
          content: 'Store your API key securely. Never commit it to version control.',
        },
      },
      {
        id: 'step-2',
        order: 2,
        title: 'Make your first request',
        content: `Let's test the API by listing your projects. Open a terminal and run:

\`\`\`bash
curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://api.acme.com/v1/projects
\`\`\`

Replace \`YOUR_API_KEY\` with the key you just created.`,
      },
      {
        id: 'step-3',
        order: 3,
        title: 'Understand the response',
        content: `The API returns JSON. Here's what a project response looks like:

\`\`\`json
{
  "data": [
    {
      "id": "proj_abc123",
      "name": "my-first-project",
      "created_at": "2024-01-15T10:30:00Z",
      "url": "https://my-first-project.acme.app"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1
  }
}
\`\`\``,
      },
      {
        id: 'step-4',
        order: 4,
        title: 'Create a deployment via API',
        content: `You can trigger deployments programmatically:

\`\`\`bash
curl -X POST \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"branch": "main"}' \\
  https://api.acme.com/v1/projects/proj_abc123/deployments
\`\`\``,
        callout: {
          type: 'tip',
          content: 'This is useful for CI/CD pipelines or custom deployment workflows.',
        },
      },
      {
        id: 'step-5',
        order: 5,
        title: 'Use the JavaScript SDK',
        content: `For a better developer experience, use our SDK:

\`\`\`bash
npm install @acme/sdk
\`\`\`

\`\`\`javascript
import { Acme } from '@acme/sdk';

const acme = new Acme({ 
  apiKey: process.env.ACME_API_KEY 
});

// List projects
const projects = await acme.projects.list();
console.log(projects);

// Create a deployment
const deployment = await acme.deployments.create({
  projectId: 'proj_abc123',
  branch: 'main'
});
\`\`\``,
      },
      {
        id: 'step-6',
        order: 6,
        title: 'Handle errors',
        content: `Always handle API errors gracefully:

\`\`\`javascript
try {
  const project = await acme.projects.get('proj_invalid');
} catch (error) {
  if (error.status === 404) {
    console.log('Project not found');
  } else if (error.status === 401) {
    console.log('Invalid API key');
  } else {
    console.log('Error:', error.message);
  }
}
\`\`\``,
        callout: {
          type: 'info',
          content: 'Check the API reference for a complete list of error codes.',
        },
      },
      {
        id: 'step-7',
        order: 7,
        title: 'Explore more endpoints',
        content: `The API has many more capabilities:

- **Projects**: Create, update, delete projects
- **Deployments**: Trigger, rollback, view logs
- **Domains**: Add and manage custom domains
- **Environment Variables**: Manage secrets
- **Webhooks**: Set up event notifications

Check out the [API Reference](/api/overview) for full documentation.`,
      },
    ],
  },
];

export function getTutorialBySlug(slug: string): MockTutorial | undefined {
  return MOCK_TUTORIALS.find(t => t.slug === slug);
}

export function getTutorialsByCategory(category: string): MockTutorial[] {
  return MOCK_TUTORIALS.filter(t => t.category === category);
}


