import { createClient } from '@supabase/supabase-js';
import type {
  Category,
  DaySalesReport,
  FinanceExpense,
  CartItem,
  Product,
  Sale,
  SaleItem,
  StockMovement,
  Tenant,
} from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Set by auth service after login
let _tenantId: string | null = null;
let _isSuperAdmin = false;
export const setCurrentTenant = (id: string | null, role?: string): void => {
  _tenantId = id;
  _isSuperAdmin = role === 'super_admin';
};
export const getCurrentTenant = (): string | null => _tenantId;

// Apply tenant filter to a query builder.
// super_admin → no filter (sees all)
// admin/cashier with tenant → filter to their tenant
// admin/cashier without tenant (legacy) → filter to NULL tenant only (safety: no cross-tenant bleed)
function applyTenantFilter<T extends { eq: any; is: any }>(query: T): T {
  if (_isSuperAdmin) return query;
  if (_tenantId) return query.eq('tenant_id', _tenantId);
  return query.is('tenant_id', null);
}

type DemoSaleInput = Pick<Sale, 'sale_date' | 'total_amount' | 'payment_method' | 'status'> &
  Partial<Pick<Sale, 'customer_name' | 'customer_contact' | 'amount_paid' | 'payment_channel' | 'cashier_name' | 'cashier_role'>>;
type DemoSaleItemInput = Omit<SaleItem, 'id' | 'created_at'>;
type DemoStockMovementInput = Omit<StockMovement, 'id' | 'created_at'>;
type DemoProductInput = Omit<Product, 'id' | 'created_at' | 'updated_at'>;
type DemoFinanceExpenseInput = Omit<FinanceExpense, 'id' | 'created_at' | 'updated_at'>;

interface DemoState {
  products: Product[];
  categories: Category[];
  sales: Sale[];
  saleItems: SaleItem[];
  stockMovements: StockMovement[];
  financeExpenses: FinanceExpense[];
  creditPayments?: Array<{ id: string; sale_id: string; amount: number; payment_method: string; payment_channel?: string; paid_by?: string; note?: string; created_at: string }>;
}

const STORAGE_KEY = 'mkulima-demo-backend';

const demoCategories: Category[] = [
  {
    id: 'cat-feed',
    name: 'Feeds',
    description: 'Animal feed and nutrition',
    created_at: '2026-05-20T00:00:00.000Z',
  },
  {
    id: 'cat-health',
    name: 'Animal Health',
    description: 'Veterinary medicines and supplements',
    created_at: '2026-05-20T00:00:00.000Z',
  },
  {
    id: 'cat-seed',
    name: 'Seeds & Inputs',
    description: 'Seeds, fertilizers, and crop inputs',
    created_at: '2026-05-20T00:00:00.000Z',
  },
  {
    id: 'cat-tools',
    name: 'Tools',
    description: 'Farm tools and equipment',
    created_at: '2026-05-20T00:00:00.000Z',
  },
];

const demoProducts: Product[] = [
  {
    id: 'prd-1',
    name: 'Dairy Meal 50kg',
    category: 'Feeds',
    sku: 'FEE-001',
    description: 'High-energy dairy feed for milk production',
    unit_price: 3200,
    quantity_in_stock: 24,
    reorder_level: 8,
    image_url: '',
    created_at: '2026-05-20T00:00:00.000Z',
    updated_at: '2026-05-20T00:00:00.000Z',
  },
  {
    id: 'prd-2',
    name: 'Broiler Starter 50kg',
    category: 'Feeds',
    sku: 'FEE-002',
    description: 'Starter mash for poultry broilers',
    unit_price: 4100,
    quantity_in_stock: 17,
    reorder_level: 6,
    image_url: '',
    created_at: '2026-05-20T00:00:00.000Z',
    updated_at: '2026-05-20T00:00:00.000Z',
  },
  {
    id: 'prd-3',
    name: 'Acaricide Spray 1L',
    category: 'Animal Health',
    sku: 'HLT-101',
    description: 'Tick and mite control spray',
    unit_price: 950,
    quantity_in_stock: 32,
    reorder_level: 12,
    image_url: '',
    created_at: '2026-05-20T00:00:00.000Z',
    updated_at: '2026-05-20T00:00:00.000Z',
  },
  {
    id: 'prd-4',
    name: 'Maize Seed 10kg',
    category: 'Seeds & Inputs',
    sku: 'SEED-210',
    description: 'Certified maize seed for planting',
    unit_price: 1800,
    quantity_in_stock: 28,
    reorder_level: 10,
    image_url: '',
    created_at: '2026-05-20T00:00:00.000Z',
    updated_at: '2026-05-20T00:00:00.000Z',
  },
  {
    id: 'prd-5',
    name: 'Jembe Hoe',
    category: 'Tools',
    sku: 'TL-450',
    description: 'Heavy-duty digging hoe',
    unit_price: 1250,
    quantity_in_stock: 9,
    reorder_level: 4,
    image_url: '',
    created_at: '2026-05-20T00:00:00.000Z',
    updated_at: '2026-05-20T00:00:00.000Z',
  },
];

