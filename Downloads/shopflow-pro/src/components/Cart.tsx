import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Minus, Plus } from "lucide-react";
import { fmtKES, resolveUnitPrice } from "@/lib/format";
import type { CartItem, CartCrateItem, Product } from "@/lib/types";

interface Props {
  items: CartItem[];
  onChange: (items: CartItem[]) => void;
  onCheckout: () => void;
}

const getBottlePrice = (product: Product) => resolveUnitPrice(Number(product.price), product.discount_price);

const getCrateUnitPrice = (item: CartCrateItem) => {
  return item.mix.reduce((sum, entry) => {
    const packSize = item.packSize || 24;
    const bottlePrice =
      item.pricing === "wholesale"
        ? (Number(entry.product.price_wholesale_crate ?? entry.product.price * packSize) / packSize)
        : getBottlePrice(entry.product);
    return sum + bottlePrice * entry.quantity;
  }, 0);
};

const getCrateMaxCount = (item: CartCrateItem) => {
  if (item.mix.length === 0) return 0;
  return Math.min(
    ...item.mix.map((entry) => {
      const perCrate = entry.quantity || 0;
      if (perCrate <= 0) return 0;
      return Math.floor(Number(entry.product.stock_quantity) / perCrate);
    }),
  );
};

export function Cart({ items, onChange, onCheckout }: Props) {
  const subtotal = items.reduce((s, i) => {
    if (i.kind === "bottle") {
      return s + getBottlePrice(i.product) * i.quantity;
    }
    const unitPrice = getCrateUnitPrice(i);
    return s + unitPrice * i.crateCount;
  }, 0);

  const setBottleQty = (id: string, qty: number) => {
    if (qty <= 0) return onChange(items.filter((i) => i.kind !== "bottle" || i.product.id !== id));
    onChange(
      items.map((i) => {
        if (i.kind !== "bottle" || i.product.id !== id) return i;
        return { ...i, quantity: Math.min(qty, i.product.stock_quantity) };
      }),
    );
  };

  const setCrateQty = (id: string, qty: number) => {
    if (qty <= 0) return onChange(items.filter((i) => i.kind !== "crate" || i.id !== id));
    onChange(
      items.map((i) => {
        if (i.kind !== "crate" || i.id !== id) return i;
        const max = getCrateMaxCount(i);
        return { ...i, crateCount: Math.min(qty, max) };
      }),
    );
  };

  return (
    <Card className="flex flex-col h-full">
      <div className="px-4 py-3 border-b">
        <h3 className="font-semibold">Cart</h3>
        <p className="text-xs text-muted-foreground">{items.length} item(s)</p>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Cart is empty. Add products to start a sale.</p>}
        {items.map((i) => {
          if (i.kind === "bottle") {
            return (
              <div key={i.product.id} className="rounded-md border p-2">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{i.product.name}</p>
                    <p className="text-xs text-muted-foreground">{fmtKES(getBottlePrice(i.product))} ea</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setBottleQty(i.product.id, 0)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setBottleQty(i.product.id, i.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                    <Input className="h-7 w-14 text-center" value={i.quantity} onChange={(e) => setBottleQty(i.product.id, parseInt(e.target.value) || 0)} />
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setBottleQty(i.product.id, i.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <p className="text-sm font-semibold">{fmtKES(getBottlePrice(i.product) * i.quantity)}</p>
                </div>
              </div>
            );
          }

          const unitPrice = getCrateUnitPrice(i);
          const mixLabel = i.mix.map((entry) => `${entry.product.name} x${entry.quantity}`).join(", ");

          return (
            <div key={i.id} className="rounded-md border p-2">
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">Crate ({i.pricing === "wholesale" ? "Wholesale" : "Retail"})</p>
                  <p className="text-xs text-muted-foreground">{mixLabel || "Mixed crate"}</p>
                  <p className="text-xs text-muted-foreground">{fmtKES(unitPrice)} per crate</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setCrateQty(i.id, 0)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCrateQty(i.id, i.crateCount - 1)}><Minus className="h-3 w-3" /></Button>
                  <Input className="h-7 w-14 text-center" value={i.crateCount} onChange={(e) => setCrateQty(i.id, parseInt(e.target.value) || 0)} />
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCrateQty(i.id, i.crateCount + 1)}><Plus className="h-3 w-3" /></Button>
                </div>
                <p className="text-sm font-semibold">{fmtKES(unitPrice * i.crateCount)}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t p-3 space-y-3">
        <div className="flex justify-between text-lg font-semibold">
          <span>Total</span><span>{fmtKES(subtotal)}</span>
        </div>
        <Button className="w-full" size="lg" disabled={items.length === 0} onClick={onCheckout}>
          Checkout
        </Button>
      </div>
    </Card>
  );
}
