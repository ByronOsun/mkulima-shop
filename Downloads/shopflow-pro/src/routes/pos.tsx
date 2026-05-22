import { createFileRoute, Navigate, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Cart } from "@/components/Cart";
import { useCart } from "@/lib/useCart";
import { CheckoutModal } from "@/components/CheckoutModal";
import { fmtKES, resolveUnitPrice, usernameFromEmail } from "@/lib/format";
import type { CartItem, CartCrateItem, CartBottleItem, Product } from "@/lib/types";
import { LogOut, History, Search, AlertTriangle, Megaphone, Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

const DEPOT_CAPACITIES = ["200ml", "300ml", "350ml", "400ml", "450ml", "500ml", "1 Litre", "1.25 Litres", "2 Litres"];

const getCapacityFromName = (name: string) => {
  const normalized = name.toLowerCase().replace(/\s+/g, " ");
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(ml|l|litre|litres|liter|liters)/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];

  if (unit === "ml") {
    if (amount === 200) return "200ml";
    if (amount === 300) return "300ml";
    if (amount === 350) return "350ml";
    if (amount === 400) return "400ml";
    if (amount === 450) return "450ml";
    if (amount === 500) return "500ml";
    if (amount === 1000) return "1 Litre";
    if (amount === 1250) return "1.25 Litres";
    if (amount === 2000) return "2 Litres";
    return null;
  }

  if (amount === 1) return "1 Litre";
  if (amount === 1.25) return "1.25 Litres";
  if (amount === 2) return "2 Litres";
  return null;
};

const getBottlePrice = (product: Product) => resolveUnitPrice(Number(product.price), product.discount_price);

const getDisplayName = (product: Product) => {
  const normalized = product.name.trim().toLowerCase();
  if (normalized === "coca-cola original - 500ml" && Number(product.price) === 80) {
    return "Coca-Cola Plastic Original - 500ml";
  }
  return product.name;
};

const buildCrateKey = (pricing: "retail" | "wholesale", mix: Array<{ product: Product; quantity: number }>, packSize: number) => {
  const parts = mix
    .slice()
    .sort((a, b) => a.product.id.localeCompare(b.product.id))
    .map((entry) => `${entry.product.id}:${entry.quantity}`);
  return `crate:${pricing}:${packSize}:${parts.join("|")}`;
};

export const Route = createFileRoute("/pos")({ component: POS });

