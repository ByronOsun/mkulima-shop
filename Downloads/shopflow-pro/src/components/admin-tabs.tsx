import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { fmtKES, resolveUnitPrice, usernameFromEmail } from "@/lib/format";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;
type Shop = Tables<"shops">;

const DEPOT_CAPACITIES = ["200ml", "300ml", "350ml", "400ml", "450ml", "500ml", "1 Litre", "1.25 Litres", "2 Litres"] as const;
const DEPOT_BRANDS = [
  { brand: "Coca-Cola", variants: ["Original", "Zero Sugar", "Light/Diet"] },
  { brand: "Fanta", variants: ["Orange", "Passion", "Black Currant"] },
  { brand: "Sprite", variants: ["Classic"] },
  { brand: "Stoney Tangawizi", variants: ["Ginger"] },
  { brand: "Krest", variants: ["Bitter Lemon", "Tonic Water"] },
  { brand: "Minute Maid", variants: ["Tropical", "Mango", "Apple"] },
  { brand: "Dasani", variants: ["Mineral Water"] },
  { brand: "Keringet", variants: ["Still Water", "Sparkling Water", "Flavoured Water"] },
  { brand: "Quencher", variants: ["Mineral Water"] },
  { brand: "Novida", variants: ["Soft Drink"] },
  { brand: "Predator", variants: ["Soft Drink"] },
  { brand: "Charged", variants: ["Energy Drink"] },
  { brand: "Lemonade", variants: ["Soft Drink"] },
  { brand: "Power Play", variants: ["Energy Drink"] },
  { brand: "Bravado", variants: ["Energy Drink"] },
  { brand: "Planet", variants: ["Mineral Water"] },
];

const buildDepotName = (brand: string, variant: string, capacity: string) =>
  brand && variant && capacity ? `${brand} ${variant} - ${capacity}` : "";

const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const buildDepotSku = (brand: string, variant: string, capacity: string) =>
  brand && variant && capacity ? `DEP-${slugify(brand)}-${slugify(variant)}-${slugify(capacity)}` : "";

const normalizeProductName = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

const applyDepotNameRules = (name: string, price: number) => {
  const normalized = normalizeProductName(name);
  if (normalized === "coca-cola original - 500ml" && price === 80) {
    return "Coca-Cola Plastic Original - 500ml";
  }
  return name;
};

const parseDepotName = (name: string) => {
  const [left, capacity] = name.split(" - ");
  if (!left || !capacity) return null;
  const normalizedLeft = left.startsWith("Coca-Cola Plastic ") ? left.replace("Coca-Cola Plastic ", "Coca-Cola ") : left;
  for (const entry of DEPOT_BRANDS) {
    if (!normalizedLeft.startsWith(`${entry.brand} `)) continue;
    const variant = normalizedLeft.slice(entry.brand.length + 1);
    if (entry.variants.includes(variant) || (entry.brand === "Minute Maid" && variant === "Mango Extra")) {
      return { brand: entry.brand, variant: variant === "Mango Extra" ? "Apple" : variant, capacity };
    }
  }
  return null;
};

