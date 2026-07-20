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
  /** Override the initial sale status. Defaults to 'completed' for cash/card,
   *  'pending' for mobile_money (awaiting M-Pesa callback) and credit. */
  initialStatus?: 'completed' | 'pending';
}

export async function completeSale(params: CompleteSaleParams): Promise<ReceiptData> {
  const {
    items, total, discountAmount = 0, paymentMethod, user,
    customerName, customerContact,
    amountPaid = 0, initialPaymentMethod,
    initialStatus,
  } = params;

  const cashierName = user?.fullName || user?.username || 'Unknown User';
  const cashierRole = user?.role ?? 'cashier';

  // For credit sales, merge into the customer's existing pending balance
  if (paymentMethod === 'credit' && customerName?.trim()) {
    const existing = await supabaseService.findPendingCreditSale(customerName.trim());
    if (existing) {
      await supabaseService.mergeCreditSale(existing.id, total, amountPaid);

      const saleItems = items.map(item => ({
        sale_id: existing.id,
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
        saleId: existing.id,
        receiptNumber: existing.id.substring(0, 8).toUpperCase(),
        saleDate: new Date().toISOString(),
        paymentMethod,
        totalAmount: existing.total_amount + total,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        cashierRole,
        cashierName,
        tenantConfig: user?.tenantConfig,
        items: items.map(item => ({
          productId: item.productId,
          name: item.product.name,
          description: item.product.description,
          sku: item.product.sku,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          subtotal: item.subtotal,
        })),
      };
    }
  }

  const status: 'completed' | 'pending' =
    initialStatus ??
    (paymentMethod === 'credit' && amountPaid < total ? 'pending' : 'completed');

  const sale = await supabaseService.createSale({
    sale_date: new Date().toISOString(),
    total_amount: total,
    payment_method: paymentMethod,
    status,
    customer_name: paymentMethod === 'credit' ? customerName || undefined : undefined,
    customer_contact: paymentMethod === 'credit' ? customerContact || undefined : undefined,
    amount_paid: amountPaid || undefined,
    payment_channel: paymentMethod === 'credit' && amountPaid > 0 ? initialPaymentMethod : undefined,
    cashier_name: cashierName,
    cashier_role: cashierRole,
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
    cashierRole,
    cashierName,
    tenantConfig: user?.tenantConfig,
    items: items.map(item => ({
      productId: item.productId,
      name: item.product.name,
      description: item.product.description,
      sku: item.product.sku,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      subtotal: item.subtotal,
    })),
  };
}
