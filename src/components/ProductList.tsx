import { useState } from 'react';
import { Product } from '../types';
import '../styles/ProductCard.css';

interface ProductListProps {
  groupedCategories: Array<{
    category: string;
    color: {
      bg: string;
      fg: string;
      accent: string;
    };
    products: Product[];
  }>;
  onAddToCart: (product: Product, quantity: number) => void;
}

const VISIBLE_COUNT = 5;

export default function ProductList({ groupedCategories, onAddToCart }: ProductListProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleAddClick = (product: Product) => {
    // Always add a single unit per click to mimic a single-bar Add to Cart
    if (product.quantity_in_stock > 0) {
      onAddToCart(product, 1);
    }
  };

  if (groupedCategories.length === 0) {
    return (
      <div className="empty-products">
        <p>No products found</p>
      </div>
    );
  }

  return (
    <div className="category-list">
      {groupedCategories.map(group => {
        const isExpanded = expandedCategories.has(group.category);
        const visibleProducts = isExpanded
          ? group.products
          : group.products.slice(0, VISIBLE_COUNT);
        const hiddenCount = group.products.length - VISIBLE_COUNT;

        return (
          <section key={group.category} className="category-section">
            <div
              className="category-header-bar"
              style={{
                background: `linear-gradient(135deg, ${group.color.bg}, ${group.color.accent})`,
                color: group.color.fg,
              }}
            >
              <div className="category-title-wrap">
                <h3 className="category-title">{group.category}</h3>
                <span className="category-count">{group.products.length} products</span>
              </div>
            </div>

            <div className="category-products-list" aria-label={`${group.category} products`}>
              {visibleProducts.map(product => (
                <div
                  key={product.id}
                  className={`product-card ${
                    product.quantity_in_stock === 0 ? 'out-of-stock' : ''
                  }`}
                >
                  {product.image_url && (
                    <div className="product-image">
                      <img src={product.image_url} alt={product.name} />
                    </div>
                  )}
                  <div className="product-info">
                    <h3 className="product-name">{product.name}</h3>
                    <p className="product-sku">SKU: {product.sku}</p>
                    {product.description && (
                      <p className="product-description">{product.description}</p>
                    )}
                  </div>
                  <div className="product-details">
                    <span className="product-price">
                      {new Intl.NumberFormat('en-KE', {
                        style: 'currency',
                        currency: 'KES',
                      }).format(product.unit_price)}
                    </span>
                    <span className={`stock-badge ${
                      product.quantity_in_stock > 5 ? 'in-stock' : 'low-stock'
                    }`}>
                      {product.quantity_in_stock} in stock
                    </span>
                  </div>
                  <div className="product-action">
                    <button
                      className="add-btn"
                      onClick={() => handleAddClick(product)}
                      disabled={product.quantity_in_stock === 0}
                      aria-label={`Add ${product.name} to cart`}
                    >
                      Add to Cart
                    </button>
                  </div>
                  {product.quantity_in_stock === 0 && (
                    <div className="out-of-stock-overlay">Out of Stock</div>
                  )}
                </div>
              ))}
            </div>

            {group.products.length > VISIBLE_COUNT && (
              <button
                type="button"
                className="category-view-toggle"
                onClick={() => toggleCategory(group.category)}
              >
                {isExpanded ? 'View Less' : `View More (${hiddenCount})`}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