export function ProductsTab({ shops, currentShopId }: { shops: Shop[]; currentShopId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [open, setOpen] = useState(false);
  const [depotCrates, setDepotCrates] = useState(0);
  const [depotBrand, setDepotBrand] = useState("");
  const [depotVariant, setDepotVariant] = useState("");
  const [depotCapacity, setDepotCapacity] = useState("");

  const currentShop = shops.find((s) => s.id === currentShopId);
  const isDepot = currentShop?.slug === "depot";

  const ensureSku = (product: Partial<Product>) => product.sku ?? `AUTO-${Date.now()}`;
  const parseOptionalNumber = (value: string) => (value.trim() === "" ? null : Number(value));
  const packSize = Number(editing?.pack_size ?? 24);

  useEffect(() => {
    if (!isDepot || !editing) return;
    const total = Number(editing.stock_quantity ?? 0);
    const safePack = packSize > 0 ? packSize : 24;
    setDepotCrates(Math.floor(total / safePack));
  }, [editing?.id, editing?.stock_quantity, editing?.pack_size, isDepot, packSize]);

  useEffect(() => {
    if (!isDepot) return;
    if (!editing?.name) {
      setDepotBrand("");
      setDepotVariant("");
      setDepotCapacity("");
      return;
    }
    const parsed = parseDepotName(editing.name);
    if (!parsed) return;
    setDepotBrand(parsed.brand);
    setDepotVariant(parsed.variant);
    setDepotCapacity(parsed.capacity);
  }, [editing?.id, editing?.name, isDepot]);

  const load = async () => {
    const { data } = await supabase.from("products").select("*").eq("shop_id", currentShopId).order("name");
    setProducts((data ?? []) as Product[]);
  };
  useEffect(() => { load(); }, [currentShopId]);

  const save = async () => {
    if (!editing?.name || editing.price == null) { toast.error("Name and price required"); return; }
    if (isDepot && packSize <= 0) { toast.error("Pack size must be greater than 0"); return; }
    const normalizedName = isDepot ? applyDepotNameRules(editing.name!, Number(editing.price)) : editing.name!;
    const totalStock = isDepot
      ? depotCrates * packSize
      : Number(editing.stock_quantity ?? 0);
    const depotSku = isDepot ? buildDepotSku(depotBrand, depotVariant, depotCapacity) : "";
    const payload = {
      shop_id: currentShopId,
      name: normalizedName,
      sku: isDepot ? depotSku || ensureSku(editing) : ensureSku(editing),
      price: Number(editing.price),
      discount_price: editing.discount_price == null ? null : Number(editing.discount_price),
      pack_size: isDepot ? packSize : null,
      price_wholesale_crate: editing.price_wholesale_crate == null ? null : Number(editing.price_wholesale_crate),
      stock_quantity: totalStock,
      category: editing.category ?? null,
      low_stock_threshold: Number(editing.low_stock_threshold ?? 10),
    };
    const res = editing.id
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : isDepot
        ? await (async () => {
            const { data: existingProducts, error: lookupError } = await supabase
              .from("products")
              .select("id, name, sku, stock_quantity, pack_size")
              .eq("shop_id", currentShopId);
            if (lookupError) return { error: lookupError };

            const existing = (existingProducts ?? []).find((p) =>
              normalizeProductName(p.name) === normalizeProductName(normalizedName) || (depotSku && p.sku === depotSku)
            );

            if (existing) {
              const existingPack = Number(existing.pack_size ?? packSize ?? 24);
              const addedStock = depotCrates * (existingPack > 0 ? existingPack : packSize);
              return supabase.from("products").update({
                stock_quantity: Number(existing.stock_quantity ?? 0) + addedStock,
              }).eq("id", existing.id);
            }

            return supabase.from("products").insert(payload);
          })()
        : await supabase.from("products").insert(payload);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Saved");
    setOpen(false); setEditing(null); load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Products — {shops.find((s) => s.id === currentShopId)?.name}</h2>
        <Dialog open={open} onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setEditing(null);
            setDepotBrand("");
            setDepotVariant("");
            setDepotCapacity("");
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              const defaultBrand = DEPOT_BRANDS[0];
              const defaultVariant = defaultBrand?.variants[0] ?? "";
              const defaultCapacity = DEPOT_CAPACITIES[0];
              const defaultName = buildDepotName(defaultBrand?.brand ?? "", defaultVariant, defaultCapacity);
              setEditing({
                name: isDepot ? defaultName : "",
                price: 0,
                discount_price: null,
                stock_quantity: 0,
                low_stock_threshold: 10,
                pack_size: 24,
                price_wholesale_crate: null,
                category: isDepot ? defaultBrand?.brand ?? null : null,
              });
              setDepotCrates(0);
              if (isDepot) {
                setDepotBrand(defaultBrand?.brand ?? "");
                setDepotVariant(defaultVariant);
                setDepotCapacity(defaultCapacity);
              }
            }}><Plus className="h-4 w-4 mr-1" />Add product</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[760px]">
            <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "Add"} product</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {isDepot ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Product grouping</Label>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Brand</Label>
                        <Select
                          value={depotBrand}
                          onValueChange={(value) => {
                            const variants = DEPOT_BRANDS.find((b) => b.brand === value)?.variants ?? [];
                            const nextVariant = variants[0] ?? "";
                            const nextName = buildDepotName(value, nextVariant, depotCapacity);
                            setDepotBrand(value);
                            setDepotVariant(nextVariant);
                            setEditing({ ...editing!, name: nextName || "", category: value });
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                          <SelectContent>
                            {DEPOT_BRANDS.map((b) => (
                              <SelectItem key={b.brand} value={b.brand}>{b.brand}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Variant</Label>
                        <Select
                          value={depotVariant}
                          onValueChange={(value) => {
                            const nextName = buildDepotName(depotBrand, value, depotCapacity);
                            setDepotVariant(value);
                            setEditing({ ...editing!, name: nextName || "" });
                          }}
                          disabled={!depotBrand}
                        >
                          <SelectTrigger><SelectValue placeholder="Select variant" /></SelectTrigger>
                          <SelectContent>
                            {(DEPOT_BRANDS.find((b) => b.brand === depotBrand)?.variants ?? []).map((v) => (
                              <SelectItem key={v} value={v}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Capacity</Label>
                        <Select
                          value={depotCapacity}
                          onValueChange={(value) => {
                            const nextName = buildDepotName(depotBrand, depotVariant, value);
                            setDepotCapacity(value);
                            setEditing({ ...editing!, name: nextName || "" });
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                          <SelectContent>
                            {DEPOT_CAPACITIES.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Product name</Label>
                    <Input value={editing?.name ?? ""} readOnly />
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input value={editing?.category ?? ""} onChange={(e) => setEditing({ ...editing!, category: e.target.value })} />
                  </div>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{isDepot ? "Retail price per bottle" : "Price"}</Label>
                  <Input type="number" step="0.01" value={editing?.price ?? 0} onChange={(e) => setEditing({ ...editing!, price: Number(e.target.value) })} />
                </div>
                {!isDepot && (
                  <div className="space-y-2">
                    <Label>Discounted price (optional)</Label>
                    <Input type="number" step="0.01" value={editing?.discount_price ?? ""} onChange={(e) => setEditing({ ...editing!, discount_price: parseOptionalNumber(e.target.value) })} />
                  </div>
                )}
                {/* Retail price per crate removed */}
              </div>

                {isDepot && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Wholesale price per crate (optional)</Label>
                      <Input type="number" step="0.01" value={editing?.price_wholesale_crate ?? ""} onChange={(e) => setEditing({ ...editing!, price_wholesale_crate: parseOptionalNumber(e.target.value) })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Pack size (bottles per crate)</Label>
                      <Input type="number" value={packSize} onChange={(e) => setEditing({ ...editing!, pack_size: Number(e.target.value) })} />
                    </div>
                  </div>
                )}

              <div className="grid gap-3 md:grid-cols-2">
                {isDepot ? (
                  <div className="space-y-2">
                    <Label>Stock (crates)</Label>
                    <Input type="number" value={depotCrates} onChange={(e) => setDepotCrates(Number(e.target.value))} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Stock</Label>
                    <Input type="number" value={editing?.stock_quantity ?? 0} onChange={(e) => setEditing({ ...editing!, stock_quantity: Number(e.target.value) })} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Low alert</Label>
                  <Input type="number" value={editing?.low_stock_threshold ?? 10} onChange={(e) => setEditing({ ...editing!, low_stock_threshold: Number(e.target.value) })} />
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Price</TableHead><TableHead>Stock</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {products.map((p) => {
              const low = p.stock_quantity < p.low_stock_threshold;
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.category}</TableCell>
                  <TableCell>
                    {p.discount_price && resolveUnitPrice(Number(p.price), p.discount_price) !== Number(p.price) ? (
                      <div>
                        <div className="font-medium">{fmtKES(resolveUnitPrice(Number(p.price), p.discount_price))}</div>
                        <div className="text-xs text-muted-foreground line-through">{fmtKES(Number(p.price))}</div>
                      </div>
                    ) : (
                      fmtKES(Number(p.price))
                    )}
                  </TableCell>
                  <TableCell>{p.stock_quantity} {low && <Badge variant="outline" className="ml-1 border-amber-500 text-amber-600">Low</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(p);
                        if (isDepot) {
                          const parsed = parseDepotName(p.name ?? "");
                          setDepotBrand(parsed?.brand ?? "");
                          setDepotVariant(parsed?.variant ?? "");
                          setDepotCapacity(parsed?.capacity ?? "");
                        }
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export function EmployeesTab({ shops }: { shops: Shop[] }) {
  const [rows, setRows] = useState<(Tables<"profiles"> & { role?: string })[]>([]);
  const load = async () => {
    const { data: profs } = await supabase.from("profiles").select("*").order("created_at");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const byUser = new Map(roles?.map((r) => [r.user_id, r.role]));
    setRows(((profs ?? []) as Tables<"profiles">[]).map((p) => ({ ...p, role: byUser.get(p.id) })));
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Employees</h2>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Shop</TableHead><TableHead>Last login</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{usernameFromEmail(r.email)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.email}</TableCell>
                <TableCell><Badge variant={r.role === "admin" ? "default" : "secondary"}>{r.role}</Badge></TableCell>
                <TableCell>{shops.find((s) => s.id === r.shop_id)?.name ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.last_login ? new Date(r.last_login).toLocaleString() : "Never"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <p className="text-xs text-muted-foreground">To add or remove employees, contact your platform administrator. Demo accounts are pre-seeded.</p>
    </div>
  );
}

export function TransactionsTab({ shops, currentShopId }: { shops: Shop[]; currentShopId: string }) {
  const [rows, setRows] = useState<(Tables<"transactions"> & { employee?: string })[]>([]);
  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from("transactions").select("*").eq("shop_id", currentShopId).order("created_at", { ascending: false }).limit(200);
      const ids = Array.from(new Set((t ?? []).map((x) => x.employee_id)));
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      const byId = new Map(profs?.map((p) => [p.id, usernameFromEmail(p.email)]));
      setRows(((t ?? []) as Tables<"transactions">[]).map((x) => ({ ...x, employee: byId.get(x.employee_id) ?? "—" })));
    })();
  }, [currentShopId]);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Transactions — {shops.find((s) => s.id === currentShopId)?.name}</h2>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Employee</TableHead><TableHead>Customer</TableHead><TableHead>Method</TableHead><TableHead>Ref</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-xs">{new Date(t.created_at).toLocaleString()}</TableCell>
                <TableCell>{t.employee}</TableCell>
                <TableCell>{t.customer_name ?? "—"}</TableCell>
                <TableCell><Badge variant="outline">{t.payment_mode}</Badge></TableCell>
                <TableCell className="text-xs">{t.ref_id ?? "—"}</TableCell>
                <TableCell className="text-right font-medium">{fmtKES(Number(t.total_amount))}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No transactions yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export function BroadcastTab({ shops }: { shops: Shop[] }) {
  const [shopId, setShopId] = useState(shops[0]?.id ?? "");
  const [msg, setMsg] = useState("");
  const send = async () => {
    if (!msg.trim()) return;
    const { error } = await supabase.from("broadcasts").insert({ shop_id: shopId, message: msg.trim() });
    if (error) toast.error(error.message); else { toast.success("Broadcast sent"); setMsg(""); }
  };
  return (
    <Card className="p-4 space-y-3 max-w-xl">
      <h2 className="text-lg font-semibold">Send Broadcast</h2>
      <div className="space-y-2">
        <Label>Shop</Label>
        <Select value={shopId} onValueChange={setShopId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{shops.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Message</Label>
        <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="e.g. Promo: Buy 2 get 1 free on lipstick today" />
      </div>
      <Button onClick={send}>Send to shop</Button>
    </Card>
  );
}

export { StockingTab } from "@/components/StockingTab";
