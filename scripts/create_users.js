#!/usr/bin/env node
// scripts/create_users.js
// Run locally to create the five requested users via the Supabase Admin API.
// Usage:
//   export SUPABASE_URL=https://<project>.supabase.co
//   export SERVICE_ROLE_KEY=<your-service-role-key>
//   node scripts/create_users.js

import fs from 'fs';
import path from 'path';

function loadDotEnv(filePath) {
  try {
    const txt = fs.readFileSync(filePath, 'utf8');
    const lines = txt.split(/\r?\n/);
    const out = {};
    for (const l of lines) {
      const line = l.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.substring(0, eq).trim();
      let val = line.substring(eq + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      out[key] = val;
    }
    return out;
  } catch (err) {
    return {};
  }
}

const env = loadDotEnv(path.join(process.cwd(), '.env'));
const SUPABASE_URL = process.env.SUPABASE_URL || env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SERVICE_ROLE_KEY in environment or .env');
  process.exit(1);
}

const users = [
  { email: 'wakulimashop@gmail.com', password: '123456', user_metadata: { role: 'admin', shop_name: 'all shops' } },
  { email: 'wakulima.shop1@gmail.com', password: '123456', user_metadata: { role: 'cashier', shop_name: 'shop1' } },
  { email: 'wakulima.shop2@gmail.com', password: '123456', user_metadata: { role: 'cashier', shop_name: 'shop2' } },
  { email: 'wakulima.shop3@gmail.com', password: '123456', user_metadata: { role: 'cashier', shop_name: 'shop3' } },
  { email: 'wakulima.shop4@gmail.com', password: '123456', user_metadata: { role: 'cashier', shop_name: 'shop4' } },
];

async function createUser(u) {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users`;
  const body = {
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: u.user_metadata,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log(u.email, res.status, text);
}

(async () => {
  for (const u of users) {
    try {
      await createUser(u);
    } catch (err) {
      console.error('Error creating', u.email, err?.message ?? err);
    }
  }
  console.log('done');
})();
