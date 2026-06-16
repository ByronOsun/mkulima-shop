import { supabaseService, supabase } from './supabase';
import { db } from './localDb';
import type { Product, Category, ReceiptData } from '../types';
import type { CompleteSaleParams } from './checkout';

// ─── Product / Category cache-first loading ───────────────────────────────────

/**
 * Returns products from IndexedDB immediately (sub-millisecond), then
 * refreshes from Supabase in the background. Call onRefreshed to push the
 * updated list into component state when the network response arrives.
 */
export async function getProductsCached(
  onRefreshed?: (fresh: Product[]) => void,
): Promise<Product[]> {
  const cached = await db.products.orderBy('name').toArray();

  const networkFetch = navigator.onLine
    ? supabaseService.getProducts()
        .then(async fresh => {
          const now = Date.now();
          await db.products.clear();
          await db.products.bulkPut(fresh.map(p => ({ ...p, _cached_at: now })));
          onRefreshed?.(fresh);
          return fresh;
        })
        .catch(() => cached)
    : Promise.resolve(cached);

  // Serve cache immediately; if empty, wait for network.
  if (cached.length > 0) return cached;
  return networkFetch;
}

export async function getCategoriesCached(): Promise<Category[]> {
  const cached = await db.categories.orderBy('name').toArray();

  if (navigator.onLine) {
    supabaseService.getCategories()
      .then(async fresh => {
        await db.categories.clear();
        await db.categories.bulkPut(fresh.map(c => ({ ...c, _cached_at: Date.now() })));
      })
      .catch(() => {});
  }

  if (cached.length > 0) return cached;
  return navigator.onLine ? supabaseService.getCategories() : [];
}

// ─── Offline sale creation ─────────────────────────────────────────────────────

export async function completeSaleOffline(params: CompleteSaleParams): Promise<ReceiptData> {
  const {
    items, total, paymentMethod, user,
    customerName, customerContact,
    amountPaid = 0, initialPaymentMethod,
  } = params;

  const saleId = crypto.randomUUID();
  const now    = new Date().toISOString();
  const status = paymentMethod === 'credit' && amountPaid < total ? 'pending' : 'completed';

  await db.pending_sales.add({
    id: saleId,
    sale_date: now,
    total_amount: total,
    payment_method: paymentMethod,
    status,
    customer_name:    paymentMethod === 'credit' ? customerName  || undefined : undefined,
    customer_contact: paymentMethod === 'credit' ? customerContact || undefined : undefined,
    amount_paid:  amountPaid   || undefined,
    payment_channel:
      paymentMethod === 'credit' && amountPaid > 0 ? initialPaymentMethod : undefined,
    cashier_name: user?.fullName || user?.username || 'Unknown',
    cashier_role: user?.role ?? 'cashier',
    _synced: 0,
  });

  await db.pending_sale_items.bulkAdd(
    items.map(item => ({
      sale_id:    saleId,
      product_id: item.productId,
      quantity:   item.quantity,
      unit_price: item.unit_price,
      subtotal:   item.subtotal,
    })),
  );

  // Deduct stock from local cache so subsequent scans show correct quantities.
  for (const item of items) {
    await db.products.where('id').equals(item.productId).modify(p => {
      p.quantity_in_stock = Math.max(0, p.quantity_in_stock - item.quantity);
    });
  }

  // Signal to the network hook that pending count changed.
  window.dispatchEvent(new CustomEvent('offline-sale-queued'));

  return {
    saleId,
    receiptNumber: saleId.substring(0, 8).toUpperCase(),
    saleDate: now,
    paymentMethod,
    totalAmount: total,
    cashierRole: user?.role ?? 'cashier',
    cashierName: user?.fullName || user?.username || 'Unknown',
    items: items.map(item => ({
      productId: item.productId,
      name:      item.product.name,
      sku:       item.product.sku,
      quantity:  item.quantity,
      unitPrice: item.unit_price,
      subtotal:  item.subtotal,
    })),
  };
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

let syncInProgress = false;

/** Upload every un-synced offline sale to Supabase. Returns number synced. */
export async function syncPendingSales(): Promise<number> {
  if (!navigator.onLine || !supabase || syncInProgress) return 0;

  const unsyncedSales = await db.pending_sales.where('_synced').equals(0).toArray();
  if (unsyncedSales.length === 0) return 0;

  syncInProgress = true;
  let synced = 0;

  try {
    for (const sale of unsyncedSales) {
      try {
        const { _local_id, _synced, ...saleRow } = sale;

        const { error: saleErr } = await supabase
          .from('sales')
          .insert([{ ...saleRow, amount_paid: saleRow.amount_paid ?? 0 }]);
        if (saleErr) throw saleErr;

        const items = await db.pending_sale_items
          .where('sale_id').equals(sale.id).toArray();

        if (items.length > 0) {
          const { error: itemsErr } = await supabase
            .from('sale_items')
            .insert(items.map(({ _local_id: _li, ...item }) => item));
          if (itemsErr) throw itemsErr;
        }

        // Deduction-based stock sync: read remote value, subtract what was sold.
        for (const item of items) {
          const { data: remote } = await supabase
            .from('products')
            .select('quantity_in_stock')
            .eq('id', item.product_id)
            .single();
          if (remote) {
            await supabase
              .from('products')
              .update({
                quantity_in_stock: Math.max(0, remote.quantity_in_stock - item.quantity),
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.product_id);
          }
        }

        await db.pending_sales.update(_local_id!, { _synced: 1 });
        synced++;
      } catch (err) {
        console.error('[sync] Failed to sync sale', sale.id, err);
      }
    }

    // Refresh local product cache with authoritative server values.
    if (synced > 0) {
      supabaseService.getProducts()
        .then(async fresh => {
          await db.products.clear();
          await db.products.bulkPut(fresh.map(p => ({ ...p, _cached_at: Date.now() })));
        })
        .catch(() => {});
    }
  } finally {
    syncInProgress = false;
  }

  return synced;
}

export const getPendingSalesCount = () =>
  db.pending_sales.where('_synced').equals(0).count();
