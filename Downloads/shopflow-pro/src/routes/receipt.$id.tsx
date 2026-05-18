import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtKES, usernameFromEmail } from "@/lib/format";
import { ArrowLeft, Printer } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/receipt/$id")({ component: Receipt });

type Txn = Tables<"transactions">;
type Item = Tables<"transaction_items">;
type Shop = Tables<"shops">;
type Profile = Tables<"profiles">;

function Receipt() {
  const { id } = useParams({ from: "/receipt/$id" });
  const [txn, setTxn] = useState<Txn | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [shop, setShop] = useState<Shop | null>(null);
  const [emp, setEmp] = useState<Profile | null>(null);

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from("transactions").select("*").eq("id", id).maybeSingle();
      if (!t) return;
      setTxn(t as Txn);
      const [{ data: it }, { data: s }, { data: p }] = await Promise.all([
        supabase.from("transaction_items").select("*").eq("transaction_id", id),
        supabase.from("shops").select("*").eq("id", t.shop_id).maybeSingle(),
        supabase.from("profiles").select("*").eq("id", t.employee_id).maybeSingle(),
      ]);
      setItems((it ?? []) as Item[]);
      setShop(s as Shop | null);
      setEmp(p as Profile | null);
    })();
  }, [id]);

  if (!txn) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading receipt…</div>;

  const receiptShopName = shop?.name === "Beauty Shop" ? "Liz Cosmetics" : shop?.name;
  const receiptContact = shop?.contact_info || "07 002 132 28";

  return (
    <div className="min-h-screen bg-muted/40 py-6 px-4">
      <div className="w-full max-w-md mx-auto">
        <div className="mb-4 flex justify-between no-print">
          <Button variant="ghost" size="sm" asChild><Link to="/pos"><ArrowLeft className="h-4 w-4 mr-1" />Back to POS</Link></Button>
          <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print</Button>
        </div>
        <div className="print-area bg-white text-black p-4 sm:p-6 rounded-md shadow-sm font-mono text-sm">
          <div className="text-center border-b border-dashed border-black/30 pb-3">
            <h1 className="text-lg font-bold">{receiptShopName ?? "Shop"}</h1>
            <p className="text-xs">{receiptContact}</p>
          </div>
          <div className="py-3 text-xs space-y-0.5">
            <div className="flex justify-between"><span>Receipt #</span><span>{txn.id.slice(0, 8).toUpperCase()}</span></div>
            <div className="flex justify-between"><span>Date</span><span>{fmtDate(txn.created_at)}</span></div>
            <div className="flex justify-between"><span>Cashier</span><span>{usernameFromEmail(emp?.email)}</span></div>
            {txn.customer_name && <div className="flex justify-between"><span>Customer</span><span>{txn.customer_name}</span></div>}
          </div>
          <div className="border-t border-dashed border-black/30 pt-2">
            <table className="w-full text-xs overflow-x-auto">
              <thead><tr className="border-b border-dashed border-black/30"><th className="text-left py-1 text-xs">Item</th><th className="text-right text-xs">Qty</th><th className="text-right text-xs">Price</th><th className="text-right text-xs">Total</th></tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}><td className="py-1">{i.name_snapshot}</td><td className="text-right">{i.quantity}</td><td className="text-right">{Number(i.unit_price).toFixed(2)}</td><td className="text-right">{Number(i.total).toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-dashed border-black/30 pt-2 mt-2 space-y-0.5">
            <div className="flex justify-between font-bold text-base"><span>TOTAL</span><span>{fmtKES(Number(txn.total_amount))}</span></div>
            <div className="flex justify-between text-xs"><span>Payment</span><span>{txn.payment_mode.toUpperCase()}</span></div>
            {txn.ref_id && <div className="flex justify-between text-xs"><span>Ref</span><span>{txn.ref_id}</span></div>}
          </div>
          <p className="text-center text-xs mt-4 border-t border-dashed border-black/30 pt-3">Thank you for shopping with us!</p>
        </div>
      </div>
    </div>
  );
}
