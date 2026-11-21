// UsersPage.jsx
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, UserX, Shield } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { userAPI, branchAPI, authAPI } from '../services/api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, b] = await Promise.all([userAPI.list(), branchAPI.list()]);
      setUsers(u.data.data);
      setBranches(b.data.data);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  const handleDeactivate = async (id) => {
    if (!confirm('Deactivate this user?')) return;
    try {
      await userAPI.delete(id);
      setUsers(u => u.map(usr => usr.id === id ? { ...usr, isActive: false } : usr));
      toast.success('User deactivated');
    } catch { toast.error('Failed to deactivate'); }
  };

  const ROLE_COLORS = {
    ADMIN: 'bg-red-900/30 text-red-400',
    MANAGER: 'bg-purple-900/30 text-purple-400',
    CASHIER: 'bg-blue-900/30 text-blue-400',
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-slate-500 text-sm">{users.filter(u => u.isActive).length} active users</p>
        </div>
        <button onClick={() => { setSelected(null); setModal('add'); }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-medium text-sm">
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="bg-surface-900 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-4 py-3 text-slate-500 font-medium">User</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium hidden sm:table-cell">Role</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium hidden md:table-cell">Branch</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i}>{[...Array(4)].map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : users.map(user => (
              <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-800 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </div>
                    <div>
                      <p className="text-white font-medium">{user.firstName} {user.lastName}</p>
                      <p className="text-slate-600 text-xs">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', ROLE_COLORS[user.role])}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-sm hidden md:table-cell">
                  {user.branch?.name || '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium',
                    user.isActive ? 'bg-emerald-900/30 text-emerald-400' : 'bg-slate-800 text-slate-500')}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => { setSelected(user); setModal('edit'); }}
                      className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-900/20 rounded-lg">
                      <Edit2 size={14} />
                    </button>
                    {user.isActive && (
                      <button onClick={() => handleDeactivate(user.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg">
                        <UserX size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <UserModal
          user={selected}
          branches={branches}
          onClose={() => { setModal(null); setSelected(null); }}
          onSave={async (data) => {
            try {
              if (modal === 'add') {
                await authAPI.register(data);
                toast.success('User created');
              } else {
                await userAPI.update(selected.id, data);
                toast.success('User updated');
              }
              setModal(null);
              loadData();
            } catch (err) { toast.error(err.response?.data?.message || 'Failed to save user'); }
          }}
        />
      )}
    </div>
  );
}

function UserModal({ user, branches, onClose, onSave }) {
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'CASHIER',
    branchId: user?.branchId || '',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md bg-surface-900 rounded-2xl border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-white">{user ? 'Edit User' : 'Add User'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[['firstName', 'First Name'], ['lastName', 'Last Name']].map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
                <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} required
                  className="w-full bg-surface-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Email *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required
              className="w-full bg-surface-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Password {user ? '(leave blank to keep)' : '*'}</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required={!user}
              className="w-full bg-surface-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full bg-surface-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500">
                {['ADMIN', 'MANAGER', 'CASHIER'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Branch</label>
              <select value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}
                className="w-full bg-surface-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500">
                <option value="">No branch</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">
              {user ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
