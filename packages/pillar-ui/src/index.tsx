// Main entry point for @pillar/ui package
import "./styles.css";

// Export SourcesCard components
export { SourcesCard } from "./sources-card/SourcesCard";
export type { SourcesCardProps } from "./sources-card/SourcesCard";
export { default as SourcesCardOpenAi } from "./sources-card/SourcesCardOpenAi";
export type { Source } from "./sources-card/types";

// Export ProductCard components
export { ProductCard } from "./product-card/ProductCard";
export type { ProductCardProps } from "./product-card/ProductCard";
export { default as ProductCardOpenAi } from "./product-card/ProductCardOpenAi";
export type { Product } from "./product-card/types";

// Export shared hooks
export {
  useDisplayMode,
  useOpenAiGlobal,
  useTheme,
  useToolInput,
  useToolOutput,
  useWidgetState,
} from "./sources-card/hooks";
