/**
 * ProductCard - Presentational component for displaying Shopify products
 * Pure UI component with no business logic
 */
import "./ProductCard.css";
import { Product } from "./types";

/**
 * Individual product card component
 */
function ProductItem({
  product,
  theme,
  onProductClick,
}: {
  product: Product;
  theme: "light" | "dark";
  onProductClick?: (product: Product) => void;
}) {
  const isDark = theme === "dark";

  const handleClick = () => {
    if (onProductClick) {
      onProductClick(product);
    }
  };

  const imagePlaceholder = `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="%23e5e7eb"%3E%3Crect width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="14" fill="%239ca3af" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E`;

  const itemClasses = [
    "product-item",
    isDark ? "product-item--dark" : "product-item--light",
    onProductClick && product.product_url
      ? "product-item--clickable"
      : "product-item--default",
  ].join(" ");

  const imageContainerClasses = [
    "product-item__image-container",
    isDark
      ? "product-item__image-container--dark"
      : "product-item__image-container--light",
  ].join(" ");

  return (
    <div onClick={handleClick} className={itemClasses}>
      {/* Product Image */}
      <div className={imageContainerClasses}>
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.title}
            className="product-item__image"
            onError={(e) => {
              e.currentTarget.src = imagePlaceholder;
            }}
          />
        ) : (
          <img src={imagePlaceholder} alt="" className="product-item__image" />
        )}
      </div>

      {/* Product Info */}
      <div className="product-item__info">
        {/* Vendor */}
        {product.vendor && (
          <div
            className={`product-item__vendor ${
              isDark
                ? "product-item__vendor--dark"
                : "product-item__vendor--light"
            }`}
          >
            {product.vendor}
          </div>
        )}

        {/* Title */}
        <div
          className={`product-item__title ${
            isDark ? "product-item__title--dark" : "product-item__title--light"
          }`}
        >
          {product.title}
        </div>

        {/* Price */}
        {product.price_range.display && (
          <div
            className={`product-item__price ${
              isDark
                ? "product-item__price--dark"
                : "product-item__price--light"
            }`}
          >
            {product.price_range.display}
          </div>
        )}

        {/* Availability */}
        <div className="product-item__availability">
          {product.available_for_sale ? (
            <div className="product-item__availability-status product-item__availability-status--available">
              Available
            </div>
          ) : (
            <div
              className={`product-item__availability-status ${
                isDark
                  ? "product-item__availability-status--unavailable-dark"
                  : "product-item__availability-status--unavailable-light"
              }`}
            >
              Out of Stock
            </div>
          )}
          {product.variant_count > 1 && (
            <div
              className={`product-item__variant-count ${
                isDark
                  ? "product-item__variant-count--dark"
                  : "product-item__variant-count--light"
              }`}
            >
              {product.variant_count} variants
            </div>
          )}
        </div>

        {/* Product Type */}
        {product.product_type && (
          <div
            className={`product-item__type ${
              isDark ? "product-item__type--dark" : "product-item__type--light"
            }`}
          >
            {product.product_type}
          </div>
        )}

        {/* View Product Link */}
        {product.product_url && (
          <div
            className={`product-item__link ${
              isDark ? "product-item__link--dark" : "product-item__link--light"
            }`}
          >
            View Product →
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Main ProductCard component - Pure presentational component
 * Requires products and theme to be passed as props
 */
export interface ProductCardProps {
  products: Product[];
  theme?: "light" | "dark";
  onProductClick?: (product: Product) => void;
}

export function ProductCard({
  products,
  theme = "light",
  onProductClick,
}: ProductCardProps) {
  if (!products || products.length === 0) {
    return null;
  }

  const isDark = theme === "dark";

  return (
    <div className="product-card">
      <h3
        className={`product-card__title ${
          isDark ? "product-card__title--dark" : "product-card__title--light"
        }`}
      >
        Products
      </h3>

      <div className="product-card__grid">
        {products.map((product) => (
          <ProductItem
            key={product.id}
            product={product}
            theme={theme}
            onProductClick={onProductClick}
          />
        ))}
      </div>
    </div>
  );
}

export default ProductCard;
