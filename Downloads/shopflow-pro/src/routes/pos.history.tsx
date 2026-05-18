import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fmtKES } from "@/lib/format";
import { ArrowLeft } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/pos/history")({ component: History });

type Txn = Tables<"transactions">;
type TxnItem = Tables<"transaction_items">;
type ItemSummaryRow = {
  name: string;
  quantity: number;
  amount: number;
};

function History() {
  const { session, role, shop } = useAuth();
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalsByMode, setTotalsByMode] = useState<Record<string, number>>({});
  const [txnCount, setTxnCount] = useState(0);
  const [itemSummary, setItemSummary] = useState<ItemSummaryRow[]>([]);

  useEffect(() => {
    if (!shop) return;
    // Fetch recent transactions and filter by local date to avoid timezone issues
    const now = new Date();

    supabase
      .from("transactions")
      .select("*")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false })
      .limit(1000)
      .then(async ({ data }) => {
        const all = (data ?? []) as Txn[];
        const rows = all.filter((r) => {
          const d = new Date(r.created_at);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
        });
        setTxnCount(rows.length);
        const total = rows.reduce((s, r) => s + Number(r.total_amount), 0);
        setTotalAmount(total);
        const byMode = rows.reduce<Record<string, number>>((acc, r) => {
          acc[r.payment_mode] = (acc[r.payment_mode] ?? 0) + Number(r.total_amount);
          return acc;
        }, {});
        setTotalsByMode(byMode);

        const ids = rows.map((r) => r.id);
        if (ids.length === 0) {
          setItemSummary([]);
          return;
        }

        const { data: itemsData } = await supabase
          .from("transaction_items")
          .select("name_snapshot, quantity, total, transaction_id")
          .in("transaction_id", ids);

        const grouped = ((itemsData ?? []) as Pick<TxnItem, "name_snapshot" | "quantity" | "total">[]).reduce<Record<string, ItemSummaryRow>>((acc, item) => {
          const key = item.name_snapshot;
          if (!acc[key]) {
            acc[key] = { name: item.name_snapshot, quantity: 0, amount: 0 };
          }
          acc[key].quantity += Number(item.quantity);
          acc[key].amount += Number(item.total);
          return acc;
        }, {});

        const summaryRows = Object.values(grouped).sort((a, b) => b.amount - a.amount);
        setItemSummary(summaryRows);
      });
  }, [shop]);

  if (!session) return <Navigate to="/login" />;
  if (role === "admin") return <Navigate to="/admin" />;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link to="/pos"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link></Button>
        <h1 className="font-semibold">Transaction History</h1>
      </header>
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <Card className="p-4">
          <h2 className="font-semibold">Today's Summary ({new Date().toLocaleDateString()})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <Card className="p-3"><p className="text-xs text-muted-foreground">Transactions</p><p className="text-lg font-bold">{txnCount}</p></Card>
            <Card className="p-3"><p className="text-xs text-muted-foreground">Revenue</p><p className="text-lg font-bold">{fmtKES(totalAmount)}</p></Card>
            <Card className="p-3"><p className="text-xs text-muted-foreground">Cash</p><p className="text-lg font-bold">{fmtKES(totalsByMode.cash ?? 0)}</p></Card>
            <Card className="p-3"><p className="text-xs text-muted-foreground">M-Pesa</p><p className="text-lg font-bold">{fmtKES(totalsByMode.mpesa ?? 0)}</p></Card>
          </div>
          <div className="mt-3">
            <h3 className="text-sm font-medium">Breakdown by payment method</h3>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              {Object.keys(totalsByMode).length === 0 && <p>No transactions for today.</p>}
              {Object.entries(totalsByMode).map(([mode, amt]) => (
                <div key={mode} className="flex justify-between"><span className="capitalize">{mode}</span><span>{fmtKES(amt)}</span></div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold">Itemized Products Sold Today</h3>
          {itemSummary.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-3">No item sales for today.</p>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-[1fr_90px_120px] gap-2 text-xs text-muted-foreground">
                <span>Product</span>
                <span className="text-right">Quantity</span>
                <span className="text-right">Amount</span>
              </div>
              {itemSummary.map((row) => (
                <div key={row.name} className="grid grid-cols-[1fr_90px_120px] gap-2 border-t pt-2 text-sm">
                  <span className="truncate">{row.name}</span>
                  <span className="text-right">{row.quantity}</span>
                  <span className="text-right">{fmtKES(row.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
