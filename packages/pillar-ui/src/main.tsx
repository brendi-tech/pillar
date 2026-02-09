import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ProductCard } from "./product-card/ProductCard";
import type { Product } from "./product-card/types";
import { SourcesCard } from "./sources-card/SourcesCard";
import type { Source } from "./sources-card/types";
import "./styles.css";

// Sample product data
const sampleProducts: Product[] = [
  {
    id: "1",
    title: "Classic Leather Backpack",
    handle: "classic-leather-backpack",
    vendor: "Heritage Goods",
    product_type: "Backpack",
    description:
      "A timeless leather backpack handcrafted from premium materials",
    image_url:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=300&fit=crop",
    price_range: {
      min: 149.99,
      max: 149.99,
      currency: "USD",
      display: "$149.99",
    },
    available_for_sale: true,
    total_inventory: 45,
    variant_count: 1,
    product_url: "https://example.com/products/classic-leather-backpack",
    tags: ["leather", "backpack", "premium"],
    variants: [
      { title: "Default", price: "149.99", available: true, inventory: 45 },
    ],
  },
  {
    id: "2",
    title: "Minimalist Wallet - Black",
    handle: "minimalist-wallet-black",
    vendor: "Heritage Goods",
    product_type: "Wallet",
    description: "Slim wallet made from genuine leather with RFID protection",
    image_url:
      "https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&h=300&fit=crop",
    price_range: {
      min: 39.99,
      max: 59.99,
      currency: "USD",
      display: "$39.99 - $59.99",
    },
    available_for_sale: true,
    total_inventory: 120,
    variant_count: 3,
    product_url: "https://example.com/products/minimalist-wallet",
    tags: ["wallet", "leather", "minimalist"],
    variants: [
      { title: "Black", price: "39.99", available: true, inventory: 50 },
      { title: "Brown", price: "49.99", available: true, inventory: 40 },
      { title: "Navy", price: "59.99", available: true, inventory: 30 },
    ],
  },
  {
    id: "3",
    title: "Premium Watch Box",
    handle: "premium-watch-box",
    vendor: "Timepiece Co",
    product_type: "Accessories",
    description: "Luxury watch storage case with velvet lining for 6 watches",
    image_url:
      "https://images.unsplash.com/photo-1509048191080-d2984bad6ae5?w=400&h=300&fit=crop",
    price_range: {
      min: 89.99,
      max: 89.99,
      currency: "USD",
      display: "$89.99",
    },
    available_for_sale: false,
    total_inventory: 0,
    variant_count: 1,
    product_url: "https://example.com/products/premium-watch-box",
    tags: ["watches", "storage", "luxury"],
    variants: [
      { title: "Default", price: "89.99", available: false, inventory: 0 },
    ],
  },
  {
    id: "4",
    title: "Wireless Charging Pad",
    handle: "wireless-charging-pad",
    vendor: "TechGear",
    product_type: "Electronics",
    description:
      "Fast wireless charging station compatible with all Qi devices",
    image_url:
      "https://images.unsplash.com/photo-1591290619762-d2cfbf8f39ed?w=400&h=300&fit=crop",
    price_range: {
      min: 29.99,
      max: 29.99,
      currency: "USD",
      display: "$29.99",
    },
    available_for_sale: true,
    total_inventory: 200,
    variant_count: 1,
    product_url: "https://example.com/products/wireless-charging-pad",
    tags: ["electronics", "charging", "wireless"],
    variants: [
      { title: "Default", price: "29.99", available: true, inventory: 200 },
    ],
  },
];

// Sample source data
const sampleSources: Source[] = [
  {
    title: "The Complete Guide to Leather Care and Maintenance",
    url: "https://www.leathercareguide.com/maintenance-tips",
    type: "page",
    source_type: "web",
    score: 0.95,
    citation_number: 1,
  },
  {
    title: "How to Choose the Perfect Backpack for Travel",
    url: "https://www.travelgear.com/backpack-buying-guide",
    type: "page",
    source_type: "web",
    score: 0.89,
    citation_number: 2,
  },
  {
    title: "RFID Protection Technology Explained",
    url: "https://www.securitytech.com/rfid-protection",
    type: "page",
    source_type: "web",
    score: 0.87,
    citation_number: 3,
  },
  {
    title: "Product Specifications Document",
    url: null,
    type: "document",
    source_type: "upload",
    score: 0.92,
    citation_number: 4,
  },
  {
    title: "Best Practices for Wireless Charging Safety",
    url: "https://www.techsafety.org/wireless-charging",
    type: "page",
    source_type: "web",
    score: 0.84,
    citation_number: 5,
  },
];

