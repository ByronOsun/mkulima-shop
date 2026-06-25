import { CartItem, ReceiptData, User } from '../types';
import { supabaseService } from './supabase';

export type SalePaymentMethod = 'cash' | 'card' | 'mobile_money' | 'credit';

export interface CompleteSaleParams {
  items: CartItem[];
  total: number;
  discountAmount?: number;
  paymentMethod: SalePaymentMethod;
  user: User | null;
  customerName?: string;
  customerContact?: string;
  amountPaid?: number;
  initialPaymentMethod?: 'cash' | 'mobile_money';
}

export async function completeSale(params: CompleteSaleParams): Promise<ReceiptData> {
  const {
    items, total, discountAmount = 0, paymentMethod, user,
    customerName, customerContact,
    amountPaid = 0, initialPaymentMethod,
  } = params;

  const status: 'completed' | 'pending' =
    paymentMethod === 'credit' && amountPaid < total ? 'pending' : 'completed';

  const sale = await supabaseService.createSale({
    sale_date: new Date().toISOString(),
    total_amount: total,
    payment_method: paymentMethod,
    status,
    customer_name: paymentMethod === 'credit' ? customerName || undefined : undefined,
    customer_contact: paymentMethod === 'credit' ? customerContact || undefined : undefined,
    amount_paid: amountPaid || undefined,
    payment_channel: paymentMethod === 'credit' && amountPaid > 0 ? initialPaymentMethod : undefined,
    cashier_name: user?.fullName || user?.username || 'Unknown User',
    cashier_role: user?.role ?? 'cashier',
  } as any);

  const saleItems = items.map(item => ({
    sale_id: sale.id,
    product_id: item.productId,
    quantity: item.quantity,
    unit_price: item.unit_price,
    subtotal: item.subtotal,
  }));

  await supabaseService.createSaleItems(saleItems);

  for (const item of items) {
    const newStock = item.product.quantity_in_stock - item.quantity;
    await supabaseService.updateProductStock(item.productId, Math.max(0, newStock));
  }

  return {
    saleId: sale.id,
    receiptNumber: sale.id.substring(0, 8).toUpperCase(),
    saleDate: sale.sale_date,
    paymentMethod,
    totalAmount: total,
    discountAmount: discountAmount > 0 ? discountAmount : undefined,
    cashierRole: user?.role ?? 'cashier',
    cashierName: user?.fullName || user?.username || 'Unknown User',
    tenantConfig: user?.tenantConfig,
    items: items.map(item => ({
      productId: item.productId,
      name: item.product.name,
      sku: item.product.sku,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      subtotal: item.subtotal,
    })),
  };
}
