import Dexie, { Table } from 'dexie';
import type { Product, Category } from '../types';

export interface OfflineSale {
  _local_id?: number;
  id: string;
  sale_date: string;
  total_amount: number;
  payment_method: string;
  status: string;
  customer_name?: string;
  customer_contact?: string;
  amount_paid?: number;
  payment_channel?: string;
  cashier_name?: string;
  cashier_role?: string;
  tenant_id?: string;
  _synced: 0 | 1;
}

export interface OfflineSaleItem {
  _local_id?: number;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export type CachedProduct  = Product  & { _cached_at: number };
export type CachedCategory = Category & { _cached_at: number };

class MkulimaDB extends Dexie {
  products!:           Table<CachedProduct>;
  categories!:         Table<CachedCategory>;
  pending_sales!:      Table<OfflineSale>;
  pending_sale_items!: Table<OfflineSaleItem>;

  constructor() {
    super('mkulima-pos');
    this.version(1).stores({
      products:           'id, name, category, updated_at',
      categories:         'id, name',
      pending_sales:      '++_local_id, id, _synced',
      pending_sale_items: '++_local_id, sale_id',
    });
  }
}

export const db = new MkulimaDB();
