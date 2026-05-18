import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Check, Trash2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { Tables } from "@/integrations/supabase/types"
import { addPdfLetterhead } from "@/lib/pdf"

type Product = Tables<"products">
type Shop = Tables<"shops">
type RestockOrder = Tables<"stock_restock_orders">

export function StockingTab({ shops, currentShopId }: { shops: Shop[]; currentShopId: string }) {
  const [products, setProducts] = useState<Product[]>([])
  const [restockOrders, setRestockOrders] = useState<(RestockOrder & { productName?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [requestQty, setRequestQty] = useState("")
  const [requestUnit, setRequestUnit] = useState<"bottle" | "crate">("bottle")

  const currentShop = shops.find((s) => s.id === currentShopId)
  const isCosmeticsShop = currentShop?.slug === "beauty" || currentShop?.slug === "ogopa" || currentShop?.slug === "cosmetics"

  const loadData = async () => {
    if (!currentShopId) return
    setLoading(true)

    try {
      // Load products
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("*")
        .eq("shop_id", currentShopId)
        .order("name", { ascending: true })

      if (productsError) throw productsError
      setProducts((productsData ?? []) as Product[])

      // Load pending restock orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("stock_restock_orders")
        .select("*")
        .eq("shop_id", currentShopId)
        .in("status", ["pending", "confirmed"])
        .order("created_at", { ascending: false })

      if (ordersError) throw ordersError

      // Enrich orders with product names
      const enriched = (ordersData ?? []).map((order) => ({
        ...order,
        productName: productsData?.find((p) => p.id === order.product_id)?.name,
      }))
      setRestockOrders(enriched as (RestockOrder & { productName?: string })[])
    } catch (error) {
      toast.error("Error loading data")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentShopId])

  const pendingOrders = useMemo(() => restockOrders.filter((o) => o.status === "pending"), [restockOrders])
  const confirmedOrders = useMemo(() => restockOrders.filter((o) => o.status === "confirmed"), [restockOrders])

  const handleRequestRestock = async () => {
    if (!selectedProduct || !requestQty) {
      toast.error("Select product and enter quantity")
      return
    }

    const qty = Number(requestQty)
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter valid quantity")
      return
    }

    // Convert crates to bottles if requested per crate (only for depot)
    let finalQty = qty
    if (!isCosmeticsShop && requestUnit === "crate") {
      const pack = Number(selectedProduct.pack_size ?? 0)
      if (!pack || pack <= 0) {
        toast.error("Selected product does not have a pack size defined")
        return
      }
      finalQty = qty * pack
    }

    const { error } = await supabase.from("stock_restock_orders").insert({
      shop_id: currentShopId,
      product_id: selectedProduct.id,
      quantity_requested: finalQty,
      quantity_unit: isCosmeticsShop ? "bottle" : requestUnit,
      quantity_unit_amount: isCosmeticsShop ? qty : (requestUnit === "crate" ? qty : qty),
      status: "pending",
    })

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success("Restock requested")
    setSelectedProduct(null)
    setRequestQty("")
    loadData()
  }

  const handleConfirm = async (order: RestockOrder) => {
    const product = products.find((p) => p.id === order.product_id)
    if (!product) return

    const newStock = Number(product.stock_quantity) + Number(order.quantity_requested)

    const { error: updateError } = await supabase
      .from("products")
      .update({ stock_quantity: newStock })
      .eq("id", order.product_id)

    if (updateError) {
      toast.error(updateError.message)
      return
    }

    const { error: orderError } = await supabase
      .from("stock_restock_orders")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", order.id)

    if (orderError) {
      toast.error(orderError.message)
      return
    }

    toast.success("Stock updated")
    loadData()
  }

  const handleConfirmAll = async () => {
    if (pendingOrders.length === 0) {
      toast.error("No pending restocks")
      return
    }

    for (const order of pendingOrders) {
      await handleConfirm(order)
    }
  }

  const handleCancel = async (order: RestockOrder) => {
    const { error } = await supabase
      .from("stock_restock_orders")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", order.id)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success("Restock cancelled")
    loadData()
  }

  const exportPendingPdf = () => {
    const doc = new jsPDF()
    const letterheadEndY = addPdfLetterhead(doc, {
      title: "Pending Restock Orders",
      subtitle: currentShop?.name || "Shop restocking",
      contact: currentShop?.contact_info || "07 002 132 28",
    })

    const rows = pendingOrders.map((order) => [
      order.productName || "Unknown",
      String(order.quantity_requested),
      order.quantity_unit === "crate" && order.quantity_unit_amount ? String(order.quantity_unit_amount) : "",
      new Date(order.created_at).toLocaleDateString(),
    ])

    if (rows.length === 0) {
      doc.setFontSize(10)
      doc.text("No pending restocks", 14, letterheadEndY + 10)
    } else {
      autoTable(doc, {
        startY: letterheadEndY + 6,
        head: [["Product", "Quantity Requested", "Crates", "Requested on"]],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: [37, 99, 235], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didDrawPage: () => {
          const footerY = doc.internal.pageSize.getHeight() - 10
          doc.setFontSize(8)
          doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, doc.internal.pageSize.getWidth() / 2, footerY, {
            align: "center",
          })
        },
      })
    }

    doc.save(`pending-restocks-${currentShop?.slug || "shop"}.pdf`)
  }

  return (
    <div className="space-y-6">
      {/* Request New Restock Section */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Request Restock</h3>
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Product</Label>
              <select
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={selectedProduct?.id || ""}
                onChange={(e) => setSelectedProduct(products.find((p) => p.id === e.target.value) || null)}
              >
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Current: {p.stock_quantity})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Quantity to request</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  value={requestQty}
                  onChange={(e) => setRequestQty(e.target.value)}
                  placeholder={isCosmeticsShop ? "e.g. 24" : (requestUnit === "crate" ? "e.g. 10 (crates)" : "e.g. 24 (bottles)")}
                />
                {!isCosmeticsShop && (
                  <select
                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    value={requestUnit}
                    onChange={(e) => setRequestUnit(e.target.value as "bottle" | "crate")}
                  >
                    <option value="bottle">Per bottle</option>
                    <option value="crate">Per crate</option>
                  </select>
                )}
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={handleRequestRestock} className="w-full">
                Request Restock
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Pending Restocks Section */}
      <Card>
        <div className="p-4 border-b flex justify-between items-center">
          <div>
            <h3 className="font-semibold">Pending Restocks ({pendingOrders.length})</h3>
            <p className="text-sm text-muted-foreground">Items awaiting purchase and confirmation</p>
          </div>
          <div className="space-x-2">
            <Button
              variant="outline"
              onClick={exportPendingPdf}
              disabled={pendingOrders.length === 0}
              size="sm"
            >
              <Download className="mr-1 h-4 w-4" /> PDF
            </Button>
            {pendingOrders.length > 0 && (
              <Button onClick={handleConfirmAll} size="sm">
                <Check className="mr-1 h-4 w-4" /> Confirm All
              </Button>
            )}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Crates</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No pending restocks
                </TableCell>
              </TableRow>
            ) : (
              pendingOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.productName}</TableCell>
                  <TableCell>{order.quantity_requested}</TableCell>
                  <TableCell>{order.quantity_unit === "crate" && order.quantity_unit_amount ? order.quantity_unit_amount : ""}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" onClick={() => handleConfirm(order)}>
                      <Check className="mr-1 h-4 w-4" /> Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCancel(order)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {confirmedOrders.length > 0 && (
        <Card>
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <Badge>Confirmed ({confirmedOrders.length})</Badge>
            </h3>
            <p className="text-sm text-muted-foreground">Stock has been updated for these items</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Qty Added</TableHead>
                <TableHead>Crates</TableHead>
                <TableHead>Confirmed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {confirmedOrders.map((order) => (
                <TableRow key={order.id} className="bg-green-50/50">
                  <TableCell className="font-medium">{order.productName}</TableCell>
                  <TableCell>{order.quantity_requested}</TableCell>
                  <TableCell>{order.quantity_unit === "crate" && order.quantity_unit_amount ? order.quantity_unit_amount : ""}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {order.confirmed_at ? new Date(order.confirmed_at).toLocaleDateString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Current Stock Levels */}
      <Card>
        <div className="p-4 border-b">
          <h3 className="font-semibold">Current Stock Levels</h3>
          <p className="text-sm text-muted-foreground">All products in this shop</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Current Stock</TableHead>
              <TableHead>Low Alert</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => {
                const low = Number(product.stock_quantity) <= Number(product.low_stock_threshold)
                return (
                  <TableRow key={product.id} className={low ? "bg-amber-50/50" : undefined}>
                    <TableCell className="font-medium">
                      {product.name}
                      {low && (
                        <Badge variant="outline" className="ml-2 border-amber-500 text-amber-600">
                          <AlertTriangle className="mr-1 h-3 w-3" /> Low
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{Number(product.stock_quantity ?? 0)}</TableCell>
                    <TableCell>{Number(product.low_stock_threshold ?? 0)}</TableCell>
                    <TableCell>{low ? <Badge variant="destructive">Priority</Badge> : <Badge variant="secondary">OK</Badge>}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

