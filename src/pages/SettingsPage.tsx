import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import '../styles/SettingsPage.css';

type Tab = 'users' | 'categories' | 'contact' | 'about';

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
  description: string;
  created_at: string;
}

async function hashPin(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const CATEGORY_ORDER_KEY = 'vizia-category-order';

export default function SettingsPage({ onExit }: Props) {
  useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('users');

  const tabs: { key: Tab; icon: string; label: string }[] = [
    { key: 'users', icon: '👥', label: 'Users' },
    { key: 'categories', icon: '🏷️', label: 'Categories' },
    { key: 'contact', icon: '📞', label: 'Contact' },
    { key: 'about', icon: 'ℹ️', label: 'About' },
  ];

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
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'categories' && <CategoriesTab />}
        {activeTab === 'contact' && <ContactTab />}
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

function UsersTab() {
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
      const { data, error: err } = await supabase
        .from('staff_users')
        .select('id, username, display_name, role, is_active, created_at')
        .order('created_at', { ascending: false });
      if (err) throw new Error(err.message);
      setUsers((data as StaffUser[]) || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

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
        <CreateUserModal onClose={closeModal} onSaved={afterSave} />
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
  role: 'admin' | 'cashier';
  pin: string;
  confirm_pin: string;
}

function CreateUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CreateUserForm>({
    display_name: '',
    username: '',
    role: 'cashier',
    pin: '',
    confirm_pin: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const set = (field: keyof CreateUserForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
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
        role: form.role,
        pin_hash,
        is_active: true,
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
        <h3>Create User</h3>
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
            <label>Role</label>
            <select value={form.role} onChange={set('role')}>
              <option value="cashier">Cashier</option>
              <option value="admin">Admin</option>
            </select>
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
          {success && <div className="form-success">User created!</div>}
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
  const [role, setRole] = useState<'admin' | 'cashier'>(user.role);
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
        .update({ display_name: displayName.trim(), role })
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
        <h3>Edit User — {user.username}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Display Name</label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select value={role} onChange={e => setRole(e.target.value as 'admin' | 'cashier')}>
              <option value="cashier">Cashier</option>
              <option value="admin">Admin</option>
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

function CategoriesTab() {
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
    if (!supabase) {
      setError('Supabase not configured');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (err) throw new Error(err.message);
      const loaded = (data as Category[]) || [];
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

  useEffect(() => { loadCategories(); }, []);

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
    try {
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
        .insert([{ id, name: newName.trim(), description: newDesc.trim(), created_at: now }]);
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
                <span>Delete <strong>{cat.name}</strong>?</span>
                <button className="btn-danger btn-sm" onClick={() => handleDelete(cat.id)}>Yes, delete</button>
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

/* ─── About Tab ──────────────────────────────────────────────────── */

function AboutTab() {
  return (
    <div className="tab-about">
      <div className="about-header">
        <h2>VIZIA POS</h2>
        <span className="about-version">v1.0.0</span>
      </div>
      <p className="about-tagline">
        A full-featured, offline-capable Point of Sale system for agricultural retail shops in Kenya.
        Runs as a web app and as a native Android APK — both from the same codebase.
      </p>

      <div className="about-section">
        <h3>Key Features</h3>
        <ul>
          <li>Point of Sale with barcode scanning, discounts, and multiple payment methods (Cash, Card, M-Pesa, Credit)</li>
          <li>Inventory management with low-stock alerts and photo capture</li>
          <li>Credit sales tracking with partial payment recording</li>
          <li>Sales reports, finance/expense tracking, and PDF export</li>
          <li>Stock requisition with PDF export for suppliers</li>
          <li>Offline-first: sales queue in local storage and sync automatically when online</li>
        </ul>
      </div>

      <div className="about-section">
        <h3>Technology</h3>
        <ul>
          <li>React + TypeScript · Supabase (PostgreSQL) · Capacitor (Android)</li>
          <li>Works fully offline with IndexedDB</li>
        </ul>
      </div>

      <div className="about-section about-meta">
        <p><strong>Developed by:</strong> HTechno Solutions</p>
        <p><strong>Contact:</strong> htechnob@gmail.com · 0724-121-679</p>
        <p><strong>Licensed for:</strong> Mkulima Agrovet Shop</p>
      </div>
    </div>
  );
}
