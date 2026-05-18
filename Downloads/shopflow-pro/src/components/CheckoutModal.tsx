import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fmtKES, resolveUnitPrice } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CartCrateItem, CartItem, PaymentMode, Product } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: CartItem[];
  onComplete: (transactionId: string) => void;
}

export function CheckoutModal({ open, onOpenChange, items, onComplete }: Props) {
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

  const total = items.reduce((s, i) => {
    if (i.kind === "bottle") return s + getBottlePrice(i.product) * i.quantity;
    return s + getCrateUnitPrice(i) * i.crateCount;
  }, 0);
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [refId, setRefId] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const payloadItems = items.map((i) => {
      if (i.kind === "bottle") {
        return { kind: "bottle", product_id: i.product.id, quantity: i.quantity };
      }
      return {
        kind: "crate",
        pricing: i.pricing,
        crate_count: i.crateCount,
        pack_size: i.packSize,
        mix: i.mix.map((entry) => ({ product_id: entry.product.id, quantity: entry.quantity })),
      };
    });

    const { data, error } = await supabase.rpc("create_sale", {
      _payment_mode: mode,
      _ref_id: refId.trim() || "",
      _customer_name: customer.trim() || "",
      _customer_phone: phone.trim() || "",
      _items: payloadItems,
    });
    setBusy(false);
    if (error || !data) {
      toast.error("Sale failed", { description: error?.message });
      return;
    }
    toast.success("Sale completed");
    onComplete(data as unknown as string);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Checkout — {fmtKES(total)}</DialogTitle></DialogHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="cash">Cash</TabsTrigger>
            <TabsTrigger value="atm">ATM Card</TabsTrigger>
            <TabsTrigger value="mpesa">M-Pesa</TabsTrigger>
          </TabsList>
          <TabsContent value="cash" className="pt-4">
            <p className="text-sm text-muted-foreground">Collect <span className="font-semibold text-foreground">{fmtKES(total)}</span> in cash.</p>
            <div className="mt-3 space-y-2">
              <Label>Customer name (optional)</Label>
              <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in" />
              <Label>Phone (loyalty, optional)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254..." />
            </div>
          </TabsContent>
          {(["atm", "mpesa"] as const).map((m) => (
            <TabsContent key={m} value={m} className="pt-4 space-y-3">
              <div className="space-y-2">
                <Label>Customer name (optional)</Label>
                <Input value={customer} onChange={(e) => setCustomer(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Reference ID (optional)</Label>
                <Input value={refId} onChange={(e) => setRefId(e.target.value)} placeholder={m === "mpesa" ? "M-Pesa code" : "Card txn ref"} />
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input value={fmtKES(total)} disabled />
              </div>
              <div className="space-y-2">
                <Label>Phone (optional)</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </TabsContent>
          ))}
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Processing..." : `Confirm ${fmtKES(total)}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
