/**
 * Type definitions for ProductCard component
 */

// Re-export OpenAI types from sources-card to ensure Window augmentation is available
import type {} from "../sources-card/types";

/**
 * Product variant information
 */
export interface ProductVariant {
  title: string;
  price: string | null;
  available: boolean;
  inventory: number | null;
}

/**
 * Price range information
 */
export interface PriceRange {
  min: number | null;
  max: number | null;
  currency: string;
  display: string;
}

/**
 * Product information from Shopify
 */
export interface Product {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  description: string;
  image_url: string | null;
  price_range: PriceRange;
  available_for_sale: boolean;
  total_inventory: number | null;
  variant_count: number;
  product_url: string | null;
  tags: string[];
  variants: ProductVariant[];
}

/**
 * Tool output structure for products
 */
export interface ProductToolOutput {
  products: Product[];
  query?: string | null;
  total: number;
}

