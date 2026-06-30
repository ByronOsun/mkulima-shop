// Type definitions for Mkulima Agrovet POS System

export interface Product {
  id: string;
  name: string;
  category: string;
  sku: string;
  description?: string;
  buying_price?: number;
  unit_price: number;
  quantity_in_stock: number;
  reorder_level: number;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  sale_date: string;
  total_amount: number;
  payment_method: 'cash' | 'card' | 'mobile_money' | 'credit';
  status: 'completed' | 'pending' | 'cancelled';
  items: CartItem[];
  customer_name?: string;
  customer_contact?: string;
  amount_paid?: number;
  payment_channel?: string;
  cashier_name?: string;
  cashier_role?: UserRole;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reference: string;
  notes?: string;
  created_at: string;
}

export interface DaySalesReport {
  total_sales: number;
  total_revenue: number;
  transactions_count: number;
  payment_breakdown: {
    cash: number;
    card: number;
    mobile_money: number;
    credit: number;
  };
  top_products: Product[];
}

export type FinanceExpenseCategory = 'salaries' | 'rent' | 'logistics' | 'investment' | 'others';

export interface FinanceExpense {
  id: string;
  expense_date: string;
  category: FinanceExpenseCategory;
  description: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface ReceiptItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ReceiptData {
  saleId: string;
  receiptNumber: string;
  saleDate: string;
  paymentMethod: 'cash' | 'card' | 'mobile_money' | 'credit';
  totalAmount: number;
  discountAmount?: number;
  cashierRole: UserRole;
  cashierName: string;
  items: ReceiptItem[];
  tenantConfig?: TenantConfig;
}

export type UserRole = 'cashier' | 'admin' | 'super_admin';

export interface Tenant {
  id: string;
  shop_name: string;
  address?: string;
  phone?: string;
  header_text?: string;
  footer_text?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantConfig {
  shopName: string;
  address?: string;
  phone?: string;
  headerText?: string;
  footerText?: string;
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  is_active?: boolean;
  tenant_id?: string;
  tenantConfig?: TenantConfig;
  created_at?: string;
}

export interface AuthContext {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, pin: string) => Promise<void>;
  loginWithPin: (pin: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

export interface DailySalesReport {
  date: string;
  totalTransactions: number;
  totalRevenue: number;
  paymentBreakdown: Record<string, number>;
  topProducts: Array<{ name: string; quantity: number; total: number }>;
}
