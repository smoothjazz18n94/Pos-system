import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ShoppingCart, Wifi, WifiOff } from 'lucide-react';
import { authAPI } from '../services/api';
import { useAuthStore, useSyncStore } from '../store/syncStore';
import { initialDataSync, startAutoSync } from '../services/syncEngine';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const { isOnline } = useSyncStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isOnline) {
      return toast.error('Internet required for login');
    }
    setLoading(true);
    try {
      const { data } = await authAPI.login(form.email, form.password);
      setAuth(data.data);
      await initialDataSync();
      startAutoSync();
      toast.success(`Welcome, ${data.data.user.firstName}!`);
      navigate('/pos');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-900/50">
            <ShoppingCart size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">POS System</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to your account</p>
        </div>

        {!isOnline && (
          <div className="mb-4 px-4 py-3 bg-amber-900/30 border border-amber-800 rounded-xl flex items-center gap-2 text-amber-300 text-sm">
            <WifiOff size={15} />
            You're offline. Internet connection required to login.
          </div>
        )}

        <div className="bg-surface-900 rounded-2xl border border-slate-800 p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="admin@myshop.com"
                required
                className="w-full bg-surface-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                  className="w-full bg-surface-950 border border-slate-700 rounded-xl px-4 py-3 pr-12 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors"
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isOnline}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors mt-2 shadow-lg shadow-indigo-900/30"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800 text-xs text-slate-600 text-center space-y-0.5">
            <p>Demo: admin@myshop.com / admin123!</p>
            <p>Cashier: cashier@myshop.com / cashier123!</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-600">
          {isOnline ? <Wifi size={12} className="text-emerald-600" /> : <WifiOff size={12} className="text-amber-600" />}
          {isOnline ? 'Connected' : 'Offline'}
          <span>•</span>
          <span>PWA v1.0</span>
        </div>
      </div>
    </div>
  );
}