const createSeedState = (): DemoState => ({
  products: demoProducts,
  categories: demoCategories,
  sales: [],
  saleItems: [],
  stockMovements: [],
  financeExpenses: [],
  creditPayments: [],
});

let demoState = createSeedState();

const canUseStorage = () => typeof window !== 'undefined' && 'localStorage' in window;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const DEMO_DISABLED_MESSAGE =
  'Demo mode is disabled. Configure Supabase correctly and ensure table permissions (RLS policies) allow this action.';

const loadDemoState = (): DemoState => {
  throw new Error(DEMO_DISABLED_MESSAGE);
};

const saveDemoState = () => {
  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(demoState));
  }
};

const generateId = (prefix: string) => {
  const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomPart}`;
};

const syncProductStock = (productId: string, newQuantity: number) => {
  const state = loadDemoState();
  const productIndex = state.products.findIndex(product => product.id === productId);
  if (productIndex === -1) {
    return null;
  }

  const updated = {
    ...state.products[productIndex],
    quantity_in_stock: newQuantity,
    updated_at: new Date().toISOString(),
  };

  state.products[productIndex] = updated;
  saveDemoState();
  return updated;
};

const buildReport = (
  sales: Sale[],
  saleItems: SaleItem[],
  products: Product[]
): DaySalesReport => {
  const payment_breakdown = {
    cash: 0,
    card: 0,
    mobile_money: 0,
    credit: 0,
  };

  const productTotals = new Map<string, { product: Product; quantity: number }>();

  for (const sale of sales) {
    payment_breakdown[sale.payment_method] += sale.total_amount;
  }

  for (const item of saleItems) {
    const existing = productTotals.get(item.product_id);
    const product = products.find(candidate => candidate.id === item.product_id);
    if (!product) {
      continue;
    }

    productTotals.set(item.product_id, {
      product,
      quantity: (existing?.quantity ?? 0) + item.quantity,
    });
  }

  return {
    total_sales: sales.length,
    total_revenue: sales.reduce((sum, sale) => sum + sale.total_amount, 0),
    transactions_count: sales.length,
    payment_breakdown,
    top_products: Array.from(productTotals.values())
      .sort((left, right) => right.quantity - left.quantity)
      .slice(0, 5)
      .map(entry => entry.product),
  };
};

const attachSaleItemsToSales = (
  sales: Sale[],
  saleItems: SaleItem[],
  products: Product[]
): Sale[] => {
  const itemsBySaleId = new Map<string, CartItem[]>();

  for (const saleItem of saleItems) {
    const existing = itemsBySaleId.get(saleItem.sale_id) ?? [];
    const productFromItem = (saleItem as SaleItem & { product?: Product; products?: Product }).product
      ?? (saleItem as SaleItem & { product?: Product; products?: Product }).products
      ?? products.find(candidate => candidate.id === saleItem.product_id);
    existing.push({
      productId: saleItem.product_id,
      product: productFromItem ?? ({ id: saleItem.product_id } as Product),
      quantity: saleItem.quantity,
      unit_price: saleItem.unit_price,
      subtotal: saleItem.subtotal,
    });
    itemsBySaleId.set(saleItem.sale_id, existing);
  }

  return sales.map(sale => ({
    ...sale,
    items: itemsBySaleId.get(sale.id) ?? [],
  }));
};
const filterSalesByDateRange = (sales: Sale[], startDate: string, endDate: string) => {
  const start = `${startDate}T00:00:00`;
  const end = `${endDate}T23:59:59`;
  return sales.filter(sale => sale.sale_date >= start && sale.sale_date <= end);
};

const isMissingColumnError = (error: any) => {
  const message = String(error?.message || error?.details || error || '').toLowerCase();
  return message.includes('column') && (message.includes('does not exist') || message.includes('not found'));
};

const stripUndefined = <T extends Record<string, any>>(value: T) => {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
};

export const supabaseService = {
  async getProducts(): Promise<Product[]> {
    if (supabase) {
      try {
        const { data, error } = await applyTenantFilter(supabase.from('products').select('*').order('name'));
        if (!error && data) {
          return data as Product[];
        }
        throw new Error(error?.message || 'Failed to fetch products');
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    return clone(loadDemoState().products);
  },

  async getProductById(id: string): Promise<Product> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
        if (!error && data) {
          return data as Product;
        }
        throw new Error(error?.message || 'Failed to fetch product');
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    const product = loadDemoState().products.find(item => item.id === id);
    if (!product) {
      throw new Error('Product not found');
    }
    return clone(product);
  },

  async getProductsByCategory(category: string): Promise<Product[]> {
    if (supabase) {
      try {
        const { data, error } = await applyTenantFilter(
          supabase.from('products').select('*').eq('category', category).order('name')
        );
        if (!error && data) {
          return data as Product[];
        }
        throw new Error(error?.message || 'Failed to fetch products by category');
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    return clone(loadDemoState().products.filter(product => product.category === category));
  },

  async updateProductStock(productId: string, newQuantity: number): Promise<Product | null> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('products')
          .update({ quantity_in_stock: newQuantity })
          .eq('id', productId)
          .select('*')
          .single();
        if (!error && data) {
          return data as Product;
        }
        throw new Error(error?.message || 'Failed to update product stock');
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    return syncProductStock(productId, newQuantity);
  },

  async createSale(saleData: DemoSaleInput): Promise<Sale> {
    if (supabase) {
      try {
        const normalizedSale = stripUndefined({
          ...saleData,
          amount_paid: saleData.amount_paid ?? 0,
          ...((_tenantId) ? { tenant_id: _tenantId } : {}),
        });

        let { data, error } = await supabase.from('sales').insert([normalizedSale]).select().single();
        if (error && isMissingColumnError(error)) {
          const fallbackSale = stripUndefined({
            sale_date: saleData.sale_date,
            total_amount: saleData.total_amount,
            payment_method: saleData.payment_method,
            status: saleData.status,
            customer_name: saleData.customer_name,
            customer_contact: saleData.customer_contact,
            amount_paid: saleData.amount_paid ?? 0,
            payment_channel: saleData.payment_channel,
          });
          ({ data, error } = await supabase.from('sales').insert([fallbackSale]).select().single());
        }
        if (!error && data) {
          return data as Sale;
        }
        throw new Error(error?.message || 'Failed to create sale');
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    const state = loadDemoState();
    const now = new Date().toISOString();
    const sale: Sale = {
      id: generateId('sale'),
      ...saleData,
      amount_paid: saleData.amount_paid ?? 0,
      items: [],
      created_at: now,
      updated_at: now,
    };

    state.sales.unshift(sale);
    saveDemoState();
    return clone(sale);
  },

  async createSaleItems(items: DemoSaleItemInput[]): Promise<SaleItem[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('sale_items').insert(items).select();
        if (!error && data) {
          return data as SaleItem[];
        }
        throw new Error(error?.message || 'Failed to create sale items');
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    const state = loadDemoState();
    const now = new Date().toISOString();
    const saleItems = items.map(item => ({
      ...item,
      id: generateId('sale-item'),
      created_at: now,
    }));

    state.saleItems.unshift(...saleItems);
    saveDemoState();
    return clone(saleItems);
  },

  async getSaleById(id: string): Promise<Sale> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('sales').select('*').eq('id', id).single();
        if (!error && data) {
          const [saleItemsResult, productsResult] = await Promise.all([
            supabase.from('sale_items').select('*, products(*)').eq('sale_id', id),
            supabase.from('products').select('*'),
          ]);

          const saleItems = (!saleItemsResult.error && saleItemsResult.data ? saleItemsResult.data : []) as any[];
          const products = (!productsResult.error && productsResult.data ? productsResult.data : []) as Product[];
          return attachSaleItemsToSales(
            [data as Sale],
            saleItems.map(item => ({
              id: item.id,
              sale_id: item.sale_id,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              subtotal: item.subtotal,
              created_at: item.created_at,
              product: item.products,
            } as unknown as SaleItem)),
            products
          )[0];
        }
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    const state = loadDemoState();
    const sale = state.sales.find(candidate => candidate.id === id);
    if (!sale) {
      throw new Error('Sale not found');
    }

    return clone(
      attachSaleItemsToSales([sale], state.saleItems.filter(item => item.sale_id === id), state.products)[0]
    );
  },

  async getSalesForDate(date: string): Promise<Sale[]> {
    if (supabase) {
      try {
        const { data, error } = await applyTenantFilter(
          supabase
            .from('sales')
            .select('*')
            .gte('sale_date', `${date}T00:00:00`)
            .lt('sale_date', `${date}T23:59:59`)
            .order('created_at', { ascending: false })
        );
        if (!error && data) {
          const sales = data as Sale[];
          const saleIds = sales.map(sale => sale.id);
          const [saleItemsResult, productsResult] = await Promise.all([
            supabase.from('sale_items').select('*, products(*)').in('sale_id', saleIds),
            supabase.from('products').select('*'),
          ]);
          const saleItems = (!saleItemsResult.error && saleItemsResult.data ? saleItemsResult.data : []) as any[];
          const products = (!productsResult.error && productsResult.data ? productsResult.data : []) as Product[];
          return attachSaleItemsToSales(
            sales,
            saleItems.map(item => ({
              id: item.id,
              sale_id: item.sale_id,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              subtotal: item.subtotal,
              created_at: item.created_at,
              product: item.products,
            } as unknown as SaleItem)),
            products
          );
        }
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    const state = loadDemoState();
    const matchingSales = state.sales.filter(sale => sale.sale_date.startsWith(date));
    const saleIds = new Set(matchingSales.map(sale => sale.id));
    const relatedSaleItems = state.saleItems.filter(item => saleIds.has(item.sale_id));
    return clone(attachSaleItemsToSales(matchingSales, relatedSaleItems, state.products));
  },

  async getSalesBetweenDates(startDate: string, endDate: string): Promise<Sale[]> {
    if (supabase) {
      try {
        const { data, error } = await applyTenantFilter(
          supabase
            .from('sales')
            .select('*')
            .gte('sale_date', `${startDate}T00:00:00`)
            .lte('sale_date', `${endDate}T23:59:59`)
            .order('sale_date', { ascending: false })
        );
        if (!error && data) {
          const sales = data as Sale[];
          const saleIds = sales.map(sale => sale.id);
          const [saleItemsResult, productsResult] = await Promise.all([
            supabase.from('sale_items').select('*, products(*)').in('sale_id', saleIds),
            supabase.from('products').select('*'),
          ]);
          const saleItems = (!saleItemsResult.error && saleItemsResult.data ? saleItemsResult.data : []) as any[];
          const products = (!productsResult.error && productsResult.data ? productsResult.data : []) as Product[];
          return attachSaleItemsToSales(
            sales,
            saleItems.map(item => ({
              id: item.id,
              sale_id: item.sale_id,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              subtotal: item.subtotal,
              created_at: item.created_at,
              product: item.products,
            } as unknown as SaleItem)),
            products
          );
        }
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    const state = loadDemoState();
    const sales = filterSalesByDateRange(state.sales, startDate, endDate);
    const saleIds = new Set(sales.map(sale => sale.id));
    const relatedSaleItems = state.saleItems.filter(item => saleIds.has(item.sale_id));
    return clone(attachSaleItemsToSales(sales, relatedSaleItems, state.products));
  },

  async getDaySalesReport(date: string): Promise<DaySalesReport> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('get_daily_sales_report', { report_date: date });
        if (!error && data) {
          return data as DaySalesReport;
        }
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    const state = loadDemoState();
    const sales = state.sales
      .filter(sale => sale.sale_date.startsWith(date))
      .map(sale => ({
        ...sale,
        items: [],
      }));
    const saleIds = new Set(sales.map(sale => sale.id));
    const relatedSaleItems = state.saleItems.filter(item => saleIds.has(item.sale_id));
    return buildReport(sales, relatedSaleItems, state.products);
  },

  async getCategories(): Promise<Category[]> {
    if (supabase) {
      try {
        const { data, error } = await applyTenantFilter(supabase.from('categories').select('*').order('name'));
        if (!error && data) {
          return data as Category[];
        }
        throw new Error(error?.message || 'Failed to fetch categories');
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    return clone(loadDemoState().categories);
  },

  async getFinanceExpenses(startDate: string, endDate: string): Promise<FinanceExpense[]> {
    if (!supabase) {
      throw new Error(DEMO_DISABLED_MESSAGE);
    }

    const { data, error } = await applyTenantFilter(
      supabase
        .from('finance_expenses')
        .select('*')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .order('expense_date', { ascending: false })
    );

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as FinanceExpense[];
  },

  async addFinanceExpense(expense: DemoFinanceExpenseInput): Promise<FinanceExpense> {
    if (!supabase) {
      throw new Error(DEMO_DISABLED_MESSAGE);
    }

    const payload = _tenantId ? { ...expense, tenant_id: _tenantId } : expense;
    const { data, error } = await supabase
      .from('finance_expenses')
      .insert([payload])
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to add finance expense');
    }

    return data as FinanceExpense;
  },

  async deleteFinanceExpense(expenseId: string): Promise<void> {
    if (!supabase) {
      throw new Error(DEMO_DISABLED_MESSAGE);
    }

    const { error } = await supabase
      .from('finance_expenses')
      .delete()
      .eq('id', expenseId);

    if (error) {
      throw new Error(error.message);
    }
  },

  async addProduct(newProduct: DemoProductInput): Promise<Product> {
    const normalizedProduct: DemoProductInput = {
      ...newProduct,
      unit_price: Math.round(Number(newProduct.unit_price)),
    };

    if (supabase) {
      try {
        const payload = _tenantId ? { ...normalizedProduct, tenant_id: _tenantId } : normalizedProduct;
        const { data, error } = await supabase
          .from('products')
          .insert([payload])
          .select()
          .single();
        if (!error && data) {
          return data as Product;
        }
        throw new Error(error?.message || 'Failed to add product');
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    const state = loadDemoState();
    const now = new Date().toISOString();
    const product: Product = {
      id: generateId('prd'),
      ...normalizedProduct,
      created_at: now,
      updated_at: now,
    };

    state.products.unshift(product);
    saveDemoState();
    return clone(product);
  },

  async recordStockMovement(movement: DemoStockMovementInput): Promise<StockMovement> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('stock_movements')
          .insert([movement])
          .select()
          .single();
        if (!error && data) {
          return data as StockMovement;
        }
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    const state = loadDemoState();
    const stockMovement: StockMovement = {
      id: generateId('movement'),
      ...movement,
      created_at: new Date().toISOString(),
    };

    state.stockMovements.unshift(stockMovement);
    saveDemoState();
    return clone(stockMovement);
  },

  async getStockMovements(
    productId?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<StockMovement[]> {
    if (supabase) {
      try {
        // stock_movements has no tenant_id — filter via the tenant's product IDs
        const { data: tenantProducts } = await applyTenantFilter(
          supabase.from('products').select('id')
        );
        const tenantProductIds = (tenantProducts ?? []).map((p: any) => p.id as string);
        if (tenantProductIds.length === 0) return [];

        let query = supabase
          .from('stock_movements')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (productId) {
          if (!tenantProductIds.includes(productId)) return [];
          query = query.eq('product_id', productId);
        } else {
          query = query.in('product_id', tenantProductIds);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data as StockMovement[];
        }
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    const state = loadDemoState();
    const filtered = productId
      ? state.stockMovements.filter(movement => movement.product_id === productId)
      : state.stockMovements;

    return clone(filtered.slice(offset, offset + limit));
  },

  async updateProduct(productId: string, updates: Partial<Product>): Promise<Product> {
    const normalizedUpdates: Partial<Product> = {
      ...updates,
      ...(updates.unit_price !== undefined ? { unit_price: Math.round(Number(updates.unit_price)) } : {}),
    };

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('products')
          .update({
            ...normalizedUpdates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', productId)
          .select()
          .single();
        if (!error && data) {
          return data as Product;
        }
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    const state = loadDemoState();
    const productIndex = state.products.findIndex(p => p.id === productId);
    if (productIndex === -1) {
      throw new Error('Product not found');
    }

    const product = state.products[productIndex];
    const updatedProduct: Product = {
      ...product,
      ...normalizedUpdates,
      updated_at: new Date().toISOString(),
    };

    state.products[productIndex] = updatedProduct;
    saveDemoState();
    return clone(updatedProduct);
  },

  async receiveStock(
    productId: string,
    quantity: number,
    reference: string = 'Stock requisition',
    notes: string = 'Stock received from supplier'
  ): Promise<Product> {
    if (quantity <= 0) {
      throw new Error('Restock quantity must be greater than zero');
    }

    if (supabase) {
      try {
        const { data: currentProduct, error: fetchError } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .single();

        if (fetchError) {
          throw fetchError;
        }

        const nextQuantity = Number(currentProduct.quantity_in_stock ?? 0) + quantity;

        const { data: updatedProduct, error: updateError } = await supabase
          .from('products')
          .update({ quantity_in_stock: nextQuantity })
          .eq('id', productId)
          .select('*')
          .single();

        if (updateError) {
          throw updateError;
        }

        const { error: movementError } = await supabase.from('stock_movements').insert([
          {
            product_id: productId,
            movement_type: 'in',
            quantity,
            reference,
            notes,
          },
        ]);

        if (movementError) {
          throw movementError;
        }

        return updatedProduct as Product;
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    const updatedProduct = await this.updateProductStock(
      productId,
      (await this.getProductById(productId)).quantity_in_stock + quantity
    );

    if (!updatedProduct) {
      throw new Error('Product not found');
    }

    await this.recordStockMovement({
      product_id: productId,
      movement_type: 'in',
      quantity,
      reference,
      notes,
    });

    return updatedProduct;
  },

  async deleteProduct(productId: string): Promise<void> {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', productId);
        if (!error) {
          return;
        }
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    const state = loadDemoState();
    const productIndex = state.products.findIndex(p => p.id === productId);
    if (productIndex === -1) {
      throw new Error('Product not found');
    }

    state.products.splice(productIndex, 1);
    saveDemoState();
  },

  async updateCreditSalePayment(saleId: string, updates: { amount_paid?: number; status?: string; updated_at?: string }): Promise<Sale> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('sales')
          .update(updates)
          .eq('id', saleId)
          .select()
          .single();
        if (!error && data) {
          return data as Sale;
        }
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    const state = loadDemoState();
    const sale = state.sales.find(s => s.id === saleId);
    if (!sale) {
      throw new Error('Sale not found');
    }

    Object.assign(sale, updates);
    saveDemoState();
    return clone(sale);
  },

  async createCreditPayment(
    saleId: string,
    payment: { amount: number; payment_method: string; payment_channel?: string; paid_by?: string | null; note?: string }
  ): Promise<{ payment: any; sale: Sale }> {
    if (supabase) {
      try {
        const insert = {
          sale_id: saleId,
          amount: payment.amount,
          payment_method: payment.payment_method,
          payment_channel: payment.payment_channel ?? undefined,
          paid_by: payment.paid_by ?? undefined,
          note: payment.note ?? undefined,
        };

        const { data, error } = await supabase.from('credit_payments').insert([insert]).select().single();
          if (error) throw error;

          // fetch updated sale row; a DB trigger should update `sales.amount_paid` and `sales.status`
          const { data: saleData, error: saleErr } = await supabase.from('sales').select().eq('id', saleId).single();
          if (saleErr) throw saleErr;

          return { payment: data, sale: saleData as Sale };
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    // Demo backend behaviour: record payment and update sale.amount_paid
    const state = loadDemoState();
    const now = new Date().toISOString();
    const paymentRecord = {
      id: generateId('payment'),
      sale_id: saleId,
      amount: payment.amount,
      payment_method: payment.payment_method,
      payment_channel: payment.payment_channel ?? undefined,
      paid_by: payment.paid_by ?? undefined,
      note: payment.note ?? undefined,
      created_at: now,
    };

    state.creditPayments = state.creditPayments || [];
    state.creditPayments.unshift(paymentRecord as any);

    const sale = state.sales.find(s => s.id === saleId);
    if (!sale) throw new Error('Sale not found');

    sale.amount_paid = (sale.amount_paid || 0) + payment.amount;
    sale.status = sale.amount_paid >= sale.total_amount ? 'completed' : 'pending';
    sale.updated_at = now;

    saveDemoState();
    return { payment: clone(paymentRecord), sale: clone(sale) } as any;
  },

  

  async updateSaleDetails(saleId: string, updates: { customer_name?: string; customer_contact?: string; updated_at?: string }): Promise<Sale> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('sales')
          .update(updates)
          .eq('id', saleId)
          .select()
          .single();
        if (!error && data) {
          return data as Sale;
        }
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    const state = loadDemoState();
    const sale = state.sales.find(s => s.id === saleId);
    if (!sale) {
      throw new Error('Sale not found');
    }

    Object.assign(sale, updates);
    saveDemoState();
    return clone(sale);
  },

  async deleteCreditSale(saleId: string): Promise<void> {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('sales')
          .delete()
          .eq('id', saleId);
        if (!error) {
          return;
        }
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    const state = loadDemoState();
    const index = state.sales.findIndex(s => s.id === saleId);
    if (index === -1) {
      throw new Error('Sale not found');
    }

    state.sales.splice(index, 1);
    saveDemoState();
  },

  // ─── Tenant management (super_admin only) ───────────────────────────────────

  async getTenants(): Promise<Tenant[]> {
    if (!supabase) throw new Error(DEMO_DISABLED_MESSAGE);
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []) as Tenant[];
  },

  async createTenant(tenantData: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>): Promise<Tenant> {
    if (!supabase) throw new Error(DEMO_DISABLED_MESSAGE);
    const { data, error } = await supabase
      .from('tenants')
      .insert([{ ...tenantData, updated_at: new Date().toISOString() }])
      .select()
      .single();
    if (error || !data) throw new Error(error?.message || 'Failed to create tenant');
    return data as Tenant;
  },

  async updateTenant(tenantId: string, updates: Partial<Omit<Tenant, 'id' | 'created_at'>>): Promise<Tenant> {
    if (!supabase) throw new Error(DEMO_DISABLED_MESSAGE);
    const { data, error } = await supabase
      .from('tenants')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', tenantId)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message || 'Failed to update tenant');
    return data as Tenant;
  },

  async deleteTenant(tenantId: string): Promise<void> {
    if (!supabase) throw new Error(DEMO_DISABLED_MESSAGE);
    const { error } = await supabase.from('tenants').delete().eq('id', tenantId);
    if (error) throw new Error(error.message);
  },

  async getTenantStaffUsers(tenantId: string): Promise<any[]> {
    if (!supabase) throw new Error(DEMO_DISABLED_MESSAGE);
    const { data, error } = await supabase
      .from('staff_users')
      .select('id, username, display_name, role, is_active, tenant_id, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getAllAdmins(): Promise<any[]> {
    if (!supabase) throw new Error(DEMO_DISABLED_MESSAGE);
    const { data, error } = await supabase
      .from('staff_users')
      .select('id, username, display_name, role, is_active, tenant_id, created_at')
      .eq('role', 'admin')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createStaffUser(userData: {
    username: string;
    display_name: string;
    role: string;
    pin_hash: string;
    is_active: boolean;
    tenant_id?: string;
  }): Promise<any> {
    if (!supabase) throw new Error(DEMO_DISABLED_MESSAGE);
    const { data, error } = await supabase
      .from('staff_users')
      .insert([userData])
      .select()
      .single();
    if (error || !data) throw new Error(error?.message || 'Failed to create user');
    return data;
  },

  async updateStaffUser(userId: string, updates: { display_name?: string; role?: string; pin_hash?: string; is_active?: boolean }): Promise<any> {
    if (!supabase) throw new Error(DEMO_DISABLED_MESSAGE);
    const { data, error } = await supabase
      .from('staff_users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message || 'Failed to update user');
    return data;
  },

  async deleteStaffUser(userId: string): Promise<void> {
    if (!supabase) throw new Error(DEMO_DISABLED_MESSAGE);
    const { error } = await supabase.from('staff_users').delete().eq('id', userId);
    if (error) throw new Error(error.message);
  },

  // ─── Super-admin cross-tenant data reads ───────────────────────────────────

  async getSuperAdminTenantCategories(tenantId: string): Promise<any[]> {
    if (!supabase) throw new Error(DEMO_DISABLED_MESSAGE);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getSuperAdminTenantSales(tenantId: string, days = 30): Promise<any[]> {
    if (!supabase) throw new Error(DEMO_DISABLED_MESSAGE);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('sale_date', since)
      .order('sale_date', { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getSuperAdminTenantFinance(tenantId: string): Promise<any[]> {
    if (!supabase) throw new Error(DEMO_DISABLED_MESSAGE);
    const { data, error } = await supabase
      .from('finance_expenses')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('expense_date', { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getSuperAdminTenantProducts(tenantId: string): Promise<any[]> {
    if (!supabase) throw new Error(DEMO_DISABLED_MESSAGE);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name');
    if (error) throw new Error(error.message);
    return data || [];
  },
};
