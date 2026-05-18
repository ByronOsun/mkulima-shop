import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import { ProductsTab, EmployeesTab, TransactionsTab, BroadcastTab, StockingTab } from "@/components/admin-tabs";
import { ReportsTab } from "@/components/ReportsTab";
import { FinancialsTab } from "@/components/FinancialsTab";
import { ActivityFeed } from "@/components/ActivityFeed";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin")({ component: Admin });

type Shop = Tables<"shops">;

function Admin() {
  const { loading, session, role, signOut, profile } = useAuth();
  const navigate = useNavigate();
  const [shops, setShops] = useState<Shop[]>([]);
  const [currentShopId, setCurrentShopId] = useState<string>("");

  useEffect(() => {
    supabase.from("shops").select("*").order("name").then(({ data }) => {
      setShops((data ?? []) as Shop[]);
      if (data?.[0] && !currentShopId) setCurrentShopId(data[0].id);
    });
  }, []);

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin" /></div>;
  if (!session) return <Navigate to="/login" />;
  if (role !== "admin") return <Navigate to="/pos" />;

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="bg-card border-b px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-bold truncate">Admin Dashboard</h1>
          <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={currentShopId} onValueChange={setCurrentShopId}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select shop" /></SelectTrigger>
            <SelectContent>{shops.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="ml-auto sm:ml-0" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}><LogOut className="h-4 w-4 mr-1" />Sign out</Button>
        </div>
      </header>

      <div className="p-3 sm:p-4 flex-1 overflow-auto">
        <Tabs defaultValue="overview" className="flex flex-col">
          <div className="overflow-x-auto pb-2 mb-2">
            <TabsList className="w-full inline-flex">
              <TabsTrigger value="overview" className="flex-shrink-0 text-xs sm:text-sm">Overview</TabsTrigger>
              <TabsTrigger value="products" className="flex-shrink-0 text-xs sm:text-sm">Products</TabsTrigger>
              <TabsTrigger value="transactions" className="flex-shrink-0 text-xs sm:text-sm">Txn</TabsTrigger>
              <TabsTrigger value="employees" className="flex-shrink-0 text-xs sm:text-sm">Staff</TabsTrigger>
              <TabsTrigger value="stocking" className="flex-shrink-0 text-xs sm:text-sm">Stock</TabsTrigger>
              <TabsTrigger value="reports" className="flex-shrink-0 text-xs sm:text-sm">Reports</TabsTrigger>
              <TabsTrigger value="financials" className="flex-shrink-0 text-xs sm:text-sm">Finance</TabsTrigger>
              <TabsTrigger value="broadcast" className="flex-shrink-0 text-xs sm:text-sm">Broadcast</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="overview" className="pt-4 grid lg:grid-cols-2 gap-4">
            <ActivityFeed />
            {currentShopId && <TransactionsTab shops={shops} currentShopId={currentShopId} />}
          </TabsContent>
          <TabsContent value="products" className="pt-4">{currentShopId && <ProductsTab shops={shops} currentShopId={currentShopId} />}</TabsContent>
          <TabsContent value="transactions" className="pt-4">{currentShopId && <TransactionsTab shops={shops} currentShopId={currentShopId} />}</TabsContent>
          <TabsContent value="employees" className="pt-4"><EmployeesTab shops={shops} /></TabsContent>
          <TabsContent value="stocking" className="pt-4">{currentShopId && <StockingTab shops={shops} currentShopId={currentShopId} />}</TabsContent>
          <TabsContent value="reports" className="pt-4"><ReportsTab shops={shops} /></TabsContent>
          <TabsContent value="financials" className="pt-4"><FinancialsTab shops={shops} currentShopId={currentShopId} /></TabsContent>
          <TabsContent value="broadcast" className="pt-4"><BroadcastTab shops={shops} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
