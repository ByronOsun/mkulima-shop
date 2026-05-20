import { useState, useEffect } from 'react';
import { CartItem, Product, ReceiptData } from '../types';
import { supabaseService } from '../services/supabase';
import ProductList from '../components/ProductList';
import Cart from '../components/Cart';
import '../styles/POSPage.css';

interface POSPageProps {
  onCheckoutSuccess: (receipt: ReceiptData) => void;
}

export default function POSPage({ onCheckoutSuccess }: POSPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [category, setCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supabaseService.getProducts();
      setProducts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const categoryData = await supabaseService.getCategories();
      if (categoryData) {
        const categoryNames = categoryData.map(c => c.name);
        setCategories(categoryNames);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const addToCart = (product: Product, quantity: number) => {
    const existingItem = cart.find(item => item.productId === product.id);

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity <= product.quantity_in_stock) {
        setCart(cart.map(item =>
          item.productId === product.id
            ? {
                ...item,
                quantity: newQuantity,
                subtotal: newQuantity * item.unit_price,
              }
            : item
        ));
      }
    } else {
      if (quantity <= product.quantity_in_stock) {
        setCart([
          ...cart,
          {
            productId: product.id,
            product,
            quantity,
            unit_price: product.unit_price,
            subtotal: quantity * product.unit_price,
          },
        ]);
      }
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const updateCartItem = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      const product = products.find(p => p.id === productId);
      if (product && quantity <= product.quantity_in_stock) {
        setCart(cart.map(item =>
          item.productId === productId
            ? {
                ...item,
                quantity,
                subtotal: quantity * item.unit_price,
              }
            : item
        ));
      }
    }
  };

  const filteredProducts = category === 'all'
    ? products
    : products.filter(p => p.category === category);

  if (loading) return <div className="page-loader">Loading products...</div>;

  return (
    <div className="pos-page">
      <div className="pos-content">
        <div className="product-section">
          <div className="section-header">
            <h2>Products</h2>
            <div className="category-filter">
              <button
                className={`category-btn ${category === 'all' ? 'active' : ''}`}
                onClick={() => setCategory('all')}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`category-btn ${category === cat ? 'active' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="error-message">{error}</div>}
          <ProductList
            products={filteredProducts}
            onAddToCart={addToCart}
          />
        </div>

        <div className="cart-section">
          <Cart
            items={cart}
            onRemoveItem={removeFromCart}
            onUpdateQuantity={updateCartItem}
            onCheckoutSuccess={onCheckoutSuccess}
          />
        </div>
      </div>
    </div>
  );
}
