/**
 * ProductCardOpenAi - Business logic wrapper for ChatGPT integration
 * Uses the presentational ProductCard component with window.openai hooks
 */
import { ProductCard } from "./ProductCard";
import { useTheme, useToolOutput } from "./hooks";
import { Product, ProductToolOutput } from "./types";

/**
 * ProductCard wrapper for ChatGPT/OpenAI environments
 * Automatically fetches products and theme from window.openai
 */
export function ProductCardOpenAi() {
  // Get data from window.openai
  const toolOutput = useToolOutput<ProductToolOutput>();
  const theme = useTheme();

  const products = toolOutput?.products;

  // Business logic for handling product clicks in ChatGPT environment
  const handleProductClick = (product: Product) => {
    if (product.product_url && window.openai?.openExternal) {
      window.openai.openExternal({ href: product.product_url });
    } else if (product.product_url) {
      // Fallback for non-ChatGPT environments
      window.open(product.product_url, "_blank", "noopener,noreferrer");
    }
  };

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <ProductCard
      products={products}
      theme={theme}
      onProductClick={handleProductClick}
    />
  );
}

export default ProductCardOpenAi;
