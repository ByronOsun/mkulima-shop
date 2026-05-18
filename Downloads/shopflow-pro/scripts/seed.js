#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdXJfcHJvamVjdF9pZCIsInJvbGUiOiJhbm9uIn0.dummy_token";

const admin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

async function seed() {
  try {
    console.log("Running seed...");

    // Get shop IDs
    const { data: shops, error: shopsError } = await admin.from("shops").select("id, slug");
    if (shopsError) throw shopsError;

    const beauty = shops?.find((s) => s.slug === "beauty");
    const depot = shops?.find((s) => s.slug === "depot");
    const ogopa = shops?.find((s) => s.slug === "ogopa");
    const cosmetics = shops?.find((s) => s.slug === "cosmetics");

    if (!beauty || !depot || !ogopa || !cosmetics) {
      throw new Error("Shops not seeded. Make sure migrations have run.");
    }

    console.log("✓ Shops found:", { beauty: beauty.id, depot: depot.id, ogopa: ogopa.id, cosmetics: cosmetics.id });

    // Check if Ogopa and Cosmetics employee profiles exist
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email, shop_id")
      .in("email", ["abigliz001.beauty@gmail.com", "abigliz001.depot@gmail.com", "abigliz001.ogopa@gmail.com", "abigliz001.cosmetics@gmail.com", "abigliz001@gmail.com"]);

    if (profiles && profiles.length > 0) {
      const beautyProfile = profiles.find((p) => p.email === "abigliz001.beauty@gmail.com");
      const depotProfile = profiles.find((p) => p.email === "abigliz001.depot@gmail.com");
      const ogopaProfile = profiles.find((p) => p.email === "abigliz001.ogopa@gmail.com");
      const cosmeticsProfile = profiles.find((p) => p.email === "abigliz001.cosmetics@gmail.com");
      const adminProfile = profiles.find((p) => p.email === "abigliz001@gmail.com");

      if (beautyProfile?.shop_id === beauty.id) {
        console.log("✓ Beauty employee profile already exists and is assigned to Beauty Shop");
      } else if (beautyProfile) {
        console.log("⚠ Beauty profile exists but shop_id mismatch. Updating...");
        await admin.from("profiles").update({ shop_id: beauty.id }).eq("email", "abigliz001.beauty@gmail.com");
        console.log("✓ Beauty profile updated");
      }

      if (depotProfile?.shop_id === depot.id) {
        console.log("✓ Depot employee profile already exists and is assigned to Depot Shop");
      } else if (depotProfile) {
        console.log("⚠ Depot profile exists but shop_id mismatch. Updating...");
        await admin.from("profiles").update({ shop_id: depot.id }).eq("email", "abigliz001.depot@gmail.com");
        console.log("✓ Depot profile updated");
      }

      if (ogopaProfile?.shop_id === ogopa.id) {
        console.log("✓ Ogopa employee profile already exists and is assigned to Ogopa Shop");
      } else if (ogopaProfile) {
        console.log("⚠ Ogopa profile exists but shop_id mismatch. Updating...");
        await admin.from("profiles").update({ shop_id: ogopa.id }).eq("email", "abigliz001.ogopa@gmail.com");
        console.log("✓ Ogopa profile updated");
      }

      if (cosmeticsProfile?.shop_id === cosmetics.id) {
        console.log("✓ Cosmetics employee profile already exists and is assigned to Cosmetics Shop");
      } else if (cosmeticsProfile) {
        console.log("⚠ Cosmetics profile exists but shop_id mismatch. Updating...");
        await admin.from("profiles").update({ shop_id: cosmetics.id }).eq("email", "abigliz001.cosmetics@gmail.com");
        console.log("✓ Cosmetics profile updated");
      }

      if (adminProfile) {
        console.log("✓ Admin profile already exists");
      }
    } else {
      console.log("Note: Employee profile not found. It will be created if auth user exists.");
    }

    console.log("\n✓ Seed completed successfully!");
    console.log("\nBeauty Shop is ready. Login with:");
    console.log("  Email: abigliz001.beauty@gmail.com");
    console.log("  Password: 123456");
    console.log("\nDepot Shop is ready. Login with:");
    console.log("  Email: abigliz001.depot@gmail.com");
    console.log("  Password: 123456");
    console.log("\nOgopa Shop is ready. Login with:");
    console.log("  Email: abigliz001.ogopa@gmail.com");
    console.log("  Password: 123456");
    console.log("\nCosmetics Shop is ready. Login with:");
    console.log("  Email: abigliz001.cosmetics@gmail.com");
    console.log("  Password: 123456");
  } catch (error) {
    console.error("✗ Seed failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

seed();