function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const handleProductClick = (product: Product) => {
    console.log("Product clicked:", product);
    if (product.product_url) {
      window.open(product.product_url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className={`min-h-screen ${
        theme === "dark" ? "bg-zinc-950" : "bg-gray-50"
      }`}
    >
      {/* Theme Toggle */}
      <div
        className="sticky top-0 z-10 border-b backdrop-blur-sm bg-opacity-90"
        style={{
          backgroundColor:
            theme === "dark"
              ? "rgba(9, 9, 11, 0.9)"
              : "rgba(249, 250, 251, 0.9)",
          borderColor:
            theme === "dark" ? "rgb(39, 39, 42)" : "rgb(229, 231, 235)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1
            className={`text-2xl font-bold ${
              theme === "dark" ? "text-zinc-50" : "text-zinc-900"
            }`}
          >
            Pillar UI Components
          </h1>
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className={`
              px-4 py-2 rounded-lg font-medium transition-colors
              ${
                theme === "dark"
                  ? "bg-zinc-800 text-zinc-50 hover:bg-zinc-700"
                  : "bg-white text-zinc-900 hover:bg-gray-100 border border-gray-200"
              }
            `}
          >
            {theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-12">
        {/* Introduction */}
        <div className={`prose ${theme === "dark" ? "prose-invert" : ""}`}>
          <p
            className={`text-lg ${
              theme === "dark" ? "text-zinc-300" : "text-zinc-600"
            }`}
          >
            This showcase demonstrates the ProductCard and SourcesCard
            components from the @pillar/ui package. Toggle between light and
            dark themes to see how the components adapt.
          </p>
        </div>

        {/* ProductCard Examples */}
        <section>
          <div
            className={`mb-6 pb-4 border-b ${
              theme === "dark" ? "border-zinc-800" : "border-gray-200"
            }`}
          >
            <h2
              className={`text-xl font-bold mb-2 ${
                theme === "dark" ? "text-zinc-50" : "text-zinc-900"
              }`}
            >
              ProductCard Component
            </h2>
            <p
              className={`text-sm ${
                theme === "dark" ? "text-zinc-400" : "text-zinc-600"
              }`}
            >
              Displays Shopify products in a responsive grid with product
              details, images, pricing, and availability. Click on any product
              card to visit its product page.
            </p>
          </div>

          <div
            className={`rounded-xl border ${
              theme === "dark"
                ? "border-zinc-800 bg-zinc-900"
                : "border-gray-200 bg-white"
            }`}
          >
            <ProductCard
              products={sampleProducts}
              theme={theme}
              onProductClick={handleProductClick}
            />
          </div>
        </section>

        {/* SourcesCard Examples */}
        <section>
          <div
            className={`mb-6 pb-4 border-b ${
              theme === "dark" ? "border-zinc-800" : "border-gray-200"
            }`}
          >
            <h2
              className={`text-xl font-bold mb-2 ${
                theme === "dark" ? "text-zinc-50" : "text-zinc-900"
              }`}
            >
              SourcesCard Component
            </h2>
            <p
              className={`text-sm ${
                theme === "dark" ? "text-zinc-400" : "text-zinc-600"
              }`}
            >
              Displays source citations with favicons, titles, and domain
              information. Supports both web pages and uploaded documents. Click
              on any source to open it in a new tab.
            </p>
          </div>

          <div
            className={`rounded-xl border ${
              theme === "dark"
                ? "border-zinc-800 bg-zinc-900"
                : "border-gray-200 bg-white"
            }`}
          >
            <SourcesCard sources={sampleSources} theme={theme} />
          </div>
        </section>

        {/* Component Usage Examples */}
        <section>
          <div
            className={`mb-6 pb-4 border-b ${
              theme === "dark" ? "border-zinc-800" : "border-gray-200"
            }`}
          >
            <h2
              className={`text-xl font-bold mb-2 ${
                theme === "dark" ? "text-zinc-50" : "text-zinc-900"
              }`}
            >
              Usage Examples
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div
              className={`p-6 rounded-lg border ${
                theme === "dark"
                  ? "border-zinc-800 bg-zinc-900"
                  : "border-gray-200 bg-white"
              }`}
            >
              <h3
                className={`text-lg font-semibold mb-3 ${
                  theme === "dark" ? "text-zinc-50" : "text-zinc-900"
                }`}
              >
                ProductCard
              </h3>
              <pre
                className={`text-xs overflow-x-auto p-4 rounded ${
                  theme === "dark"
                    ? "bg-zinc-950 text-zinc-300"
                    : "bg-gray-50 text-zinc-700"
                }`}
              >
                {`import { ProductCard } from '@pillar/ui';

<ProductCard
  products={products}
  theme="light"
  onProductClick={(product) => {
    console.log('Clicked:', product);
  }}
/>`}
              </pre>
            </div>

            <div
              className={`p-6 rounded-lg border ${
                theme === "dark"
                  ? "border-zinc-800 bg-zinc-900"
                  : "border-gray-200 bg-white"
              }`}
            >
              <h3
                className={`text-lg font-semibold mb-3 ${
                  theme === "dark" ? "text-zinc-50" : "text-zinc-900"
                }`}
              >
                SourcesCard
              </h3>
              <pre
                className={`text-xs overflow-x-auto p-4 rounded ${
                  theme === "dark"
                    ? "bg-zinc-950 text-zinc-300"
                    : "bg-gray-50 text-zinc-700"
                }`}
              >
                {`import { SourcesCard } from '@pillar/ui';

<SourcesCard
  sources={sources}
  theme="dark"
/>`}
              </pre>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer
          className={`text-center text-sm pt-8 border-t ${
            theme === "dark"
              ? "text-zinc-500 border-zinc-800"
              : "text-zinc-500 border-gray-200"
          }`}
        >
          <p>
            @pillar/ui component showcase • Built with React + TypeScript +
            Tailwind CSS
          </p>
        </footer>
      </div>
    </div>
  );
}

// Mount the app
const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
