import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { supabase, supabaseService } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import '../styles/SettingsPage.css';

type Tab = 'users' | 'categories' | 'contact' | 'security' | 'manual' | 'about';

interface Props {
  onExit: () => void;
}

interface StaffUser {
  id: string;
  username: string;
  display_name: string;
  role: 'admin' | 'cashier';
  is_active: boolean;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

async function hashPin(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const CATEGORY_ORDER_KEY = 'vizia-category-order';

export default function SettingsPage({ onExit }: Props) {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const allTabs: { key: Tab; icon: string; label: string; adminOnly?: boolean }[] = [
    { key: 'users', icon: '👥', label: 'Users', adminOnly: true },
    { key: 'categories', icon: '🏷️', label: 'Categories', adminOnly: true },
    { key: 'contact', icon: '📞', label: 'Contact' },
    { key: 'security', icon: '🔐', label: 'Security' },
    { key: 'manual', icon: '📖', label: 'Manual' },
    { key: 'about', icon: 'ℹ️', label: 'About' },
  ];

  const tabs = allTabs.filter(t => isAdmin || !t.adminOnly);
  const [activeTab, setActiveTab] = useState<Tab>(isAdmin ? 'users' : 'contact');

  return (
    <div className="settings-page">
      <aside className="settings-sidebar">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`nav-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="nav-item-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
        <button className="exit-btn" onClick={onExit}>
          ⬅ Back to POS
        </button>
      </aside>

      <div className="settings-content">
        {activeTab === 'users' && <UsersTab tenantId={currentUser?.tenant_id} />}
        {activeTab === 'categories' && <CategoriesTab tenantId={currentUser?.tenant_id} />}
        {activeTab === 'contact' && <ContactTab />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'manual' && <ManualTab />}
        {activeTab === 'about' && <AboutTab />}
      </div>
    </div>
  );
}

/* ─── Users Tab ─────────────────────────────────────────────────── */

type UserModal =
  | { type: 'create' }
  | { type: 'edit'; user: StaffUser }
  | { type: 'reset-pin'; user: StaffUser }
  | { type: 'delete'; user: StaffUser };

function UsersTab({ tenantId }: { tenantId?: string }) {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<UserModal | null>(null);

  const loadUsers = async () => {
    if (!supabase) {
      setError('Supabase not configured');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      let query = supabase
        .from('staff_users')
        .select('id, username, display_name, role, is_active, created_at')
        .eq('role', 'cashier')
        .order('created_at', { ascending: false });
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      } else {
        query = query.is('tenant_id', null);
      }
      const { data, error: err } = await query;
      if (err) throw new Error(err.message);
      setUsers((data as StaffUser[]) || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, [tenantId]);

  const closeModal = () => setModal(null);
  const afterSave = () => { closeModal(); loadUsers(); };

  if (loading) return <div className="settings-loading">Loading users…</div>;
  if (error) return <div className="settings-error">{error}</div>;

  return (
    <div className="tab-users">
      <div className="tab-header">
        <h2>User Management</h2>
        <button className="btn-primary" onClick={() => setModal({ type: 'create' })}>
          + Create User
        </button>
      </div>

      <table className="settings-table">
        <thead>
          <tr>
            <th>Display Name</th>
            <th>Username</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.display_name}</td>
              <td>{u.username}</td>
              <td>
                <span className={`badge badge-role-${u.role}`}>{u.role}</span>
              </td>
              <td>
                <span className={`pill ${u.is_active ? 'pill-active' : 'pill-inactive'}`}>
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="actions-cell">
                <button className="btn-link" onClick={() => setModal({ type: 'edit', user: u })}>Edit</button>
                <button className="btn-link" onClick={() => setModal({ type: 'reset-pin', user: u })}>Reset PIN</button>
                <button className="btn-link btn-danger-link" onClick={() => setModal({ type: 'delete', user: u })}>Delete</button>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr><td colSpan={5} className="empty-row">No users found.</td></tr>
          )}
        </tbody>
      </table>

      {modal?.type === 'create' && (
        <CreateUserModal tenantId={tenantId} onClose={closeModal} onSaved={afterSave} />
      )}
      {modal?.type === 'edit' && (
        <EditUserModal user={modal.user} onClose={closeModal} onSaved={afterSave} />
      )}
      {modal?.type === 'reset-pin' && (
        <ResetPinModal user={modal.user} onClose={closeModal} onSaved={afterSave} />
      )}
      {modal?.type === 'delete' && (
        <DeleteUserModal user={modal.user} onClose={closeModal} onSaved={afterSave} />
      )}
    </div>
  );
}

interface CreateUserForm {
  display_name: string;
  username: string;
  pin: string;
  confirm_pin: string;
}

function CreateUserModal({ tenantId, onClose, onSaved }: { tenantId?: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CreateUserForm>({
    display_name: '',
    username: '',
    pin: '',
    confirm_pin: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const set = (field: keyof CreateUserForm) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!supabase) { setError('Supabase not configured'); return; }
    if (!form.display_name.trim()) { setError('Display name is required'); return; }
    if (!form.username.trim()) { setError('Username is required'); return; }
    if (!/^\d{4,6}$/.test(form.pin)) { setError('PIN must be 4–6 digits'); return; }
    if (form.pin !== form.confirm_pin) { setError('PINs do not match'); return; }

    try {
      setSaving(true);
      const pin_hash = await hashPin(form.pin);
      const { error: err } = await supabase.from('staff_users').insert([{
        username: form.username.trim(),
        display_name: form.display_name.trim(),
        role: 'cashier',
        pin_hash,
        is_active: true,
        tenant_id: tenantId || null,
      }]);
      if (err) throw new Error(err.message);
      setSuccess(true);
      setTimeout(onSaved, 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3>Create Cashier</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Display Name</label>
            <input type="text" value={form.display_name} onChange={set('display_name')} required />
          </div>
          <div className="form-group">
            <label>Username</label>
            <input type="text" value={form.username} onChange={set('username')} required />
          </div>
          <div className="form-group">
            <label>PIN (4–6 digits)</label>
            <input type="password" value={form.pin} onChange={set('pin')} maxLength={6} />
          </div>
          <div className="form-group">
            <label>Confirm PIN</label>
            <input type="password" value={form.confirm_pin} onChange={set('confirm_pin')} maxLength={6} />
          </div>
          {error && <div className="form-error">{error}</div>}
          {success && <div className="form-success">Cashier created!</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSaved }: { user: StaffUser; onClose: () => void; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [isActive, setIsActive] = useState(user.is_active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) { setError('Supabase not configured'); return; }
    if (!displayName.trim()) { setError('Display name is required'); return; }
    try {
      setSaving(true);
      const { error: err } = await supabase
        .from('staff_users')
        .update({ display_name: displayName.trim(), is_active: isActive })
        .eq('id', user.id);
      if (err) throw new Error(err.message);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3>Edit Cashier — {user.username}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Display Name</label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={isActive ? 'active' : 'inactive'} onChange={e => setIsActive(e.target.value === 'active')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPinModal({ user, onClose, onSaved }: { user: StaffUser; onClose: () => void; onSaved: () => void }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) { setError('Supabase not configured'); return; }
    if (!/^\d{4,6}$/.test(pin)) { setError('PIN must be 4–6 digits'); return; }
    if (pin !== confirmPin) { setError('PINs do not match'); return; }
    try {
      setSaving(true);
      const pin_hash = await hashPin(pin);
      const { error: err } = await supabase
        .from('staff_users')
        .update({ pin_hash })
        .eq('id', user.id);
      if (err) throw new Error(err.message);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset PIN');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3>Reset PIN — {user.display_name}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>New PIN (4–6 digits)</label>
            <input type="password" value={pin} onChange={e => setPin(e.target.value)} maxLength={6} />
          </div>
          <div className="form-group">
            <label>Confirm PIN</label>
            <input type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} maxLength={6} />
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Reset PIN'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteUserModal({ user, onClose, onSaved }: { user: StaffUser; onClose: () => void; onSaved: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!supabase) { setError('Supabase not configured'); return; }
    try {
      setDeleting(true);
      const { error: err } = await supabase
        .from('staff_users')
        .delete()
        .eq('id', user.id);
      if (err) throw new Error(err.message);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3>Delete User</h3>
        <p>Are you sure you want to delete <strong>{user.display_name}</strong> ({user.username})? This action cannot be undone.</p>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Categories Tab ─────────────────────────────────────────────── */

function CategoriesTab({ tenantId }: { tenantId?: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const getSavedOrder = (): string[] => {
    try {
      const raw = localStorage.getItem(CATEGORY_ORDER_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  };

  const saveOrder = (cats: Category[]) => {
    localStorage.setItem(CATEGORY_ORDER_KEY, JSON.stringify(cats.map(c => c.id)));
  };

  const loadCategories = async () => {
    try {
      setLoading(true);
      const loaded = await supabaseService.getCategories();
      const savedOrder = getSavedOrder();
      if (savedOrder.length > 0) {
        const map = new Map(loaded.map(c => [c.id, c]));
        const ordered: Category[] = [];
        savedOrder.forEach(id => { const c = map.get(id); if (c) ordered.push(c); });
        loaded.forEach(c => { if (!savedOrder.includes(c.id)) ordered.push(c); });
        setCategories(ordered);
      } else {
        setCategories(loaded);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCategories(); }, [tenantId]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...categories];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setCategories(next);
    saveOrder(next);
  };

  const moveDown = (index: number) => {
    if (index === categories.length - 1) return;
    const next = [...categories];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setCategories(next);
    saveOrder(next);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description || '');
  };

  const cancelEdit = () => { setEditingId(null); setEditName(''); setEditDesc(''); };

  const saveEdit = async (cat: Category) => {
    if (!supabase) { setError('Supabase not configured'); return; }
    if (!editName.trim()) return;
    try {
      setSaving(true);
      const { error: err } = await supabase
        .from('categories')
        .update({ name: editName.trim(), description: editDesc.trim() })
        .eq('id', cat.id);
      if (err) throw new Error(err.message);
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, name: editName.trim(), description: editDesc.trim() } : c));
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!supabase) { setError('Supabase not configured'); return; }
    const cat = categories.find(c => c.id === id);
    try {
      // Delete all products in this category (match tenant_id or null for orphans)
      if (cat) {
        const { error: prodErr } = await supabase
          .from('products')
          .delete()
          .eq('category', cat.name)
          .or(tenantId
            ? `tenant_id.eq.${tenantId},tenant_id.is.null`
            : 'tenant_id.is.null');
        if (prodErr) throw new Error(prodErr.message);
      }
      // Then delete the category itself
      const { error: err } = await supabase.from('categories').delete().eq('id', id);
      if (err) throw new Error(err.message);
      setCategories(prev => prev.filter(c => c.id !== id));
      setDeletingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete category');
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!supabase) { setAddError('Supabase not configured'); return; }
    if (!newName.trim()) { setAddError('Name is required'); return; }
    try {
      setSaving(true);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const { error: err } = await supabase
        .from('categories')
        .insert([{ id, name: newName.trim(), description: newDesc.trim(), created_at: now, ...(tenantId ? { tenant_id: tenantId } : {}) }]);
      if (err) throw new Error(err.message);
      const newCat: Category = { id, name: newName.trim(), description: newDesc.trim(), created_at: now };
      setCategories(prev => [...prev, newCat]);
      setNewName('');
      setNewDesc('');
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to add category');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="settings-loading">Loading categories…</div>;
  if (error) return <div className="settings-error">{error}</div>;

  return (
    <div className="tab-categories">
      <div className="tab-header">
        <h2>Categories</h2>
      </div>

      <div className="category-list">
        {categories.map((cat, i) => (
          <div key={cat.id} className="category-row">
            {editingId === cat.id ? (
              <div className="cat-edit-row">
                <input
                  className="cat-edit-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Name"
                />
                <input
                  className="cat-edit-input cat-edit-desc"
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  placeholder="Description"
                />
                <div className="cat-actions">
                  <button className="btn-primary btn-sm" onClick={() => saveEdit(cat)} disabled={saving}>Save</button>
                  <button className="btn-secondary btn-sm" onClick={cancelEdit}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="cat-display-row">
                <div className="cat-info">
                  <span className="cat-name">{cat.name}</span>
                  {cat.description && <span className="cat-desc">{cat.description}</span>}
                </div>
                <div className="cat-actions">
                  <button className="btn-icon" title="Edit" onClick={() => startEdit(cat)}>✏️</button>
                  <button className="btn-icon btn-danger-icon" title="Delete" onClick={() => setDeletingId(cat.id)}>🗑</button>
                  <button className="btn-icon" title="Move up" onClick={() => moveUp(i)} disabled={i === 0}>↑</button>
                  <button className="btn-icon" title="Move down" onClick={() => moveDown(i)} disabled={i === categories.length - 1}>↓</button>
                </div>
              </div>
            )}
            {deletingId === cat.id && (
              <div className="inline-confirm">
                <span>Delete <strong>{cat.name}</strong> and all its products?</span>
                <button className="btn-danger btn-sm" onClick={() => handleDelete(cat.id)}>Yes, delete all</button>
                <button className="btn-secondary btn-sm" onClick={() => setDeletingId(null)}>Cancel</button>
              </div>
            )}
          </div>
        ))}
        {categories.length === 0 && <div className="empty-row">No categories yet.</div>}
      </div>

      <div className="add-category-form">
        <h3>Add Category</h3>
        <form onSubmit={handleAdd}>
          <div className="form-row">
            <div className="form-group">
              <label>Name *</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: 'flex-end' }}>
              {saving ? 'Adding…' : '+ Add'}
            </button>
          </div>
          {addError && <div className="form-error">{addError}</div>}
        </form>
      </div>
    </div>
  );
}

/* ─── Contact Tab ────────────────────────────────────────────────── */

function ContactTab() {
  return (
    <div className="tab-contact">
      <h2>Contact Us</h2>
      <p className="support-hours">Available Mon–Sat, 8 AM – 6 PM EAT</p>

      <div className="contact-cards">
        <div className="contact-card">
          <div className="contact-card-icon">
            <span>📞</span>
            <svg className="whatsapp-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="36" height="36" aria-hidden="true">
              <circle cx="16" cy="16" r="16" fill="#25D366" />
              <path
                d="M23.5 19.9c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6 0-.3-.2-1.3-.5-2.5-1.6-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.7 1.1 2.9c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4 0-.1-.2-.2-.5-.3z"
                fill="#fff"
              />
              <path
                d="M16 4C9.4 4 4 9.4 4 16c0 2.1.6 4.2 1.6 6L4 28l6.2-1.6c1.7.9 3.7 1.4 5.8 1.4 6.6 0 12-5.4 12-12S22.6 4 16 4zm0 22c-1.9 0-3.7-.5-5.3-1.4l-.4-.2-3.7 1 1-3.6-.2-.4C6.5 19.7 6 17.9 6 16 6 10.5 10.5 6 16 6s10 4.5 10 10-4.5 10-10 10z"
                fill="#fff"
              />
            </svg>
          </div>
          <div className="contact-phone-number">0724-121-679</div>
          <div className="contact-card-buttons">
            <a href="tel:+254724121679" className="contact-btn contact-btn-call">📞 Call</a>
            <a href="https://wa.me/254724121679" className="contact-btn contact-btn-whatsapp" target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </div>
        </div>

        <div className="contact-card">
          <div className="contact-card-icon"><span>✉️</span></div>
          <div className="contact-email-address">htechnob@gmail.com</div>
          <div className="contact-card-buttons">
            <a href="mailto:htechnob@gmail.com" className="contact-btn contact-btn-email">✉️ Send Email</a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Manual Tab ─────────────────────────────────────────────────── */

function ManualTab() {
  return (
    <div className="tab-manual">
      <div className="manual-header">
        <h2>VIZIA POS — Product Manual</h2>
        <div className="manual-meta">
          <span>Version: 1.0</span>
          <span>Prepared by: VIZIA Technologies</span>
          <span>Classification: Internal &amp; Client Use</span>
        </div>
      </div>

      <div className="manual-toc">
        <h3>Table of Contents</h3>
        <ol>
          <li>Introduction</li>
          <li>About VIZIA POS</li>
          <li>Product Objectives</li>
          <li>Core Capabilities</li>
          <li>System Architecture</li>
          <li>User Roles</li>
          <li>Functional Modules</li>
          <li>Operating Procedures</li>
          <li>Offline Operations</li>
          <li>Security</li>
          <li>Reporting &amp; Analytics</li>
          <li>Administration</li>
          <li>Backup &amp; Recovery</li>
          <li>Maintenance</li>
          <li>Best Practices</li>
          <li>Troubleshooting</li>
          <li>Technical Specifications</li>
          <li>Support Services</li>
        </ol>
      </div>

      <div className="manual-section">
        <h3>1. Introduction</h3>
        <p>VIZIA POS is an enterprise-grade Point of Sale (POS) and Retail Management System developed by <strong>VIZIA Technologies</strong> to simplify business operations through intelligent automation, secure transaction processing, inventory control, financial management, and business analytics.</p>
        <p>The platform has been engineered specifically for retailers, wholesalers, agrovets, pharmacies, supermarkets, hardware stores, hospitality businesses, and SMEs requiring reliable operations in both online and offline environments.</p>
        <p>This manual provides operational guidelines, administrative procedures, security standards, and best practices for effective use of the system.</p>
      </div>

      <div className="manual-section">
        <h3>2. About VIZIA POS</h3>
        <p>VIZIA POS is a modern cloud-enabled retail management platform designed to streamline the complete sales lifecycle.</p>
        <p>The system combines:</p>
        <ul>
          <li>Point of Sale</li>
          <li>Inventory Management</li>
          <li>Customer Management</li>
          <li>Credit Sales</li>
          <li>Financial Tracking</li>
          <li>Business Reporting</li>
          <li>Offline Transaction Processing</li>
          <li>Cloud Synchronization</li>
        </ul>
        <p>The application is available as a Web Application, Android POS Application, Tablet Interface, and Desktop Browser.</p>
      </div>

      <div className="manual-section">
        <h3>3. Product Objectives</h3>
        <p>VIZIA POS aims to:</p>
        <ul>
          <li>Digitize retail operations</li>
          <li>Reduce operational costs</li>
          <li>Improve inventory accuracy</li>
          <li>Enhance transaction speed</li>
          <li>Support offline business continuity</li>
          <li>Provide real-time business intelligence</li>
          <li>Improve customer service</li>
          <li>Increase profitability through better reporting</li>
        </ul>
      </div>

      <div className="manual-section">
        <h3>4. Core Capabilities</h3>

        <h4>Sales Processing</h4>
        <p>The system enables cashiers to process sales quickly using an intuitive checkout interface supporting multiple payment methods.</p>
        <p>Supported payment methods: Cash, Mobile Money, Card, Credit Accounts.</p>
        <p>Features include product search, barcode support, quantity adjustments, discounts, receipt generation, and customer information capture.</p>

        <h4>Inventory Management</h4>
        <p>Inventory is automatically updated after every successful transaction. Capabilities include product registration, category management, price management, stock monitoring, low-stock alerts, stock valuation, and product image management.</p>

        <h4>Customer Credit Management</h4>
        <p>Businesses may issue goods on credit while maintaining complete customer records. The module supports customer profiles, outstanding balances, partial payments, payment history, and credit statements.</p>

        <h4>Financial Management</h4>
        <p>Administrators can monitor business finances through integrated expense tracking. Expense categories include Salaries, Rent, Utilities, Logistics, Investments, and Miscellaneous Expenses. The system automatically calculates estimated profit by comparing sales revenue against recorded expenses.</p>

        <h4>Business Reporting</h4>
        <p>VIZIA POS provides comprehensive business intelligence dashboards including Daily Sales, Weekly Sales, Monthly Revenue, Top Selling Products, Cashier Performance, Payment Method Analysis, Profit Overview, and Inventory Valuation. Reports can be exported for management review and accounting purposes.</p>
      </div>

      <div className="manual-section">
        <h3>5. System Architecture</h3>
        <p>VIZIA POS follows a modern multi-tier architecture:</p>
        <div className="manual-arch">
          <div className="arch-layer"><strong>Presentation Layer</strong> — Responsive Web Interface &amp; Android Application</div>
          <div className="arch-arrow">↓</div>
          <div className="arch-layer"><strong>Application Layer</strong> — Business Logic, Authentication &amp; Transaction Engine</div>
          <div className="arch-arrow">↓</div>
          <div className="arch-layer"><strong>Data Layer</strong> — Local Offline Database &amp; Cloud Database</div>
          <div className="arch-arrow">↓</div>
          <div className="arch-layer"><strong>Cloud Services</strong> — Secure Synchronization, Reporting &amp; Backup</div>
        </div>
        <p>This architecture ensures high availability, scalability, and reliable offline operations.</p>
      </div>

      <div className="manual-section">
        <h3>6. User Roles</h3>
        <h4>System Administrator</h4>
        <p>Responsibilities: user creation, staff management, product management, reports, expenses, inventory, system configuration, and business analytics.</p>
        <h4>Cashier</h4>
        <p>Responsibilities: sales processing, customer payments, credit sales, transaction history, and receipt printing. Cashiers cannot modify administrative settings.</p>
      </div>

      <div className="manual-section">
        <h3>7. Functional Modules</h3>
        <div className="manual-modules">
          <div className="module-item"><strong>Login &amp; Authentication</strong> — Secure PIN-based authentication verifies authorized users before granting system access.</div>
          <div className="module-item"><strong>Dashboard</strong> — Displays today's sales, business performance, notifications, pending synchronization, and low-stock alerts.</div>
          <div className="module-item"><strong>Point of Sale</strong> — Supports product lookup, cart management, discounts, multiple payment methods, receipt generation, and customer identification.</div>
          <div className="module-item"><strong>Inventory</strong> — Provides product creation, editing, stock adjustments, categorization, and inventory valuation.</div>
          <div className="module-item"><strong>Credit Sales</strong> — Allows businesses to sell on credit, record payments, track outstanding balances, and generate customer statements.</div>
          <div className="module-item"><strong>Reports</strong> — Includes Daily, Monthly, Product Performance, Sales Analysis, Cash Flow, and Payment Analysis reports.</div>
          <div className="module-item"><strong>Finance</strong> — Provides expense recording, categorization, profit estimation, and financial summaries.</div>
        </div>
      </div>

      <div className="manual-section">
        <h3>8. Operating Procedures</h3>

        <h4>Starting the System</h4>
        <ol>
          <li>Launch VIZIA POS.</li>
          <li>Enter your secure PIN.</li>
          <li>Select your assigned workspace.</li>
          <li>Verify network status.</li>
          <li>Begin daily operations.</li>
        </ol>

        <h4>Processing a Sale</h4>
        <ol>
          <li>Search or scan products.</li>
          <li>Add items to the cart.</li>
          <li>Apply discounts if authorized.</li>
          <li>Select payment method.</li>
          <li>Confirm payment.</li>
          <li>Print or share receipt.</li>
        </ol>

        <h4>Processing Credit Sales</h4>
        <ol>
          <li>Select <strong>Credit Payment</strong>.</li>
          <li>Capture customer information.</li>
          <li>Confirm outstanding balance.</li>
          <li>Save transaction.</li>
        </ol>

        <h4>Recording Credit Payments</h4>
        <ol>
          <li>Locate customer account.</li>
          <li>Open outstanding balance.</li>
          <li>Record payment amount.</li>
          <li>Print receipt.</li>
          <li>Save transaction.</li>
        </ol>
      </div>

      <div className="manual-section">
        <h3>9. Offline Operations</h3>
        <p>VIZIA POS continues operating during internet outages.</p>
        <p><strong>While offline:</strong> Sales continue normally, inventory updates locally, receipts are generated, and transactions are securely queued.</p>
        <p><strong>Once connectivity is restored:</strong> Pending transactions synchronize automatically, cloud inventory updates, reports refresh, and synchronization status is confirmed.</p>
        <p>This ensures uninterrupted business operations.</p>
      </div>

      <div className="manual-section">
        <h3>10. Security</h3>
        <p>Security measures include:</p>
        <ul>
          <li>Encrypted communication</li>
          <li>PIN authentication</li>
          <li>Role-based permissions</li>
          <li>Audit logs</li>
          <li>Transaction validation</li>
          <li>Secure cloud synchronization</li>
          <li>Data encryption</li>
        </ul>
        <p>Administrative functions require elevated privileges.</p>
      </div>

      <div className="manual-section">
        <h3>11. Reporting &amp; Analytics</h3>
        <p>Management reports include Revenue Analysis, Sales Trends, Customer Credit Reports, Expense Reports, Product Performance, Cashier Productivity, Inventory Reports, and Profit Estimates. Reports may be exported for auditing, accounting, or strategic planning.</p>
      </div>

      <div className="manual-section">
        <h3>12. Administration</h3>
        <p>System administrators are responsible for managing users, resetting PINs, creating products, managing categories, reviewing reports, monitoring inventory, recording expenses, and maintaining system integrity.</p>
      </div>

      <div className="manual-section">
        <h3>13. Backup &amp; Recovery</h3>
        <p>Business data is protected through cloud synchronization. Recommended practices include:</p>
        <ul>
          <li>Daily database backups</li>
          <li>Weekly recovery testing</li>
          <li>Secure backup storage</li>
          <li>Periodic integrity verification</li>
        </ul>
        <p>In the event of device replacement or failure, synchronized data can be restored after authentication.</p>
      </div>

      <div className="manual-section">
        <h3>14. Maintenance</h3>
        <p>Routine maintenance includes software updates, database optimization, product catalogue review, user account audits, log monitoring, and security patch installation. Regular maintenance ensures optimal system performance and reliability.</p>
      </div>

      <div className="manual-section">
        <h3>15. Best Practices</h3>
        <ul>
          <li>Keep product information current.</li>
          <li>Perform regular stock counts.</li>
          <li>Monitor low-stock alerts.</li>
          <li>Record expenses promptly.</li>
          <li>Review daily sales reports.</li>
          <li>Use unique PINs for all staff.</li>
          <li>Synchronize data whenever an internet connection is available.</li>
          <li>Restrict administrative access to authorized personnel.</li>
        </ul>
      </div>

      <div className="manual-section">
        <h3>16. Troubleshooting</h3>
        <table className="manual-table">
          <thead>
            <tr>
              <th>Issue</th>
              <th>Cause</th>
              <th>Resolution</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Login Failed</td>
              <td>Incorrect PIN</td>
              <td>Verify credentials or contact an administrator.</td>
            </tr>
            <tr>
              <td>Products Missing</td>
              <td>Synchronization pending</td>
              <td>Refresh the catalogue or reconnect to the internet.</td>
            </tr>
            <tr>
              <td>Receipt Not Printing</td>
              <td>Printer unavailable</td>
              <td>Check printer connection or retry printing.</td>
            </tr>
            <tr>
              <td>Pending Sync</td>
              <td>No internet connection</td>
              <td>Restore connectivity; synchronization resumes automatically.</td>
            </tr>
            <tr>
              <td>Slow Performance</td>
              <td>High transaction volume</td>
              <td>Restart the application or perform scheduled maintenance.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="manual-section">
        <h3>17. Technical Specifications</h3>
        <table className="manual-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Specification</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Platform</td><td>Web &amp; Android</td></tr>
            <tr><td>Architecture</td><td>Offline-First</td></tr>
            <tr><td>Database</td><td>PostgreSQL with Local Cache</td></tr>
            <tr><td>Authentication</td><td>Secure PIN-Based Access</td></tr>
            <tr><td>Reporting</td><td>Real-Time Analytics</td></tr>
            <tr><td>Receipt Output</td><td>Thermal Printer &amp; PDF</td></tr>
            <tr><td>Deployment</td><td>Cloud &amp; On-Premise Ready</td></tr>
            <tr><td>Synchronization</td><td>Automatic Background Sync</td></tr>
          </tbody>
        </table>
      </div>

      <div className="manual-section">
        <h3>18. Support Services</h3>
        <p>VIZIA Technologies provides comprehensive post-deployment support, including:</p>
        <ul>
          <li>System installation and configuration</li>
          <li>User onboarding and training</li>
          <li>Data migration assistance</li>
          <li>Preventive maintenance</li>
          <li>Remote technical support</li>
          <li>Software updates and enhancements</li>
          <li>Business continuity planning</li>
          <li>Feature customization and integrations</li>
        </ul>
      </div>

      <div className="manual-footer">
        <p><strong>VIZIA Technologies</strong></p>
        <p className="manual-tagline">Innovate. Automate. Elevate.</p>
      </div>
    </div>
  );
}

/* ─── About Tab ──────────────────────────────────────────────────── */

function SecurityTab() {
  const { isBiometricAvailable, isBiometricRegistered, registerBiometric, disableBiometric } = useAuth();
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const handleEnable = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await registerBiometric();
      setStatus({ type: 'success', msg: 'Fingerprint login enabled on this device.' });
    } catch (err) {
      setStatus({ type: 'error', msg: err instanceof Error ? err.message : 'Setup failed.' });
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = () => {
    disableBiometric();
    setStatus({ type: 'success', msg: 'Fingerprint login disabled on this device.' });
  };

  return (
    <div className="tab-security">
      <h2>Security</h2>

      <div className="security-section">
        <h3>Fingerprint Login</h3>
        <p className="security-desc">
          Use your device fingerprint sensor to log in instead of typing your PIN.
          This setting applies only to this device.
        </p>

        {!isBiometricAvailable && (
          <div className="security-notice">
            Fingerprint authentication is not available on this device or browser.
            Try opening the app in Chrome on an Android phone.
          </div>
        )}

        {isBiometricAvailable && (
          <div className="security-toggle-row">
            <span className="security-toggle-label">
              {isBiometricRegistered ? 'Fingerprint login is ON' : 'Fingerprint login is OFF'}
            </span>
            {isBiometricRegistered ? (
              <button className="btn-danger-outline" onClick={handleDisable} disabled={busy}>
                Disable
              </button>
            ) : (
              <button className="btn-primary" onClick={handleEnable} disabled={busy}>
                {busy ? 'Setting up…' : 'Enable'}
              </button>
            )}
          </div>
        )}

        {status && (
          <div className={status.type === 'success' ? 'settings-success' : 'settings-error'}>
            {status.msg}
          </div>
        )}
      </div>
    </div>
  );
}

function AboutTab() {
  return (
    <div className="tab-about">
      <div className="about-header">
        <h2>VIZIA Technologies</h2>
        <span className="about-version">v1.0.0</span>
      </div>

      <p className="about-tagline-bold">Innovating Today. Empowering Tomorrow.</p>

      <p className="about-body">
        VIZIA Technologies is a forward-thinking technology company dedicated to delivering innovative digital
        solutions that enable organizations, institutions, and individuals to thrive in an increasingly connected
        world. We combine technical excellence, strategic thinking, and a customer-centric approach to design
        solutions that solve real-world challenges while driving sustainable growth.
      </p>

      <p className="about-body">
        Founded with the vision of transforming ideas into impactful digital experiences, VIZIA Technologies
        specializes in software engineering, cloud-based solutions, enterprise systems, digital transformation,
        and emerging technologies. Our multidisciplinary team leverages modern development practices and
        cutting-edge technologies to build secure, scalable, and intelligent solutions tailored to our clients'
        unique needs.
      </p>

      <p className="about-body">
        Our expertise spans multiple industries, including education, retail, finance, logistics, healthcare,
        government, and small and medium-sized enterprises. At VIZIA Technologies, innovation is driven by
        collaboration — we work closely with our clients as strategic partners, ensuring every solution aligns
        with their objectives, operational requirements, and long-term vision.
      </p>

      <div className="about-section">
        <h3>Our Mission</h3>
        <p className="about-body">
          To empower organizations through innovative, reliable, and intelligent technology solutions that
          enhance productivity, accelerate digital transformation, and create sustainable value.
        </p>
      </div>

      <div className="about-section">
        <h3>Our Vision</h3>
        <p className="about-body">
          To become a globally recognized technology company delivering transformative digital solutions that
          redefine how businesses and communities interact with technology.
        </p>
      </div>

      <div className="about-section">
        <h3>Our Core Values</h3>
        <ul>
          <li><strong>Innovation</strong> — Continuously exploring new technologies and creative approaches.</li>
          <li><strong>Integrity</strong> — Building trust through honesty, transparency, and accountability.</li>
          <li><strong>Excellence</strong> — Delivering exceptional quality in every solution we provide.</li>
          <li><strong>Customer Success</strong> — Placing our clients' goals at the center of everything we do.</li>
          <li><strong>Collaboration</strong> — Fostering strong partnerships that drive shared success.</li>
          <li><strong>Continuous Learning</strong> — Embracing growth, research, and technological advancement.</li>
        </ul>
      </div>

      <div className="about-section">
        <h3>Our Promise</h3>
        <p className="about-body">
          At VIZIA Technologies, we do more than develop technology — we build intelligent solutions that
          empower organizations, inspire innovation, and create lasting digital transformation.
        </p>
      </div>

      <div className="about-section about-meta">
        <p><strong>Developed by:</strong> VIZIA Technologies</p>
        <p><strong>Contact:</strong> htechnob@gmail.com · 0724-121-679</p>
      </div>
    </div>
  );
}
