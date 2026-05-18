// @ts-nocheck
// Seeds shops and products for the multi-shop POS.
// Idempotent: safe to re-run.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Get shop IDs
    const { data: shops } = await admin.from("shops").select("id, slug");
    const beauty = shops?.find((s) => s.slug === "beauty");
    const depot = shops?.find((s) => s.slug === "depot");
    const ogopa = shops?.find((s) => s.slug === "ogopa");
    const cosmetics = shops?.find((s) => s.slug === "cosmetics");
    if (!beauty || !depot || !ogopa) throw new Error("Shops not seeded");
    if (!cosmetics) console.warn("⚠ Cosmetics shop not found, skipping cosmetics seed");

    const ensureUser = async (email: string, password: string, role: "admin" | "employee", shopId: string | null, fullName: string) => {
      let userId: string | null = null;
      const { data: existing } = await admin.auth.admin.listUsers();
      const found = existing.users.find((u) => u.email === email);
      if (found) {
        userId = found.id;
        await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email, password, email_confirm: true, user_metadata: { full_name: fullName },
        });
        if (error) throw error;
        userId = data.user!.id;
      }
      await admin.from("profiles").upsert({ id: userId, email, full_name: fullName, shop_id: shopId });
      await admin.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
      return userId;
    };

    await ensureUser("abigliz001.beauty@gmail.com", "123456", "employee", beauty.id, "abigliz001");
    await ensureUser("abigliz001.depot@gmail.com", "567890", "employee", depot.id, "abigliz001");
    await ensureUser("abigliz001.ogopa@gmail.com", "123456", "employee", ogopa.id, "abigliz001");
    if (cosmetics) {
      await ensureUser("abigliz001.cosmetics@gmail.com", "123456", "employee", cosmetics.id, "abigliz001");
    }
    await ensureUser("abigliz001@gmail.com", "255426", "admin", null, "abigliz001");

    // Products
    const beautyProducts = [
      { name: "Matte Lipstick - Ruby", sku: "BTY-LIP-001", price: 850, stock_quantity: 24, category: "Lips" },
      { name: "Liquid Foundation - Beige", sku: "BTY-FND-002", price: 1850, stock_quantity: 12, category: "Face" },
      { name: "Volume Mascara", sku: "BTY-MSC-003", price: 1200, stock_quantity: 18, category: "Eyes" },
      { name: "Rose Blush Compact", sku: "BTY-BLS-004", price: 950, stock_quantity: 8, category: "Face" },
      { name: "Nail Polish - Coral", sku: "BTY-NAL-005", price: 450, stock_quantity: 30, category: "Nails" },
    ];
    const ogopaProducts = [
      { name: "Matte Lipstick - Ruby", sku: "OGO-LIP-001", price: 850, stock_quantity: 24, category: "Lips" },
      { name: "Liquid Foundation - Beige", sku: "OGO-FND-002", price: 1850, stock_quantity: 12, category: "Face" },
      { name: "Volume Mascara", sku: "OGO-MSC-003", price: 1200, stock_quantity: 18, category: "Eyes" },
      { name: "Rose Blush Compact", sku: "OGO-BLS-004", price: 950, stock_quantity: 8, category: "Face" },
      { name: "Nail Polish - Coral", sku: "OGO-NAL-005", price: 450, stock_quantity: 30, category: "Nails" },
    ];
    const cosmeticsProducts = [
      { name: "Matte Lipstick - Ruby", sku: "CSG-LIP-001", price: 850, stock_quantity: 24, category: "Lips" },
      { name: "Liquid Foundation - Beige", sku: "CSG-FND-002", price: 1850, stock_quantity: 12, category: "Face" },
      { name: "Volume Mascara", sku: "CSG-MSC-003", price: 1200, stock_quantity: 18, category: "Eyes" },
      { name: "Rose Blush Compact", sku: "CSG-BLS-004", price: 950, stock_quantity: 8, category: "Face" },
      { name: "Nail Polish - Coral", sku: "CSG-NAL-005", price: 450, stock_quantity: 30, category: "Nails" },
    ];
    const depotProducts = [
      { name: "Coca-Cola 500ml", sku: "DEP-COK-001", price: 60, stock_quantity: 120, category: "Soda" },
      { name: "Fanta Orange 500ml", sku: "DEP-FNT-002", price: 60, stock_quantity: 96, category: "Soda" },
      { name: "Sprite 500ml", sku: "DEP-SPR-003", price: 60, stock_quantity: 84, category: "Soda" },
      { name: "Dasani Water 1L", sku: "DEP-WTR-004", price: 80, stock_quantity: 60, category: "Water" },
      { name: "Minute Maid Tropical 400ml", sku: "DEP-JCE-005", price: 95, stock_quantity: 7, category: "Juice" },
      { name: "Minute Maid Mango 400ml", sku: "DEP-JCE-006", price: 95, stock_quantity: 7, category: "Juice" },
      { name: "Minute Maid Apple 400ml", sku: "DEP-JCE-007", price: 95, stock_quantity: 7, category: "Juice" },
      { name: "Quencher Mineral Water 400ml", sku: "DEP-WTR-008", price: 50, stock_quantity: 24, category: "Water" },
      { name: "Novida Soft Drink 400ml", sku: "DEP-SFT-009", price: 50, stock_quantity: 24, category: "Soft Drink" },
      { name: "Predator Soft Drink 400ml", sku: "DEP-SFT-010", price: 50, stock_quantity: 24, category: "Soft Drink" },
      { name: "Charged 400ml", sku: "DEP-ENG-011", price: 60, stock_quantity: 24, category: "Energy Drink" },
      { name: "Lemonade 400ml", sku: "DEP-SFT-012", price: 50, stock_quantity: 24, category: "Soft Drink" },
      { name: "Power Play 400ml", sku: "DEP-ENG-013", price: 60, stock_quantity: 24, category: "Energy Drink" },
      { name: "Bravado 400ml", sku: "DEP-ENG-014", price: 60, stock_quantity: 24, category: "Energy Drink" },
      { name: "Planet Mineral Water 400ml", sku: "DEP-WTR-015", price: 50, stock_quantity: 24, category: "Water" },
    ];

    for (const p of beautyProducts) {
      await admin.from("products").upsert({ ...p, shop_id: beauty.id }, { onConflict: "shop_id,sku" });
    }
    for (const p of ogopaProducts) {
      await admin.from("products").upsert({ ...p, shop_id: ogopa.id }, { onConflict: "shop_id,sku" });
    }
    if (cosmetics) {
      for (const p of cosmeticsProducts) {
        await admin.from("products").upsert({ ...p, shop_id: cosmetics.id }, { onConflict: "shop_id,sku" });
      }
    }
    for (const p of depotProducts) {
      await admin.from("products").upsert({ ...p, shop_id: depot.id }, { onConflict: "shop_id,sku" });
    }

    return new Response(JSON.stringify({ ok: true, message: "Seeded" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
