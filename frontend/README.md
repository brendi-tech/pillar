# Pillar Help Center

A Next.js 15 app for customer-facing help centers. Multi-tenant, customizable, and AI-powered.

## Features

- **Multi-tenant architecture** - Single deployment serves multiple customer help centers via custom domains
- **Two layout modes** - Cards (Intercom-style) or Sidebar (Mintlify-style)
- **AI Assistant** - Slide-out panel for conversational help
- **Instant search** - As-you-type search with keyboard shortcuts (Cmd+K)
- **MDX rendering** - Rich article content with syntax highlighting
- **Dark mode** - Full dark mode support
- **Customer theming** - CSS variables for custom branding

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Development

```bash
# Install dependencies
npm install

# Start development server (runs on port 3001)
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) to view the help center.

### Building

```bash
# Build for production
npm run build

# Start production server
npm run start

# Type check
npm run type-check
```

## Project Structure

```
help-center/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Home page
│   ├── not-found.tsx           # 404 page
│   ├── [category]/
│   │   ├── page.tsx            # Category listing
│   │   └── [slug]/page.tsx     # Article page
│   ├── search/page.tsx         # Search results
│   └── api/
│       ├── search/route.ts     # Search endpoint
│       ├── answer/route.ts     # AI answer endpoint
│       ├── feedback/route.ts   # Article feedback
│       └── config/route.ts     # Customer config
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── layout/                 # Header, Footer, Sidebar, Breadcrumb
│   ├── home/                   # SearchHero, CategoryGrid, CategoryList
│   ├── article/                # ArticleHeader, ArticleContent, TOC
│   ├── search/                 # SearchBar, SearchResults
│   └── ai/                     # AssistantPanel, ChatInput, ChatMessage
├── hooks/
│   ├── use-customer.tsx        # Customer context provider
│   ├── use-assistant.tsx       # AI panel state
│   └── use-search.tsx          # Search state
├── lib/
│   ├── api.ts                  # Pillar API client (stubbed)
│   ├── config.ts               # Customer config loader
│   └── utils.ts                # Utilities
├── types/
│   └── index.ts                # TypeScript definitions
└── middleware.ts               # Multi-tenant routing
```

## Configuration

Help centers are configured via the `HelpCenterConfig` type. Key options include:

### Branding

```typescript
branding: {
  name: 'Help Center',
  logo: { light: '/logo.svg', dark: '/logo-dark.svg', height: 32 },
  favicon: '/favicon.ico',
}
```

### Layout

```typescript
layout: {
  style: 'cards' | 'sidebar',
  cards: {
    columnsDesktop: 2 | 3 | 4,
    showArticleCount: true,
    showCategoryIcons: true,
  }
}
```

### AI Assistant

```typescript
aiAssistant: {
  enabled: true,
  name: 'Ask AI',
  welcomeMessage: 'Hi! How can I help?',
  suggestedQuestions: ['How do I get started?', ...],
}
```

## API Integration

Currently uses demo data. To connect to Pillar backend:

1. Set `PILLAR_API_URL` environment variable
2. Update `lib/api.ts` to make real API calls
3. Update `lib/config.ts` to fetch customer configuration

## Development Notes

### Multi-tenancy

Customer identification happens in `middleware.ts` via hostname detection:
- `localhost:3001` → demo customer
- `help.acme.com` → acme customer
- `support.widget.co` → widgetco customer

### Theming

CSS variables are injected dynamically from customer config. Override in `app/globals.css`:

```css
:root {
  --hc-primary: #0066FF;
  --hc-background: #FFFFFF;
  /* ... */
}
```

## Future Phases

- [ ] Getting Started section
- [ ] Tutorials with auto-screenshots
- [ ] Versioning system
- [ ] Multi-product handling
- [ ] Multi-language support
- [ ] Dashboard integration
- [ ] Custom domains

## License

Proprietary - Pillar
