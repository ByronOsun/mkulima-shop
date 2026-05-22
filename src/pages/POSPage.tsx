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
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMobileCart, setShowMobileCart] = useState(false);

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

  const handleCheckoutSuccess = (receipt: ReceiptData) => {
    setShowMobileCart(false);
    onCheckoutSuccess(receipt);
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const searchedProducts = products.filter(product => {
    if (!normalizedSearch) return true;
    return [product.name, product.sku, product.description, product.category]
      .filter(Boolean)
      .some(value => value!.toLowerCase().includes(normalizedSearch));
  });

  const orderedCategories = [
    ...categories,
    ...Array.from(new Set(searchedProducts.map(product => product.category).filter(Boolean))),
  ].filter((value, index, array) => array.indexOf(value) === index);

  const categoryColors = [
    { bg: '#1f2937', fg: '#ffffff', accent: '#60a5fa' },
    { bg: '#14532d', fg: '#ffffff', accent: '#4ade80' },
    { bg: '#7c2d12', fg: '#ffffff', accent: '#fb923c' },
    { bg: '#4c1d95', fg: '#ffffff', accent: '#c084fc' },
    { bg: '#0f766e', fg: '#ffffff', accent: '#5eead4' },
    { bg: '#334155', fg: '#ffffff', accent: '#facc15' },
  ];

  const groupedCategories = orderedCategories
    .map((categoryName, index) => ({
      category: categoryName,
      color: categoryColors[index % categoryColors.length],
      products: searchedProducts.filter(product => product.category === categoryName),
    }))
    .filter(group => group.products.length > 0);

  if (loading) return <div className="page-loader">Loading products...</div>;

  if (showMobileCart) {
    return (
      <div className="pos-page pos-mobile-cart-view">
        <div className="mobile-cart-header">
          <button
            type="button"
            className="mobile-back-btn"
            onClick={() => setShowMobileCart(false)}
          >
            ← Back to POS
          </button>
          <div className="mobile-cart-title">
            Shopping Cart <span className="mobile-cart-count">({cart.length})</span>
          </div>
        </div>

        <div className="mobile-cart-panel">
          <Cart
            items={cart}
            onRemoveItem={removeFromCart}
            onUpdateQuantity={updateCartItem}
            onCheckoutSuccess={handleCheckoutSuccess}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="pos-page">
      <div className="pos-content">
        <div className="product-section">
          <div className="product-toolbar product-toolbar-sticky">
            <div className="product-toolbar-top">
              <h2>Products</h2>
              <button
                type="button"
                className="cart-icon-btn"
                onClick={() => setShowMobileCart(true)}
                aria-label="Open cart"
              >
                🛒
                {cart.length > 0 && <span className="cart-icon-badge">{cart.length}</span>}
              </button>
            </div>
            <input
              type="search"
              className="product-search"
              placeholder="Search products, SKU, category..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="product-list-scroll">
            <ProductList groupedCategories={groupedCategories} onAddToCart={addToCart} />
          </div>
        </div>

        <div className="cart-section">
          <Cart
            items={cart}
            onRemoveItem={removeFromCart}
            onUpdateQuantity={updateCartItem}
            onCheckoutSuccess={handleCheckoutSuccess}
          />
        </div>
      </div>
    </div>
  );
}
