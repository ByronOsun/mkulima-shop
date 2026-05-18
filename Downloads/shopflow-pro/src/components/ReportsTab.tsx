import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtKES, usernameFromEmail } from "@/lib/format";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { addPdfLetterhead } from "@/lib/pdf";
import type { Tables } from "@/integrations/supabase/types";

type Shop = Tables<"shops">;
type Txn = Tables<"transactions">;
type TxnItem = Tables<"transaction_items">;

type PdfRow = Txn & {
  itemsSold: string;
};

export function ReportsTab({ shops }: { shops: Shop[] }) {
  const [shopId, setShopId] = useState<string>("all");
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<(Txn & { employee?: string; shop?: string })[]>([]);

  const run = async () => {
    let q = supabase.from("transactions").select("*").gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59`).order("created_at", { ascending: false });
    if (shopId !== "all") q = q.eq("shop_id", shopId);
    const { data: t } = await q;
    const txns = (t ?? []) as Txn[];
    const ids = Array.from(new Set(txns.map((x) => x.employee_id)));
    const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    const byId = new Map(profs?.map((p) => [p.id, usernameFromEmail(p.email)]));
    const byShop = new Map(shops.map((s) => [s.id, s.name]));
    setRows(txns.map((x) => ({ ...x, employee: byId.get(x.employee_id) ?? "—", shop: byShop.get(x.shop_id) ?? "—" })));
  };

  useEffect(() => { run(); }, []);

  const total = rows.reduce((s, r) => s + Number(r.total_amount), 0);
  const byMode = rows.reduce<Record<string, number>>((acc, r) => { acc[r.payment_mode] = (acc[r.payment_mode] ?? 0) + Number(r.total_amount); return acc; }, {});

  const exportPdf = async () => {
    const doc = new jsPDF();
    const letterheadEndY = addPdfLetterhead(doc, {
      title: "Sales Report",
      subtitle: shopId === "all" ? "All shops" : shops.find((s) => s.id === shopId)?.name,
      contact: shops.find((s) => s.id === shopId)?.contact_info || "07 002 132 28",
    });
    const { data: itemsData } = await supabase
      .from("transaction_items")
      .select("transaction_id, name_snapshot, quantity")
      .in("transaction_id", rows.map((r) => r.id));

    const itemsByTxn = (itemsData ?? []).reduce<Record<string, string[]>>((acc, item) => {
      const typed = item as Pick<TxnItem, "transaction_id" | "name_snapshot" | "quantity">;
      const label = `${typed.name_snapshot} x${typed.quantity}`;
      acc[typed.transaction_id] = acc[typed.transaction_id] ?? [];
      acc[typed.transaction_id].push(label);
      return acc;
    }, {});

    const pdfRows: PdfRow[] = rows.map((r) => ({
      ...r,
      itemsSold: (itemsByTxn[r.id] ?? []).join("; ") || "—",
    }));

    doc.setFontSize(10);
    doc.text(`From ${from} to ${to}`, 14, letterheadEndY);
    doc.text(`Total: ${fmtKES(total)}`, 14, letterheadEndY + 6);
    doc.text(`Cash: ${fmtKES(byMode.cash ?? 0)} · M-Pesa: ${fmtKES(byMode.mpesa ?? 0)} · ATM: ${fmtKES(byMode.atm ?? 0)}`, 14, letterheadEndY + 12);
    autoTable(doc, {
      startY: letterheadEndY + 20,
      head: [["Date", "Method", "Customer", "Itemized Items Sold", "Total"]],
      body: pdfRows.map((r) => [new Date(r.created_at).toLocaleString(), r.payment_mode, r.customer_name ?? "—", r.itemsSold, Number(r.total_amount).toFixed(2)]),
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [30, 41, 59] },
    });
    doc.save(`sales-${from}-to-${to}.pdf`);
  };

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({
      Date: new Date(r.created_at).toLocaleString(), Shop: r.shop, Employee: r.employee,
      Method: r.payment_mode, Customer: r.customer_name ?? "", Ref: r.ref_id ?? "", Total: Number(r.total_amount),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales");
    XLSX.writeFile(wb, `sales-${from}-to-${to}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Reports</h2>
      <Card className="p-4 grid sm:grid-cols-4 gap-3 items-end">
        <div className="space-y-2"><Label>Shop</Label>
          <Select value={shopId} onValueChange={setShopId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All shops</SelectItem>
              {shops.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-2"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <Button onClick={run}>Run report</Button>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
        <Card className="p-2 sm:p-3"><p className="text-xs text-muted-foreground">Transactions</p><p className="text-lg sm:text-xl font-bold">{rows.length}</p></Card>
        <Card className="p-2 sm:p-3"><p className="text-xs text-muted-foreground">Revenue</p><p className="text-lg sm:text-xl font-bold">{fmtKES(total)}</p></Card>
        <Card className="p-2 sm:p-3"><p className="text-xs text-muted-foreground">Cash</p><p className="text-lg sm:text-xl font-bold">{fmtKES(byMode.cash ?? 0)}</p></Card>
        <Card className="p-2 sm:p-3"><p className="text-xs text-muted-foreground">M-Pesa</p><p className="text-lg sm:text-xl font-bold">{fmtKES(byMode.mpesa ?? 0)}</p></Card>
        <Card className="p-2 sm:p-3 col-span-2 sm:col-span-1"><p className="text-xs text-muted-foreground">ATM</p><p className="text-lg sm:text-xl font-bold">{fmtKES(byMode.atm ?? 0)}</p></Card>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={exportPdf}><FileText className="h-4 w-4 mr-1" />Export PDF</Button>
        <Button variant="outline" onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4 mr-1" />Export Excel</Button>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Shop</TableHead><TableHead>Employee</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Total</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {rows.slice(0, 50).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>{r.shop}</TableCell>
                <TableCell>{r.employee}</TableCell>
                <TableCell>{r.payment_mode}</TableCell>
                <TableCell className="text-right">{fmtKES(Number(r.total_amount))}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/receipt/$id" params={{ id: r.id }}><FileText className="h-4 w-4 mr-1" />Receipt</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No data for the selected range.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
