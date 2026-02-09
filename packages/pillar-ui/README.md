# @pillar/ui

UI component library for Pillar - includes ProductCard and SourcesCard components.

## Components

### ProductCard
Displays Shopify products in a responsive grid with product details, images, pricing, and availability.

### SourcesCard
Displays source citations with favicons, titles, and domain information. Supports both web pages and uploaded documents.

## Development

### View Component Showcase

To see live examples of all components with interactive theme switching:

```bash
npm run dev
```

This will start a development server at `http://localhost:3001` showing:
- ProductCard examples with sample products
- SourcesCard examples with sample sources
- Light/Dark theme toggle
- Usage examples

### Build Library

To build the distributable package:

```bash
npm run build
```

This creates:
- ES module bundle in `dist/`
- TypeScript definitions
- Standalone bundles for each component

## Usage

### ProductCard

```tsx
import { ProductCard } from '@pillar/ui';
import type { Product } from '@pillar/ui';

const products: Product[] = [
  {
    id: '1',
    title: 'Example Product',
    handle: 'example-product',
    vendor: 'Example Vendor',
    product_type: 'Example Type',
    description: 'Product description',
    image_url: 'https://example.com/image.jpg',
    price_range: {
      min: 29.99,
      max: 29.99,
      currency: 'USD',
      display: '$29.99'
    },
    available_for_sale: true,
    total_inventory: 100,
    variant_count: 1,
    product_url: 'https://example.com/products/example',
    tags: ['tag1', 'tag2'],
    variants: []
  }
];

function MyComponent() {
  return (
    <ProductCard
      products={products}
      theme="light"
      onProductClick={(product) => {
        console.log('Product clicked:', product);
      }}
    />
  );
}
```

### SourcesCard

```tsx
import { SourcesCard } from '@pillar/ui';
import type { Source } from '@pillar/ui';

const sources: Source[] = [
  {
    title: 'Example Article',
    url: 'https://example.com/article',
    type: 'page',
    source_type: 'web',
    score: 0.95,
    citation_number: 1
  }
];

function MyComponent() {
  return (
    <SourcesCard
      sources={sources}
      theme="dark"
    />
  );
}
```

## Props

### ProductCardProps

- `products`: `Product[]` - Array of products to display
- `theme?`: `'light' | 'dark'` - Theme mode (default: 'light')
- `onProductClick?`: `(product: Product) => void` - Callback when a product is clicked

### SourcesCardProps

- `sources`: `Source[]` - Array of sources to display
- `theme?`: `'light' | 'dark'` - Theme mode (default: 'light')

## License

See LICENSE file in the root of the repository.

