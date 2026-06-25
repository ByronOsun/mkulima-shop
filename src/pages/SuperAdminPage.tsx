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
}

type Modal =
  | { type: 'create-shop' }
  | { type: 'edit-receipt'; tenant: TenantWithAdmin }
  | { type: 'reset-pin'; tenant: TenantWithAdmin }
  | { type: 'confirm-suspend'; tenant: TenantWithAdmin }
  | { type: 'confirm-delete'; tenant: TenantWithAdmin };

export default function SuperAdminPage() {
  const { logout } = useAuth();
  const [tenants, setTenants] = useState<TenantWithAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const rawTenants = await supabaseService.getTenants();

      const enriched: TenantWithAdmin[] = await Promise.all(
        rawTenants.map(async (t) => {
          try {
            const users = await supabaseService.getTenantStaffUsers(t.id);
            const admin = users.find((u: any) => u.role === 'admin');
            const cashiers = users.filter((u: any) => u.role === 'cashier');
            return {
              ...t,
              adminId: admin?.id,
              adminUsername: admin?.username,
              adminDisplayName: admin?.display_name,
              cashierCount: cashiers.length,
            };
          } catch {
            return t;
          }
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
  const afterSave = (msg: string) => {
    closeModal();
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 3000);
    loadTenants();
  };

  const handleSuspendToggle = async (tenant: TenantWithAdmin) => {
    try {
      await supabaseService.updateTenant(tenant.id, { is_active: !tenant.is_active });
      afterSave(tenant.is_active ? `"${tenant.shop_name}" suspended.` : `"${tenant.shop_name}" reactivated.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    }
  };

  const handleDelete = async (tenant: TenantWithAdmin) => {
    try {
      await supabaseService.deleteTenant(tenant.id);
      afterSave(`"${tenant.shop_name}" deleted.`);
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

      <div className="superadmin-body">
        {actionMsg && <div className="sa-success-banner">{actionMsg}</div>}
        {error && <div className="sa-error-banner">{error}</div>}

        <div className="sa-toolbar">
          <h2>Shops ({tenants.length})</h2>
          <button className="btn-primary-sa" onClick={() => setModal({ type: 'create-shop' })}>
            + New Shop
          </button>
        </div>

        {loading ? (
          <div className="sa-loading">Loading shops…</div>
        ) : (
          <div className="sa-shop-grid">
            {tenants.map(tenant => (
              <div key={tenant.id} className={`sa-shop-card ${!tenant.is_active ? 'suspended' : ''}`}>
                <div className="sa-shop-header">
                  <div>
                    <h3 className="sa-shop-name">{tenant.shop_name}</h3>
                    {tenant.address && <p className="sa-shop-detail">{tenant.address}</p>}
                    {tenant.phone && <p className="sa-shop-detail">📞 {tenant.phone}</p>}
                  </div>
                  <span className={`sa-status-pill ${tenant.is_active ? 'active' : 'suspended'}`}>
                    {tenant.is_active ? 'Active' : 'Suspended'}
                  </span>
                </div>

                <div className="sa-shop-info">
                  <div className="sa-info-row">
                    <span className="sa-info-label">Admin</span>
                    <span>{tenant.adminDisplayName || '—'} {tenant.adminUsername ? `(${tenant.adminUsername})` : ''}</span>
                  </div>
                  <div className="sa-info-row">
                    <span className="sa-info-label">Cashiers</span>
                    <span>{tenant.cashierCount ?? 0}</span>
                  </div>
                  <div className="sa-info-row">
                    <span className="sa-info-label">Created</span>
                    <span>{new Date(tenant.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="sa-shop-actions">
                  <button
                    className="btn-sa-action"
                    onClick={() => setModal({ type: 'edit-receipt', tenant })}
                    title="Edit receipt header"
                  >
                    🧾 Receipt
                  </button>
                  {tenant.adminId && (
                    <button
                      className="btn-sa-action"
                      onClick={() => setModal({ type: 'reset-pin', tenant })}
                      title="Reset admin PIN"
                    >
                      🔑 PIN
                    </button>
                  )}
                  <button
                    className={`btn-sa-action ${tenant.is_active ? 'btn-sa-warn' : 'btn-sa-ok'}`}
                    onClick={() => setModal({ type: 'confirm-suspend', tenant })}
                    title={tenant.is_active ? 'Suspend shop' : 'Reactivate shop'}
                  >
                    {tenant.is_active ? '⏸ Suspend' : '▶ Activate'}
                  </button>
                  <button
                    className="btn-sa-action btn-sa-danger"
                    onClick={() => setModal({ type: 'confirm-delete', tenant })}
                    title="Permanently delete shop"
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            ))}
            {tenants.length === 0 && (
              <div className="sa-empty">No shops yet. Create the first one above.</div>
            )}
          </div>
        )}
      </div>

      {modal?.type === 'create-shop' && (
        <CreateShopModal onClose={closeModal} onSaved={() => afterSave('New shop created!')} />
      )}
      {modal?.type === 'edit-receipt' && (
        <EditReceiptModal tenant={modal.tenant} onClose={closeModal} onSaved={() => afterSave('Receipt config updated.')} />
      )}
      {modal?.type === 'reset-pin' && (
        <ResetAdminPinModal tenant={modal.tenant} onClose={closeModal} onSaved={() => afterSave('Admin PIN reset.')} />
      )}
      {modal?.type === 'confirm-suspend' && (
        <ConfirmDialog
          title={modal.tenant.is_active ? 'Suspend Shop' : 'Reactivate Shop'}
          message={
            modal.tenant.is_active
              ? `Suspend "${modal.tenant.shop_name}"? All cashiers and the admin will be locked out immediately.`
              : `Reactivate "${modal.tenant.shop_name}"? All users will regain access.`
          }
          confirmLabel={modal.tenant.is_active ? 'Suspend' : 'Activate'}
          dangerous={modal.tenant.is_active}
          onConfirm={() => { closeModal(); handleSuspendToggle(modal.tenant); }}
          onCancel={closeModal}
        />
      )}
      {modal?.type === 'confirm-delete' && (
        <ConfirmDialog
          title="Delete Shop"
          message={`Permanently delete "${modal.tenant.shop_name}" and ALL its products, sales, and users? This cannot be undone.`}
          confirmLabel="Delete Forever"
          dangerous
          onConfirm={() => { closeModal(); handleDelete(modal.tenant); }}
          onCancel={closeModal}
        />
      )}
    </div>
  );
}

/* ─── Create Shop Modal ─────────────────────────────────────────── */

interface CreateShopForm {
  shop_name: string;
  address: string;
  phone: string;
  admin_display_name: string;
  admin_username: string;
  admin_pin: string;
  admin_pin_confirm: string;
}

function CreateShopModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CreateShopForm>({
    shop_name: '',
    address: '',
    phone: '',
    admin_display_name: '',
    admin_username: '',
    admin_pin: '',
    admin_pin_confirm: '',
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
        role: 'admin',
        pin_hash,
        is_active: true,
        tenant_id: tenant.id,
      });

      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create shop');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay-sa">
      <div className="modal-box-sa">
        <h3>Create New Shop</h3>
        <form onSubmit={handleSubmit}>
          <div className="sa-form-section">
            <h4>Shop Details</h4>
            <div className="form-group-sa">
              <label>Shop Name *</label>
              <input type="text" value={form.shop_name} onChange={set('shop_name')} required />
            </div>
            <div className="form-row-sa">
              <div className="form-group-sa">
                <label>Address</label>
                <input type="text" value={form.address} onChange={set('address')} />
              </div>
              <div className="form-group-sa">
                <label>Phone</label>
                <input type="text" value={form.phone} onChange={set('phone')} />
              </div>
            </div>
          </div>

          <div className="sa-form-section">
            <h4>Admin Account</h4>
            <div className="form-row-sa">
              <div className="form-group-sa">
                <label>Display Name *</label>
                <input type="text" value={form.admin_display_name} onChange={set('admin_display_name')} required />
              </div>
              <div className="form-group-sa">
                <label>Username *</label>
                <input type="text" value={form.admin_username} onChange={set('admin_username')} required />
              </div>
            </div>
            <div className="form-row-sa">
              <div className="form-group-sa">
                <label>PIN (4–6 digits) *</label>
                <input type="password" value={form.admin_pin} onChange={set('admin_pin')} maxLength={6} />
              </div>
              <div className="form-group-sa">
                <label>Confirm PIN *</label>
                <input type="password" value={form.admin_pin_confirm} onChange={set('admin_pin_confirm')} maxLength={6} />
              </div>
            </div>
          </div>

          {error && <div className="sa-form-error">{error}</div>}
          <div className="modal-actions-sa">
            <button type="button" className="btn-secondary-sa" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-sa" disabled={saving}>
              {saving ? 'Creating…' : 'Create Shop'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Edit Receipt Config Modal ─────────────────────────────────── */

function EditReceiptModal({ tenant, onClose, onSaved }: { tenant: TenantWithAdmin; onClose: () => void; onSaved: () => void }) {
  const [shopName, setShopName] = useState(tenant.shop_name);
  const [address, setAddress] = useState(tenant.address || '');
  const [phone, setPhone] = useState(tenant.phone || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!shopName.trim()) { setError('Shop name is required'); return; }
    try {
      setSaving(true);
      await supabaseService.updateTenant(tenant.id, {
        shop_name: shopName.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update receipt config');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay-sa">
      <div className="modal-box-sa">
        <h3>Receipt Config — {tenant.shop_name}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group-sa">
            <label>Shop Name *</label>
            <input type="text" value={shopName} onChange={e => setShopName(e.target.value)} required />
          </div>
          <div className="form-row-sa">
            <div className="form-group-sa">
              <label>Address</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} />
            </div>
            <div className="form-group-sa">
              <label>Phone</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>
          {error && <div className="sa-form-error">{error}</div>}
          <div className="modal-actions-sa">
            <button type="button" className="btn-secondary-sa" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-sa" disabled={saving}>
              {saving ? 'Saving…' : 'Save Config'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Reset Admin PIN Modal ─────────────────────────────────────── */

function ResetAdminPinModal({ tenant, onClose, onSaved }: { tenant: TenantWithAdmin; onClose: () => void; onSaved: () => void }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{4,6}$/.test(pin)) { setError('PIN must be 4–6 digits'); return; }
    if (pin !== confirmPin) { setError('PINs do not match'); return; }
    if (!tenant.adminId) { setError('No admin account found for this shop'); return; }
    try {
      setSaving(true);
      const pin_hash = await hashPin(pin);
      await supabaseService.updateStaffUser(tenant.adminId, { pin_hash });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset PIN');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay-sa">
      <div className="modal-box-sa modal-box-sa-sm">
        <h3>Reset Admin PIN — {tenant.adminDisplayName}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group-sa">
            <label>New PIN (4–6 digits)</label>
            <input type="password" value={pin} onChange={e => setPin(e.target.value)} maxLength={6} />
          </div>
          <div className="form-group-sa">
            <label>Confirm PIN</label>
            <input type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} maxLength={6} />
          </div>
          {error && <div className="sa-form-error">{error}</div>}
          <div className="modal-actions-sa">
            <button type="button" className="btn-secondary-sa" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-sa" disabled={saving}>
              {saving ? 'Resetting…' : 'Reset PIN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Confirm Dialog ────────────────────────────────────────────── */

function ConfirmDialog({ title, message, confirmLabel, dangerous, onConfirm, onCancel }: {
  title: string;
  message: string;
  confirmLabel: string;
  dangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-overlay-sa">
      <div className="modal-box-sa modal-box-sa-sm">
        <h3>{title}</h3>
        <p className="sa-confirm-msg">{message}</p>
        <div className="modal-actions-sa">
          <button className="btn-secondary-sa" onClick={onCancel}>Cancel</button>
          <button className={dangerous ? 'btn-danger-sa' : 'btn-primary-sa'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
