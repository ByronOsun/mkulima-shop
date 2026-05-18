#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://njwcmwuovcevbrvwsdzx.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const admin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { realtime: false }
);

async function updateNames() {
  try {
    console.log("Updating profile names to auth usernames...");

    const emails = [
      "abigliz001.beauty@gmail.com",
      "abigliz001.depot@gmail.com",
      "abigliz001.ogopa@gmail.com",
      "abigliz001.cosmetics@gmail.com",
      "abigliz001@gmail.com",
    ];

    for (const email of emails) {
      const username = email.split("@")[0];
      await admin
        .from("profiles")
        .update({ full_name: username })
        .eq("email", email);
      console.log(`✓ Updated ${email} -> ${username}`);
    }

    console.log("\n✓ All profile names updated to usernames.");
  } catch (error) {
    console.error("✗ Update failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

updateNames();
