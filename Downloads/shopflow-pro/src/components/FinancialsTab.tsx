import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Download, Plus, Trash2 } from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { addPdfLetterhead } from "@/lib/pdf"
import type { Tables } from "@/integrations/supabase/types"

type FinancialPeriod = Tables<"shop_financial_periods">
type FinancialEntry = Tables<"shop_financial_entries">

type Shop = Tables<"shops">

export function FinancialsTab({ shops, currentShopId }: { shops: Shop[]; currentShopId: string }) {
  const { user, role } = useAuth()
  const shop = shops.find((s) => s.id === currentShopId) ?? null
  const [periods, setPeriods] = useState<FinancialPeriod[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [revenue, setRevenue] = useState(0)
  const [loading, setLoading] = useState(true)

  // Form state
  const [newEntryType, setNewEntryType] = useState<"expense" | "investment">(
    "expense"
  )
  const [newTitle, setNewTitle] = useState("")
  const [newCategory, setNewCategory] = useState("")
  const [newAmount, setNewAmount] = useState("")
  const [newPeriodStart, setNewPeriodStart] = useState("")
  const [newPeriodEnd, setNewPeriodEnd] = useState("")

  // Load periods and entries
  useEffect(() => {
    const loadData = async () => {
      if (!shop?.id || role !== "admin") {
        setLoading(false)
        return
      }

      try {
        // Fetch periods
        const { data: periodsData } = await supabase
          .from("shop_financial_periods")
          .select("*")
          .eq("shop_id", shop.id)
          .order("period_start", { ascending: false })

        setPeriods(periodsData || [])

        // Set selected period to most recent
        if (periodsData && periodsData.length > 0) {
          setSelectedPeriodId(periodsData[0].id)
        }
      } catch (error) {
        console.error("Error loading financial periods:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [shop?.id, role])

  // Load entries and calculate revenue when period changes
  useEffect(() => {
    const loadEntriesAndRevenue = async () => {
      if (!selectedPeriodId || !shop?.id) return

      try {
        // Get selected period details
        const { data: period } = await supabase
          .from("shop_financial_periods")
          .select("*")
          .eq("id", selectedPeriodId)
          .single()

        if (!period) return

        // Fetch entries
        const { data: entriesData } = await supabase
          .from("shop_financial_entries")
          .select("*")
          .eq("period_id", selectedPeriodId)
          .order("created_at", { ascending: false })

        setEntries(entriesData || [])

        // Calculate revenue from transactions in this period
        const { data: transactionsData } = await supabase
          .from("transactions")
          .select("total_amount")
          .eq("shop_id", shop.id)
          .gte("created_at", `${period.period_start}T00:00:00`)
          .lte("created_at", `${period.period_end}T23:59:59`)

        const totalRevenue = transactionsData?.reduce(
          (sum, tx) => sum + (tx.total_amount || 0),
          0
        ) || 0
        setRevenue(totalRevenue)
      } catch (error) {
        console.error("Error loading entries and revenue:", error)
      }
    }

    loadEntriesAndRevenue()
  }, [selectedPeriodId, shop?.id])

  // Calculate totals
  const totals = useMemo(() => {
    const expenses = entries
      .filter((e) => e.entry_type === "expense")
      .reduce((sum, e) => sum + (e.amount || 0), 0)
    const investments = entries
      .filter((e) => e.entry_type === "investment")
      .reduce((sum, e) => sum + (e.amount || 0), 0)
    const profit = revenue - expenses

    return { expenses, investments, profit }
  }, [entries, revenue])

  const handleCreatePeriod = async () => {
    if (!shop?.id || !newPeriodStart || !newPeriodEnd) return

    try {
      const { error } = await supabase
        .from("shop_financial_periods")
        .insert({
          shop_id: shop.id,
          period_start: newPeriodStart,
          period_end: newPeriodEnd,
          created_by: user?.id,
        })

      if (error) throw error

      setNewPeriodStart("")
      setNewPeriodEnd("")

      // Reload periods
      const { data: periodsData } = await supabase
        .from("shop_financial_periods")
        .select("*")
        .eq("shop_id", shop.id)
        .order("period_start", { ascending: false })

      setPeriods(periodsData || [])
    } catch (error) {
      console.error("Error creating period:", error)
    }
  }

  const handleAddEntry = async () => {
    if (!selectedPeriodId || !newTitle || !newAmount) return

    try {
      const { error } = await supabase
        .from("shop_financial_entries")
        .insert({
          shop_id: shop?.id!,
          period_id: selectedPeriodId,
          entry_type: newEntryType,
          title: newTitle,
          category: newCategory || null,
          amount: parseFloat(newAmount),
        })

      if (error) throw error

      setNewTitle("")
      setNewCategory("")
      setNewAmount("")

      // Reload entries
      const { data: entriesData } = await supabase
        .from("shop_financial_entries")
        .select("*")
        .eq("period_id", selectedPeriodId)
        .order("created_at", { ascending: false })

      setEntries(entriesData || [])
    } catch (error) {
      console.error("Error adding entry:", error)
    }
  }

  const handleDeleteEntry = async (id: string) => {
    try {
      const { error } = await supabase
        .from("shop_financial_entries")
        .delete()
        .eq("id", id)

      if (error) throw error

      setEntries(entries.filter((e) => e.id !== id))
    } catch (error) {
      console.error("Error deleting entry:", error)
    }
  }

  const exportToCSV = () => {
    if (!selectedPeriodId || !entries.length) return

    const period = periods.find((p) => p.id === selectedPeriodId)
    if (!period) return

    const csvData = [
      ["Financial Report", shop?.name || "Shop"],
      ["Period", `${period.period_start} to ${period.period_end}`],
      ["Generated", new Date().toLocaleString()],
      [],
      ["Summary"],
      ["Revenue", `${revenue.toFixed(2)}`],
      ["Total Expenses", `${totals.expenses.toFixed(2)}`],
      ["Total Investments", `${totals.investments.toFixed(2)}`],
      ["Profit", `${totals.profit.toFixed(2)}`],
      [],
      ["Expenses & Investments"],
      [
        "Type",
        "Title",
        "Category",
        "Amount",
        "Created",
      ],
      ...entries.map((e) => [
        e.entry_type,
        e.title,
        e.category || "",
        e.amount,
        new Date(e.created_at).toLocaleDateString(),
      ]),
    ]

    const csv = csvData
      .map((row) =>
        row.map((cell) => `"${cell}"`).join(",")
      )
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `financials-${shop?.slug || "shop"}-${period.period_start}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportToPDF = () => {
    if (!selectedPeriodId) return

    const period = periods.find((p) => p.id === selectedPeriodId)
    if (!period) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    let yPos = addPdfLetterhead(doc, {
      title: "Financial Report",
      subtitle: shop?.name || "Shop",
      contact: shop?.contact_info || "07 002 132 28",
    })

    doc.setFontSize(10)
    doc.text(`Period: ${period.period_start} to ${period.period_end}`, pageWidth / 2, yPos, { align: "center" })
    yPos += 6
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: "center" })
    yPos += 12

    // Summary Section
    doc.setFontSize(12)
    doc.text("Summary", 15, yPos)
    yPos += 8

    doc.setFontSize(10)
    const summaryRows = [
      ["Revenue:", `${revenue.toFixed(2)}`],
      ["Total Expenses:", `${totals.expenses.toFixed(2)}`],
      ["Total Investments:", `${totals.investments.toFixed(2)}`],
      ["Profit:", `${totals.profit.toFixed(2)}`],
    ]

    summaryRows.forEach(([label, value]) => {
      doc.text(label, 20, yPos)
      doc.text(value, pageWidth - 20, yPos, { align: "right" })
      yPos += 6
    })

    yPos += 8

    // Entries Table
    if (entries.length > 0) {
      doc.setFontSize(12)
      doc.text("Entries", 15, yPos)
      yPos += 8

      const tableData = entries.map((e) => [
        e.entry_type.charAt(0).toUpperCase() + e.entry_type.slice(1),
        e.title,
        e.category || "-",
        e.amount.toFixed(2),
        new Date(e.created_at).toLocaleDateString(),
      ])

      autoTable(doc, {
        startY: yPos,
        head: [["Type", "Title", "Category", "Amount", "Date"]],
        body: tableData,
        theme: "grid",
        margin: { left: 15, right: 15 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        didDrawPage: (data: unknown) => {
          const pageCount = doc.internal.pages.length
          const footerY = doc.internal.pageSize.getHeight() - 10
          doc.setFontSize(8)
          doc.text(
            `Page ${pageCount}`,
            pageWidth / 2,
            footerY,
            { align: "center" }
          )
        },
      })
    }

    doc.save(`financials-${shop?.slug || "shop"}-${period.period_start}.pdf`)
  }

  if (role !== "admin") {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Only administrators can access financial reports.
        </AlertDescription>
      </Alert>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-sm text-muted-foreground">
            Loading financial data...
          </p>
        </CardContent>
      </Card>
    )
  }

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId)

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Period</CardTitle>
          <CardDescription>
            Select or create a financial reporting period
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            {periods.length > 0 ? (
              <Select value={selectedPeriodId || ""} onValueChange={setSelectedPeriodId}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.period_start} to {period.period_end}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                No periods created yet
              </p>
            )}

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  New Period
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Financial Period</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="period-start">Start Date</Label>
                    <Input
                      id="period-start"
                      type="date"
                      value={newPeriodStart}
                      onChange={(e) => setNewPeriodStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="period-end">End Date</Label>
                    <Input
                      id="period-end"
                      type="date"
                      value={newPeriodEnd}
                      onChange={(e) => setNewPeriodEnd(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleCreatePeriod} className="w-full">
                    Create Period
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {selectedPeriod && (
        <>
          {/* Totals Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {revenue.toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {totals.expenses.toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Investments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {totals.investments.toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Profit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {totals.profit.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Add Entry */}
          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Expense / Investment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Financial Entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="entry-type">Type</Label>
                  <Select
                    value={newEntryType}
                    onValueChange={(v) =>
                      setNewEntryType(v as "expense" | "investment")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="investment">Investment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="entry-title">Title</Label>
                  <Input
                    id="entry-title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Staff Salary, Stock Purchase"
                  />
                </div>

                <div>
                  <Label htmlFor="entry-category">Category</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {newEntryType === "expense" ? (
                        <>
                          <SelectItem value="Salary">Salary</SelectItem>
                          <SelectItem value="Utilities">Utilities</SelectItem>
                          <SelectItem value="Rent">Rent</SelectItem>
                          <SelectItem value="Tax">Tax</SelectItem>
                          <SelectItem value="Maintenance">Maintenance</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="Equipment">Equipment</SelectItem>
                          <SelectItem value="Stock">Stock Purchase</SelectItem>
                          <SelectItem value="Infrastructure">
                            Infrastructure
                          </SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="entry-amount">Amount</Label>
                  <Input
                    id="entry-amount"
                    type="number"
                    step="0.01"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <Button onClick={handleAddEntry} className="w-full">
                  Add Entry
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Entries List */}
          <Card>
            <CardHeader>
              <CardTitle>Entries</CardTitle>
              <CardDescription>
                {entries.length} financial entries in this period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No entries yet
                </p>
              ) : (
                <div className="space-y-2">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded ${
                              entry.entry_type === "expense"
                                ? "bg-red-100 text-red-700"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {entry.entry_type.charAt(0).toUpperCase() +
                              entry.entry_type.slice(1)}
                          </span>
                          <span className="font-semibold">{entry.title}</span>
                          {entry.category && (
                            <span className="text-xs text-muted-foreground">
                              ({entry.category})
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-lg">
                          {entry.amount.toFixed(2)}
                        </span>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export Options */}
          <div className="flex gap-2">
            <Button
              onClick={exportToCSV}
              variant="outline"
              className="flex-1"
              disabled={entries.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button
              onClick={exportToPDF}
              variant="outline"
              className="flex-1"
              disabled={entries.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
