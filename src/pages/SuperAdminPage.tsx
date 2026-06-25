import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { supabaseService } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Tenant } from '../types';
import '../styles/SuperAdminPage.css';

async function hashPin(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface TenantWithAdmin extends Tenant {
  adminUsername?: string;
  adminDisplayName?: string;
  adminId?: string;
  cashierCount?: number;
  userCount?: number;
}

type Modal =
  | { type: 'create-shop' }
  | { type: 'confirm-suspend'; tenant: TenantWithAdmin }
  | { type: 'confirm-delete'; tenant: TenantWithAdmin }
  | { type: 'reset-pin'; userId: string; userName: string }
  | { type: 'add-user'; tenantId: string }
  | { type: 'add-category'; tenantId: string };

type Section = 'shop-info' | 'employees' | 'categories' | 'sales' | 'finance' | 'products';

export default function SuperAdminPage() {
  const { logout } = useAuth();
  const [tenants, setTenants] = useState<TenantWithAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<TenantWithAdmin | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const raw = await supabaseService.getTenants();
      const enriched: TenantWithAdmin[] = await Promise.all(
        raw.map(async (t) => {
          try {
            const users = await supabaseService.getTenantStaffUsers(t.id);
            const admin = users.find((u: any) => u.role === 'admin');
            return {
              ...t,
              adminId: admin?.id,
              adminUsername: admin?.username,
              adminDisplayName: admin?.display_name,
              cashierCount: users.filter((u: any) => u.role === 'cashier').length,
              userCount: users.length,
            };
          } catch { return t; }
        })
      );
      setTenants(enriched);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load shops');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTenants(); }, []);

  const closeModal = () => setModal(null);
  const toast = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 3000);
  };

  const afterSave = (msg: string) => {
    closeModal();
    toast(msg);
    loadTenants();
    if (selectedTenant) {
      setSelectedTenant(prev => prev ? { ...prev } : null);
    }
  };

  const handleSuspendToggle = async (tenant: TenantWithAdmin) => {
    try {
      await supabaseService.updateTenant(tenant.id, { is_active: !tenant.is_active });
      const msg = tenant.is_active ? `"${tenant.shop_name}" suspended.` : `"${tenant.shop_name}" reactivated.`;
      toast(msg);
      loadTenants();
      setSelectedTenant(prev => prev?.id === tenant.id ? { ...prev, is_active: !tenant.is_active } : prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    }
  };

  const handleDelete = async (tenant: TenantWithAdmin) => {
    try {
      await supabaseService.deleteTenant(tenant.id);
      toast(`"${tenant.shop_name}" deleted.`);
      setSelectedTenant(null);
      loadTenants();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="superadmin-page">
      <div className="superadmin-header">
        <div className="superadmin-header-left">
          <h1>VIZIA Super Admin</h1>
          <span className="superadmin-subtitle">Multi-tenant management console</span>
        </div>
        <button className="btn-logout-sa" onClick={logout}>🚪 Logout</button>
      </div>

      {actionMsg && <div className="sa-success-banner">{actionMsg}</div>}
      {error && <div className="sa-error-banner">{error}</div>}

      <div className="sa-layout">
        {/* Left panel — shop list */}
        <div className="sa-shop-list-panel">
          <div className="sa-panel-header">
            <h2>Shops ({tenants.length})</h2>
            <button className="btn-primary-sa" onClick={() => setModal({ type: 'create-shop' })}>+ New</button>
          </div>
          {loading ? (
            <div className="sa-loading">Loading…</div>
          ) : (
            <ul className="sa-shop-list">
              {tenants.map(t => (
                <li
                  key={t.id}
                  className={`sa-shop-list-item ${!t.is_active ? 'suspended' : ''} ${selectedTenant?.id === t.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTenant(t)}
                >
                  <div className="sa-list-item-main">
                    <span className="sa-list-shop-name">{t.shop_name}</span>
                    <span className={`sa-status-dot ${t.is_active ? 'active' : 'suspended'}`} />
                  </div>
                  <div className="sa-list-item-sub">
                    {t.adminDisplayName && <span>{t.adminDisplayName}</span>}
                    <span>{t.userCount ?? 0} users</span>
                  </div>
                </li>
              ))}
              {tenants.length === 0 && (
                <li className="sa-empty">No shops yet.</li>
              )}
            </ul>
          )}
        </div>

        {/* Right panel — shop detail */}
        <div className="sa-detail-panel">
          {!selectedTenant ? (
            <div className="sa-detail-placeholder">
              <p>Select a shop from the list to manage it</p>
            </div>
          ) : (
            <ShopDetail
              tenant={selectedTenant}
              onSuspend={() => setModal({ type: 'confirm-suspend', tenant: selectedTenant })}
              onDelete={() => setModal({ type: 'confirm-delete', tenant: selectedTenant })}
              onResetPin={(userId, userName) => setModal({ type: 'reset-pin', userId, userName })}
              onAddUser={() => setModal({ type: 'add-user', tenantId: selectedTenant.id })}
              onAddCategory={() => setModal({ type: 'add-category', tenantId: selectedTenant.id })}
              onTenantUpdated={(updated) => {
                setSelectedTenant(updated);
                toast('Shop info updated.');
                loadTenants();
              }}
              toast={toast}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {modal?.type === 'create-shop' && (
        <CreateShopModal onClose={closeModal} onSaved={() => afterSave('New shop created!')} />
      )}
      {modal?.type === 'reset-pin' && (
        <ResetPinModal userId={modal.userId} userName={modal.userName} onClose={closeModal} onSaved={() => afterSave('PIN reset.')} />
      )}
      {modal?.type === 'add-user' && (
        <AddUserModal tenantId={modal.tenantId} onClose={closeModal} onSaved={() => afterSave('User added.')} />
      )}
      {modal?.type === 'add-category' && (
        <AddCategoryModal tenantId={modal.tenantId} onClose={closeModal} onSaved={() => afterSave('Category added.')} />
      )}
      {modal?.type === 'confirm-suspend' && (
        <ConfirmDialog
          title={modal.tenant.is_active ? 'Suspend Shop' : 'Reactivate Shop'}
          message={modal.tenant.is_active
            ? `Suspend "${modal.tenant.shop_name}"? All users will be locked out immediately.`
            : `Reactivate "${modal.tenant.shop_name}"?`}
          confirmLabel={modal.tenant.is_active ? 'Suspend' : 'Activate'}
          dangerous={modal.tenant.is_active}
          onConfirm={() => { closeModal(); handleSuspendToggle(modal.tenant); }}
          onCancel={closeModal}
        />
      )}
      {modal?.type === 'confirm-delete' && (
        <ConfirmDialog
          title="Delete Shop"
          message={`Permanently delete "${modal.tenant.shop_name}" and ALL its data? This cannot be undone.`}
          confirmLabel="Delete Forever"
          dangerous
          onConfirm={() => { closeModal(); handleDelete(modal.tenant); }}
          onCancel={closeModal}
        />
      )}
    </div>
  );
}

/* ─── Shop Detail ──────────────────────────────────────────────────────────── */

function ShopDetail({
  tenant, onSuspend, onDelete, onResetPin, onAddUser, onAddCategory, onTenantUpdated, toast,
}: {
  tenant: TenantWithAdmin;
  onSuspend: () => void;
  onDelete: () => void;
  onResetPin: (userId: string, userName: string) => void;
  onAddUser: () => void;
  onAddCategory: () => void;
  onTenantUpdated: (t: TenantWithAdmin) => void;
  toast: (msg: string) => void;
}) {
  const [openSection, setOpenSection] = useState<Section>('shop-info');

  const toggle = (s: Section) => setOpenSection(prev => prev === s ? 'shop-info' : s);

  const sections: { id: Section; label: string; icon: string }[] = [
    { id: 'shop-info',   label: 'Shop Info & Receipt Header', icon: '🏪' },
    { id: 'employees',   label: 'Employees',                  icon: '👥' },
    { id: 'categories',  label: 'Categories',                 icon: '🏷' },
    { id: 'products',    label: 'Products',                   icon: '📦' },
    { id: 'sales',       label: 'Sales (last 30 days)',        icon: '🧾' },
    { id: 'finance',     label: 'Finance & Expenses',         icon: '💰' },
  ];

  return (
    <div className="sa-detail">
      <div className="sa-detail-header">
        <div>
          <h2 className="sa-detail-title">{tenant.shop_name}</h2>
          {tenant.address && <p className="sa-detail-sub">{tenant.address}</p>}
          {tenant.phone && <p className="sa-detail-sub">📞 {tenant.phone}</p>}
        </div>
        <div className="sa-detail-actions">
          <span className={`sa-status-pill ${tenant.is_active ? 'active' : 'suspended'}`}>
            {tenant.is_active ? 'Active' : 'Suspended'}
          </span>
          <button className={`btn-sa-action ${tenant.is_active ? 'btn-sa-warn' : 'btn-sa-ok'}`} onClick={onSuspend}>
            {tenant.is_active ? '⏸ Suspend' : '▶ Activate'}
          </button>
          <button className="btn-sa-action btn-sa-danger" onClick={onDelete}>🗑 Delete</button>
        </div>
      </div>

      <div className="sa-sections">
        {sections.map(s => (
          <div key={s.id} className={`sa-section ${openSection === s.id ? 'open' : ''}`}>
            <button className="sa-section-toggle" onClick={() => toggle(s.id)}>
              <span>{s.icon} {s.label}</span>
              <span className="sa-section-chevron">{openSection === s.id ? '▲' : '▼'}</span>
            </button>
            {openSection === s.id && (
              <div className="sa-section-body">
                {s.id === 'shop-info' && (
                  <ShopInfoSection tenant={tenant} onUpdated={onTenantUpdated} />
                )}
                {s.id === 'employees' && (
                  <EmployeesSection tenantId={tenant.id} onResetPin={onResetPin} onAddUser={onAddUser} toast={toast} />
                )}
                {s.id === 'categories' && (
                  <CategoriesSection tenantId={tenant.id} onAddCategory={onAddCategory} toast={toast} />
                )}
                {s.id === 'products' && (
                  <ProductsSection tenantId={tenant.id} />
                )}
                {s.id === 'sales' && (
                  <SalesSection tenantId={tenant.id} />
                )}
                {s.id === 'finance' && (
                  <FinanceSection tenantId={tenant.id} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Section: Shop Info ───────────────────────────────────────────────────── */

function ShopInfoSection({ tenant, onUpdated }: { tenant: TenantWithAdmin; onUpdated: (t: TenantWithAdmin) => void }) {
  const [shopName, setShopName] = useState(tenant.shop_name);
  const [address, setAddress]   = useState(tenant.address || '');
  const [phone, setPhone]       = useState(tenant.phone || '');
  const [header, setHeader]     = useState(tenant.header_text || '');
  const [footer, setFooter]     = useState(tenant.footer_text || '');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) { setError('Shop name is required'); return; }
    try {
      setSaving(true);
      const updated = await supabaseService.updateTenant(tenant.id, {
        shop_name: shopName.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        header_text: header.trim() || undefined,
        footer_text: footer.trim() || undefined,
      });
      onUpdated({ ...tenant, ...updated });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="sa-section-form">
      <div className="form-row-sa">
        <div className="form-group-sa">
          <label>Shop Name *</label>
          <input value={shopName} onChange={e => setShopName(e.target.value)} required />
        </div>
        <div className="form-group-sa">
          <label>Phone</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="form-group-sa">
        <label>Address</label>
        <input value={address} onChange={e => setAddress(e.target.value)} />
      </div>
      <div className="form-row-sa">
        <div className="form-group-sa">
          <label>Receipt Header Text</label>
          <input value={header} onChange={e => setHeader(e.target.value)} placeholder="e.g. Thank you for shopping with us" />
        </div>
        <div className="form-group-sa">
          <label>Receipt Footer Text</label>
          <input value={footer} onChange={e => setFooter(e.target.value)} placeholder="e.g. Karibu tena!" />
        </div>
      </div>
      {error && <div className="sa-form-error">{error}</div>}
      <div className="sa-form-footer">
        <button type="submit" className="btn-primary-sa" disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

/* ─── Section: Employees ───────────────────────────────────────────────────── */

function EmployeesSection({ tenantId, onResetPin, onAddUser, toast }: {
  tenantId: string;
  onResetPin: (userId: string, userName: string) => void;
  onAddUser: () => void;
  toast: (msg: string) => void;
}) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setUsers(await supabaseService.getTenantStaffUsers(tenantId)); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tenantId]);

  const toggleActive = async (user: any) => {
    try {
      await supabaseService.updateStaffUser(user.id, { is_active: !user.is_active });
      toast(`${user.display_name} ${user.is_active ? 'deactivated' : 'activated'}.`);
      load();
    } catch { /* ignore */ }
  };

  const deleteUser = async (user: any) => {
    if (!confirm(`Delete user "${user.display_name}"?`)) return;
    try {
      await supabaseService.deleteStaffUser(user.id);
      toast(`${user.display_name} deleted.`);
      load();
    } catch { /* ignore */ }
  };

  if (loading) return <div className="sa-section-loading">Loading…</div>;

  return (
    <div>
      <div className="sa-section-toolbar">
        <span className="sa-section-count">{users.length} user{users.length !== 1 ? 's' : ''}</span>
        <button className="btn-primary-sa btn-sm-sa" onClick={onAddUser}>+ Add User</button>
      </div>
      <table className="sa-table">
        <thead>
          <tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.display_name}</td>
              <td className="sa-mono">{u.username}</td>
              <td><span className={`sa-role-badge ${u.role}`}>{u.role}</span></td>
              <td>
                <span className={`sa-status-dot-inline ${u.is_active ? 'active' : 'suspended'}`}>
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="sa-table-actions">
                <button className="btn-sa-action btn-sm-sa" onClick={() => onResetPin(u.id, u.display_name)}>🔑 PIN</button>
                <button className={`btn-sa-action btn-sm-sa ${u.is_active ? 'btn-sa-warn' : 'btn-sa-ok'}`} onClick={() => toggleActive(u)}>
                  {u.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button className="btn-sa-action btn-sm-sa btn-sa-danger" onClick={() => deleteUser(u)}>Delete</button>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr><td colSpan={5} className="sa-table-empty">No users found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Section: Categories ──────────────────────────────────────────────────── */

function CategoriesSection({ tenantId, onAddCategory, toast }: {
  tenantId: string;
  onAddCategory: () => void;
  toast: (msg: string) => void;
}) {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setCategories(await supabaseService.getSuperAdminTenantCategories(tenantId)); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tenantId]);

  const deleteCategory = async (cat: any) => {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await supabaseService.deleteTenant; // reuse supabase client
      const { supabase } = await import('../services/supabase');
      if (!supabase) return;
      await supabase.from('categories').delete().eq('id', cat.id);
      toast(`Category "${cat.name}" deleted.`);
      load();
    } catch { /* ignore */ }
  };

  if (loading) return <div className="sa-section-loading">Loading…</div>;

  return (
    <div>
      <div className="sa-section-toolbar">
        <span className="sa-section-count">{categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}</span>
        <button className="btn-primary-sa btn-sm-sa" onClick={onAddCategory}>+ Add Category</button>
      </div>
      <table className="sa-table">
        <thead>
          <tr><th>Name</th><th>Description</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {categories.map(c => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td className="sa-muted">{c.description || '—'}</td>
              <td className="sa-table-actions">
                <button className="btn-sa-action btn-sm-sa btn-sa-danger" onClick={() => deleteCategory(c)}>Delete</button>
              </td>
            </tr>
          ))}
          {categories.length === 0 && (
            <tr><td colSpan={3} className="sa-table-empty">No categories</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Section: Products ────────────────────────────────────────────────────── */

function ProductsSection({ tenantId }: { tenantId: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabaseService.getSuperAdminTenantProducts(tenantId)
      .then(setProducts).catch(() => {}).finally(() => setLoading(false));
  }, [tenantId]);

  const fmt = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n);

  if (loading) return <div className="sa-section-loading">Loading…</div>;

  return (
    <table className="sa-table">
      <thead>
        <tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th></tr>
      </thead>
      <tbody>
        {products.map(p => (
          <tr key={p.id}>
            <td>{p.name}</td>
            <td className="sa-muted">{p.category || '—'}</td>
            <td>{fmt(p.unit_price)}</td>
            <td>
              <span className={p.quantity_in_stock <= p.reorder_level ? 'sa-low-stock' : ''}>
                {p.quantity_in_stock}
              </span>
            </td>
          </tr>
        ))}
        {products.length === 0 && (
          <tr><td colSpan={4} className="sa-table-empty">No products</td></tr>
        )}
      </tbody>
    </table>
  );
}

/* ─── Section: Sales ───────────────────────────────────────────────────────── */

function SalesSection({ tenantId }: { tenantId: string }) {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabaseService.getSuperAdminTenantSales(tenantId, 30)
      .then(setSales).catch(() => {}).finally(() => setLoading(false));
  }, [tenantId]);

  const fmt = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n);
  const total = sales.reduce((s, x) => s + (x.total_amount || 0), 0);

  if (loading) return <div className="sa-section-loading">Loading…</div>;

  return (
    <div>
      <div className="sa-section-toolbar">
        <span className="sa-section-count">{sales.length} transactions · Total: <strong>{fmt(total)}</strong></span>
      </div>
      <table className="sa-table">
        <thead>
          <tr><th>Date</th><th>Cashier</th><th>Payment</th><th>Status</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {sales.map(s => (
            <tr key={s.id}>
              <td>{new Date(s.sale_date).toLocaleDateString()}</td>
              <td className="sa-muted">{s.cashier_name || '—'}</td>
              <td>{s.payment_method}</td>
              <td>
                <span className={`sa-status-badge ${s.status}`}>{s.status}</span>
              </td>
              <td>{fmt(s.total_amount)}</td>
            </tr>
          ))}
          {sales.length === 0 && (
            <tr><td colSpan={5} className="sa-table-empty">No sales in last 30 days</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Section: Finance ─────────────────────────────────────────────────────── */

function FinanceSection({ tenantId }: { tenantId: string }) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabaseService.getSuperAdminTenantFinance(tenantId)
      .then(setExpenses).catch(() => {}).finally(() => setLoading(false));
  }, [tenantId]);

  const fmt = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n);
  const total = expenses.reduce((s, x) => s + (x.amount || 0), 0);

  if (loading) return <div className="sa-section-loading">Loading…</div>;

  return (
    <div>
      <div className="sa-section-toolbar">
        <span className="sa-section-count">{expenses.length} expenses · Total: <strong>{fmt(total)}</strong></span>
      </div>
      <table className="sa-table">
        <thead>
          <tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {expenses.map(e => (
            <tr key={e.id}>
              <td>{new Date(e.expense_date).toLocaleDateString()}</td>
              <td>{e.category}</td>
              <td className="sa-muted">{e.description}</td>
              <td>{fmt(e.amount)}</td>
            </tr>
          ))}
          {expenses.length === 0 && (
            <tr><td colSpan={4} className="sa-table-empty">No expenses recorded</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Modal: Create Shop ───────────────────────────────────────────────────── */

interface CreateShopForm {
  shop_name: string; address: string; phone: string;
  admin_display_name: string; admin_username: string;
  admin_pin: string; admin_pin_confirm: string;
}

function CreateShopModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CreateShopForm>({
    shop_name: '', address: '', phone: '',
    admin_display_name: '', admin_username: '',
    admin_pin: '', admin_pin_confirm: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof CreateShopForm) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.shop_name.trim()) { setError('Shop name is required'); return; }
    if (!form.admin_display_name.trim()) { setError('Admin display name is required'); return; }
    if (!form.admin_username.trim()) { setError('Admin username is required'); return; }
    if (!/^\d{4,6}$/.test(form.admin_pin)) { setError('PIN must be 4–6 digits'); return; }
    if (form.admin_pin !== form.admin_pin_confirm) { setError('PINs do not match'); return; }
    try {
      setSaving(true);
      const tenant = await supabaseService.createTenant({
        shop_name: form.shop_name.trim(),
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        is_active: true,
      });
      const pin_hash = await hashPin(form.admin_pin);
      await supabaseService.createStaffUser({
        username: form.admin_username.trim(),
        display_name: form.admin_display_name.trim(),
        role: 'admin', pin_hash, is_active: true, tenant_id: tenant.id,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create shop');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay-sa">
      <div className="modal-box-sa">
        <h3>Create New Shop</h3>
        <form onSubmit={handleSubmit}>
          <div className="sa-form-section">
            <h4>Shop Details</h4>
            <div className="form-group-sa"><label>Shop Name *</label><input value={form.shop_name} onChange={set('shop_name')} required /></div>
            <div className="form-row-sa">
              <div className="form-group-sa"><label>Address</label><input value={form.address} onChange={set('address')} /></div>
              <div className="form-group-sa"><label>Phone</label><input value={form.phone} onChange={set('phone')} /></div>
            </div>
          </div>
          <div className="sa-form-section">
            <h4>Admin Account</h4>
            <div className="form-row-sa">
              <div className="form-group-sa"><label>Display Name *</label><input value={form.admin_display_name} onChange={set('admin_display_name')} required /></div>
              <div className="form-group-sa"><label>Username *</label><input value={form.admin_username} onChange={set('admin_username')} required /></div>
            </div>
            <div className="form-row-sa">
              <div className="form-group-sa"><label>PIN (4–6 digits) *</label><input type="password" value={form.admin_pin} onChange={set('admin_pin')} maxLength={6} /></div>
              <div className="form-group-sa"><label>Confirm PIN *</label><input type="password" value={form.admin_pin_confirm} onChange={set('admin_pin_confirm')} maxLength={6} /></div>
            </div>
          </div>
          {error && <div className="sa-form-error">{error}</div>}
          <div className="modal-actions-sa">
            <button type="button" className="btn-secondary-sa" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-sa" disabled={saving}>{saving ? 'Creating…' : 'Create Shop'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Modal: Reset PIN ─────────────────────────────────────────────────────── */

function ResetPinModal({ userId, userName, onClose, onSaved }: {
  userId: string; userName: string; onClose: () => void; onSaved: () => void;
}) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) { setError('PIN must be 4–6 digits'); return; }
    if (pin !== confirmPin) { setError('PINs do not match'); return; }
    try {
      setSaving(true);
      await supabaseService.updateStaffUser(userId, { pin_hash: await hashPin(pin) });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset PIN');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay-sa">
      <div className="modal-box-sa modal-box-sa-sm">
        <h3>Reset PIN — {userName}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group-sa"><label>New PIN (4–6 digits)</label><input type="password" value={pin} onChange={e => setPin(e.target.value)} maxLength={6} /></div>
          <div className="form-group-sa"><label>Confirm PIN</label><input type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} maxLength={6} /></div>
          {error && <div className="sa-form-error">{error}</div>}
          <div className="modal-actions-sa">
            <button type="button" className="btn-secondary-sa" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-sa" disabled={saving}>{saving ? 'Resetting…' : 'Reset PIN'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Modal: Add User ──────────────────────────────────────────────────────── */

function AddUserModal({ tenantId, onClose, onSaved }: { tenantId: string; onClose: () => void; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'cashier' | 'admin'>('cashier');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !username.trim()) { setError('Name and username are required'); return; }
    if (!/^\d{4,6}$/.test(pin)) { setError('PIN must be 4–6 digits'); return; }
    if (pin !== confirmPin) { setError('PINs do not match'); return; }
    try {
      setSaving(true);
      await supabaseService.createStaffUser({
        username: username.trim(), display_name: displayName.trim(),
        role, pin_hash: await hashPin(pin), is_active: true, tenant_id: tenantId,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add user');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay-sa">
      <div className="modal-box-sa modal-box-sa-sm">
        <h3>Add User</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row-sa">
            <div className="form-group-sa"><label>Display Name *</label><input value={displayName} onChange={e => setDisplayName(e.target.value)} /></div>
            <div className="form-group-sa"><label>Username *</label><input value={username} onChange={e => setUsername(e.target.value)} /></div>
          </div>
          <div className="form-group-sa">
            <label>Role</label>
            <select value={role} onChange={e => setRole(e.target.value as any)} className="sa-select">
              <option value="cashier">Cashier</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-row-sa">
            <div className="form-group-sa"><label>PIN (4–6 digits) *</label><input type="password" value={pin} onChange={e => setPin(e.target.value)} maxLength={6} /></div>
            <div className="form-group-sa"><label>Confirm PIN *</label><input type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} maxLength={6} /></div>
          </div>
          {error && <div className="sa-form-error">{error}</div>}
          <div className="modal-actions-sa">
            <button type="button" className="btn-secondary-sa" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-sa" disabled={saving}>{saving ? 'Adding…' : 'Add User'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Modal: Add Category ──────────────────────────────────────────────────── */

function AddCategoryModal({ tenantId, onClose, onSaved }: { tenantId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    try {
      setSaving(true);
      const { supabase } = await import('../services/supabase');
      if (!supabase) throw new Error('Not configured');
      const { error: err } = await supabase.from('categories').insert([{
        id: crypto.randomUUID(), name: name.trim(),
        description: desc.trim() || undefined,
        tenant_id: tenantId, created_at: new Date().toISOString(),
      }]);
      if (err) throw new Error(err.message);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add category');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay-sa">
      <div className="modal-box-sa modal-box-sa-sm">
        <h3>Add Category</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group-sa"><label>Name *</label><input value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="form-group-sa"><label>Description</label><input value={desc} onChange={e => setDesc(e.target.value)} /></div>
          {error && <div className="sa-form-error">{error}</div>}
          <div className="modal-actions-sa">
            <button type="button" className="btn-secondary-sa" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-sa" disabled={saving}>{saving ? 'Adding…' : 'Add Category'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Confirm Dialog ───────────────────────────────────────────────────────── */

function ConfirmDialog({ title, message, confirmLabel, dangerous, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel: string;
  dangerous?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="modal-overlay-sa">
      <div className="modal-box-sa modal-box-sa-sm">
        <h3>{title}</h3>
        <p className="sa-confirm-msg">{message}</p>
        <div className="modal-actions-sa">
          <button className="btn-secondary-sa" onClick={onCancel}>Cancel</button>
          <button className={dangerous ? 'btn-danger-sa' : 'btn-primary-sa'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
