## Multi-Shop Inventory + POS System

A production-ready POS for two shops (Beauty Shop + Depot Shop) with admin oversight, real-time stock sync, PIN-based auth, receipts, and reporting.

### Stack
- TanStack Start (React 19) + Tailwind v4 + shadcn/ui (existing template)
- Lovable Cloud (Supabase) for DB, Auth, Realtime, RLS
- jsPDF + SheetJS for reports; `window.print()` for receipts

### Auth model
- Supabase email+password auth. PIN stored as `pin_hash` (bcrypt via Edge logic) and required as a second factor on the login screen.
- Roles in a separate `user_roles` table (`admin` | `employee`) with `has_role()` security-definer function.
- Admin: `admin@multishop.com` / PIN `123456` (seeded). Employees: `byron.beauty@gmail.com`, `byron.depot@gmail.com`.

### Database (migrations)
```
shops(id, name, contact_info, logo_color, created_at)
profiles(id→auth.users, email, full_name, shop_id, last_login)
user_roles(id, user_id, role)              -- enum: admin, employee
employee_pins(user_id, pin_hash)           -- separate, RLS locked
products(id, shop_id, name, sku, price, stock_quantity, category, low_stock_threshold)
transactions(id, shop_id, employee_id, total_amount, payment_mode, ref_id, customer_name, customer_phone, created_at)
transaction_items(id, transaction_id, product_id, name_snapshot, quantity, unit_price, total)
activity_logs(id, employee_id, shop_id, action, details, created_at)
broadcasts(id, shop_id, message, created_by, created_at)
```
RLS: employees can only read/write rows where `shop_id = their profile.shop_id`; admins bypass via `has_role(uid,'admin')`. Stock decrement via `create_transaction` Postgres RPC (atomic, checks stock, inserts items, logs activity).

### Routes
```
/login                       -> email + PIN form
/admin                       -> AdminDashboard (tabs: Overview, Products, Employees, Transactions, Reports, Broadcast)
/pos                         -> EmployeePOS (auto-scoped to shop)
/pos/history                 -> Past sales + reprint
/receipt/$id                 -> Print-friendly receipt page
```

### Components
- `LoginForm`, `AdminLayout`, `ShopSwitcher`
- Admin: `ProductsTable`, `ProductDialog`, `EmployeesTable`, `EmployeeDialog`, `TransactionsTable`, `ReportsPanel` (PDF/Excel), `BroadcastPanel`, `LiveActivityFeed`, `LowStockAlerts`
- POS: `ProductGrid` (search + category filter), `Cart`, `CheckoutModal` (Cash/ATM/M-Pesa), `Receipt`, `BroadcastBanner`, `HistoryList`

### Realtime
Supabase Realtime channels:
- `products:shop_id=eq.X` → live stock/price updates in POS
- `transactions:*` (admin) → live activity feed
- `broadcasts:shop_id=eq.X` → toast + banner on POS

### Reports
- Sales by shop / employee / date range → table + jsPDF + SheetJS export
- Stock movement (from `activity_logs`)
- Daily Z-report (totals by payment mode, txn count, cash drawer)

### Receipts
- Stored as transaction + items; `/receipt/$id` renders printable layout (shop name, employee, items, totals, payment, ref). Buttons: Print, Save (skip).

### Visual design
- Beauty Shop: rose/pink accent. Depot Shop: red/Coca-Cola accent. Semantic tokens added to `src/styles.css`. Modern card-based POS grid.

### Out of scope (called out)
Offline IndexedDB sync, QR scanning, and email-receipt are listed as bonuses in the brief. I'll scaffold a QR-friendly SKU search input but skip full IndexedDB offline sync and outbound email to keep the build production-solid.

### Deliverables
- All migrations + seed data (2 shops, 10 products, 1 admin, 2 employees with PINs)
- Working admin + POS with realtime
- PDF/Excel exports
- Print-ready receipt
- README updated with login credentials and usage

Confirm and I'll build it.