function POS() {
  const { loading, session, role, shop, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useCart();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [broadcast, setBroadcast] = useState<string | null>(null);
  const [saleModes, setSaleModes] = useState<Record<string, "bottle" | "crate-retail" | "crate-wholesale">>({});
  const [crateOpen, setCrateOpen] = useState(false);
  const [crateCapacity, setCrateCapacity] = useState(DEPOT_CAPACITIES[0]);
  const [cratePricing, setCratePricing] = useState<"retail" | "wholesale">("retail");
  const [crateMix, setCrateMix] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!shop) return;
    supabase.from("products").select("*").eq("shop_id", shop.id).order("name").then(({ data }) => setProducts((data ?? []) as Product[]));

    const ch = supabase.channel(`pos-${shop.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `shop_id=eq.${shop.id}` }, (payload) => {
        setProducts((prev) => {
          if (payload.eventType === "DELETE") return prev.filter((p) => p.id !== (payload.old as Product).id);
          const np = payload.new as Product;
          const exists = prev.find((p) => p.id === np.id);
          return exists ? prev.map((p) => (p.id === np.id ? np : p)) : [...prev, np];
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "broadcasts", filter: `shop_id=eq.${shop.id}` }, (payload) => {
        const msg = (payload.new as { message: string }).message;
        setBroadcast(msg);
        toast.message("📣 Broadcast", { description: msg });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [shop]);

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];
  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchQ = !q || p.name.toLowerCase().includes(q);
    const matchC = category === "all" || p.category === category;
    return matchQ && matchC;
  });
  const lowStock = products.filter((p) => p.stock_quantity > 0 && p.stock_quantity < p.low_stock_threshold);

  const isDepot = shop?.slug === "depot";

  const addBottleToCart = (p: Product) => {
    if (p.stock_quantity <= 0) { toast.error("Out of stock"); return; }
    setCart((prev) => {
      const ex = prev.find((i) => i.kind === "bottle" && i.product.id === p.id) as CartBottleItem | undefined;
      if (ex) {
        if (ex.quantity >= p.stock_quantity) { toast.error("Stock limit reached"); return prev; }
        return prev.map((i) => (i.kind === "bottle" && i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { kind: "bottle", product: p, quantity: 1 }];
    });
  };

  const addSingleCrateToCart = (p: Product, pricing: "retail" | "wholesale") => {
    const packSize = Number(p.pack_size ?? 24);
    const required = packSize;
    if (p.stock_quantity < required) { toast.error("Insufficient stock for a full crate"); return; }
    if (pricing === "wholesale" && (p.price_wholesale_crate == null || Number(p.price_wholesale_crate) <= 0)) {
      toast.error("Wholesale crate price not set for this product");
      return;
    }

    const mix = [{ product: p, quantity: packSize }];
    const key = buildCrateKey(pricing, mix, packSize);

    setCart((prev) => {
      const ex = prev.find((i) => i.kind === "crate" && i.id === key) as CartCrateItem | undefined;
      if (ex) {
        const maxCrates = Math.floor(p.stock_quantity / packSize);
        if (ex.crateCount >= maxCrates) { toast.error("Stock limit reached"); return prev; }
        return prev.map((i) => (i.kind === "crate" && i.id === key ? { ...i, crateCount: i.crateCount + 1 } : i));
      }
      return [...prev, { kind: "crate", id: key, pricing, crateCount: 1, packSize, mix }];
    });
  };

  const addProductToCart = (p: Product) => {
    const mode = saleModes[p.id] ?? "bottle";
    if (mode === "bottle" || !isDepot) {
      addBottleToCart(p);
      return;
    }
    addSingleCrateToCart(p, mode === "crate-wholesale" ? "wholesale" : "retail");
  };

  const capacityProducts = useMemo(
    () => products.filter((p) => getCapacityFromName(p.name) === crateCapacity),
    [products, crateCapacity],
  );

  const crateTotalBottles = useMemo(
    () => Object.values(crateMix).reduce((sum, value) => sum + value, 0),
    [crateMix],
  );

  const crateWholesaleMismatch = useMemo(() => {
    if (cratePricing !== "wholesale") return false;
    const selected = capacityProducts.filter((p) => (crateMix[p.id] ?? 0) > 0);
    if (selected.length === 0) return false;
    const prices = selected.map((p) => Number(p.price_wholesale_crate ?? 0));
    if (prices.some((p) => p <= 0)) return true;
    return prices.some((p) => p !== prices[0]);
  }, [cratePricing, capacityProducts, crateMix]);

  const addMixedCrateToCart = () => {
    const packSize = 24;
    const mix = capacityProducts
      .map((p) => ({ product: p, quantity: crateMix[p.id] ?? 0 }))
      .filter((entry) => entry.quantity > 0);
    if (mix.length === 0) { toast.error("Select at least one product for the crate"); return; }
    if (crateTotalBottles !== packSize) { toast.error("A crate must contain exactly 24 bottles"); return; }
    if (cratePricing === "wholesale" && crateWholesaleMismatch) {
      toast.error("Wholesale crate prices are missing or inconsistent for the selected mix");
      return;
    }

    for (const entry of mix) {
      if (entry.product.stock_quantity < entry.quantity) {
        toast.error(`Insufficient stock for ${entry.product.name}`);
        return;
      }
    }

    const key = buildCrateKey(cratePricing, mix, packSize);
    setCart((prev) => {
      const ex = prev.find((i) => i.kind === "crate" && i.id === key) as CartCrateItem | undefined;
      if (ex) {
        const maxCrates = Math.min(
          ...mix.map((entry) => Math.floor(entry.product.stock_quantity / entry.quantity)),
        );
        if (ex.crateCount >= maxCrates) { toast.error("Stock limit reached"); return prev; }
        return prev.map((i) => (i.kind === "crate" && i.id === key ? { ...i, crateCount: i.crateCount + 1 } : i));
      }
      return [...prev, { kind: "crate", id: key, pricing: cratePricing, crateCount: 1, packSize, mix }];
    });

    setCrateMix({});
    setCrateOpen(false);
  };

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin" /></div>;
  if (!session) return <Navigate to="/login" />;
  if (role === "admin") return <Navigate to="/admin" />;
  if (!shop) return <div className="min-h-screen grid place-items-center p-4 text-center text-muted-foreground">No shop assigned to your account. Contact your admin.</div>;
  if (pathname.startsWith("/pos/history")) return <Outlet />;

  const accent = shop.accent === "red" ? "bg-depot text-depot-foreground" : "bg-beauty text-beauty-foreground";

  return (
    <div className="min-h-screen bg-muted/30">
      <header className={`${accent} px-4 py-3 flex items-center justify-between gap-2`}>
        <div className="min-w-0">
          <h1 className="font-bold text-lg leading-tight truncate">{shop.name}</h1>
          <p className="text-xs opacity-90 truncate">Cashier: {usernameFromEmail(profile?.email)}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() => navigate({ to: "/pos/history" })}
          >
            <History className="h-4 w-4 mr-1" />History
          </Button>
          <Button variant="secondary" size="icon" className="lg:hidden relative" onClick={() => setCartOpen(true)}>
            <ShoppingCart className="h-4 w-4" />
            {cart.length > 0 && <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">{cart.length}</Badge>}
          </Button>
          <Button variant="secondary" size="sm" className="hidden sm:inline-flex" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}><LogOut className="h-4 w-4 mr-1" />Sign out</Button>
          <Button variant="secondary" size="icon" className="sm:hidden" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      {broadcast && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center gap-2 text-sm">
          <Megaphone className="h-4 w-4 text-primary" />
          <span className="flex-1">{broadcast}</span>
          <button className="text-xs text-muted-foreground hover:underline" onClick={() => setBroadcast(null)}>Dismiss</button>
        </div>
      )}

      {lowStock.length > 0 && (
        <div className="bg-amber-100 dark:bg-amber-950/40 border-b border-amber-300/40 px-4 py-2 flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <span>{lowStock.length} product(s) low on stock: {lowStock.slice(0,3).map((p) => getDisplayName(p)).join(", ")}{lowStock.length > 3 ? "..." : ""}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_380px] gap-4 p-4">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {isDepot && (
              <Button variant="outline" size="sm" className="sm:size-auto" onClick={() => setCrateOpen(true)}>Build crate</Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={category === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setCategory("all")}>All</Badge>
            {categories.map((c) => (
              <Badge key={c} variant={category === c ? "default" : "outline"} className="cursor-pointer" onClick={() => setCategory(c)}>{c}</Badge>
            ))}
          </div>
          <div className="bg-white dark:bg-slate-950 rounded-lg overflow-x-auto border border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-4 min-w-fit p-3">
              {filtered.map((p) => {
                const out = p.stock_quantity <= 0;
                const low = p.stock_quantity > 0 && p.stock_quantity < p.low_stock_threshold;
                const mode = saleModes[p.id] ?? "bottle";
                const wholesaleDisabled = p.price_wholesale_crate == null || Number(p.price_wholesale_crate) <= 0;
                return (
                  <div key={p.id} className={`w-40 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 transition h-40 flex flex-col justify-between box-border ${out ? "opacity-50" : ""}`}>
                  <div className="flex justify-between items-start gap-1">
                    <p className="font-medium text-sm leading-tight">{getDisplayName(p)}</p>
                    {low && <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">Low</Badge>}
                    {out && <Badge variant="destructive" className="text-xs">Out</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{p.stock_quantity} in stock</p>
                  {p.discount_price && resolveUnitPrice(Number(p.price), p.discount_price) !== Number(p.price) ? (
                    <div className="mt-2">
                      <p className="font-semibold">{fmtKES(resolveUnitPrice(Number(p.price), p.discount_price))}</p>
                      <p className="text-xs text-muted-foreground line-through">{fmtKES(Number(p.price))}</p>
                    </div>
                  ) : (
                    <p className="font-semibold mt-2">{fmtKES(Number(p.price))}</p>
                  )}
                  {isDepot ? (
                    <div className="mt-3 space-y-2">
                      <Select
                        value={mode}
                        onValueChange={(value) => setSaleModes((prev) => ({ ...prev, [p.id]: value as typeof mode }))}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bottle">Single bottle</SelectItem>
                          <SelectItem value="crate-wholesale" disabled={wholesaleDisabled}>Crate (Wholesale)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button className="w-full" size="sm" disabled={out} onClick={() => addProductToCart(p)}>
                        Add
                      </Button>
                    </div>
                  ) : (
                    <Button className="w-full mt-3" size="sm" disabled={out} onClick={() => addProductToCart(p)}>
                      Add
                    </Button>
                  )}
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="col-span-full text-center text-sm text-muted-foreground py-12">No products match.</p>}
            </div>
          </div>
        </div>
        <div className="hidden lg:block lg:sticky lg:top-4 lg:self-start lg:h-[calc(100vh-2rem)]">
          <Cart items={cart} onChange={setCart} onCheckout={() => setCheckoutOpen(true)} />
        </div>
      </div>

      {/* Mobile Cart Drawer */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="right" className="w-full sm:w-96 p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle>Cart</SheetTitle>
              <SheetClose />
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-auto">
            <div className="p-4">
              <Cart items={cart} onChange={setCart} onCheckout={() => { setCheckoutOpen(true); setCartOpen(false); }} />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {isDepot && (
        <Dialog open={crateOpen} onOpenChange={setCrateOpen}>
          <DialogContent className="sm:max-w-[720px]">
            <DialogHeader><DialogTitle>Build mixed crate</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Capacity</Label>
                  <Select value={crateCapacity} onValueChange={(value) => { setCrateCapacity(value); setCrateMix({}); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEPOT_CAPACITIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pricing</Label>
                  <Select value={cratePricing} onValueChange={(value) => setCratePricing(value as "retail" | "wholesale")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retail">Crate (Retail)</SelectItem>
                      <SelectItem value="wholesale">Crate (Wholesale)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Select bottles (total must be 24)</span>
                  <span className={crateTotalBottles === 24 ? "text-emerald-600" : "text-muted-foreground"}>{crateTotalBottles}/24</span>
                </div>
                <div className="max-h-64 overflow-auto rounded-md border">
                  {capacityProducts.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No products for this capacity.</p>
                  )}
                  {capacityProducts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 border-b last:border-b-0 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">Stock: {p.stock_quantity}</p>
                      </div>
                      <Input
                        className="h-8 w-20 text-center"
                        type="number"
                        min={0}
                        max={p.stock_quantity}
                        value={crateMix[p.id] ?? 0}
                        onChange={(e) =>
                          setCrateMix((prev) => {
                            const current = prev[p.id] ?? 0;
                            const total = Object.values(prev).reduce((sum, value) => sum + value, 0);
                            const nextRaw = Number(e.target.value);
                            const remaining = 24 - (total - current);
                            const next = Math.max(0, Math.min(nextRaw, p.stock_quantity, remaining));
                            return { ...prev, [p.id]: next };
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                {cratePricing === "wholesale" && crateWholesaleMismatch && (
                  <p className="text-xs text-destructive">Wholesale crate prices must be set and equal for the selected brands.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCrateOpen(false)}>Cancel</Button>
              <Button onClick={addMixedCrateToCart} disabled={capacityProducts.length === 0 || crateTotalBottles !== 24}>Add crate</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <CheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} items={cart} onComplete={(id) => { setCart([]); setCheckoutOpen(false); navigate({ to: "/receipt/$id", params: { id } }); }} />
    </div>
  );
}
