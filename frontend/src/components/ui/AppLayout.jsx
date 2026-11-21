import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, LayoutDashboard, Package, Receipt,
  BarChart3, Warehouse, Users, Settings, LogOut,
  Menu, X, Wifi, WifiOff, RefreshCw, AlertCircle
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAuthStore, useSyncStore } from '../../store/syncStore';
import { authAPI } from '../../services/api';
import { sync } from '../../services/syncEngine';

const navItems = [
  { path: '/pos', icon: ShoppingCart, label: 'POS', roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['ADMIN', 'MANAGER'] },
  { path: '/products', icon: Package, label: 'Products', roles: ['ADMIN', 'MANAGER'] },
  { path: '/sales', icon: Receipt, label: 'Sales', roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { path: '/inventory', icon: Warehouse, label: 'Inventory', roles: ['ADMIN', 'MANAGER'] },
  { path: '/reports', icon: BarChart3, label: 'Reports', roles: ['ADMIN', 'MANAGER'] },
  { path: '/users', icon: Users, label: 'Users', roles: ['ADMIN'] },
  { path: '/settings', icon: Settings, label: 'Settings', roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, clearAuth } = useAuthStore();
  const { isOnline, isSyncing, pendingCount, lastSync, syncError } = useSyncStore();
  const navigate = useNavigate();

  const visibleNav = navItems.filter(item => item.roles.includes(user?.role));

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (_) {}
    clearAuth();
    navigate('/login');
    toast.success('Logged out');
  };

  const handleManualSync = async () => {
    if (!isOnline) return toast.error('No internet connection');
    await sync();
    toast.success('Sync complete');
  };

  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div className="flex h-screen bg-surface-950 text-slate-100 overflow-hidden">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-30 w-64 bg-surface-900 border-r border-slate-800 flex flex-col transition-transform duration-300 lg:static lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">P</div>
            <span className="font-semibold text-white text-lg tracking-tight">POS System</span>
          </div>
          <button className="lg:hidden text-slate-400" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Network status */}
        <div className={clsx(
          'mx-3 mt-3 mb-1 px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-medium',
          isOnline ? 'bg-emerald-900/40 text-emerald-400' : 'bg-amber-900/40 text-amber-400'
        )}>
          {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
          {isOnline ? 'Online' : 'Offline mode'}
          {pendingCount > 0 && (
            <span className="ml-auto bg-amber-600 text-white rounded-full px-1.5 py-0.5 text-xs">
              {pendingCount}
            </span>
          )}
          {isOnline && (
            <button onClick={handleManualSync} className={clsx('ml-auto text-slate-400 hover:text-white', isSyncing && 'animate-spin')}>
              <RefreshCw size={12} />
            </button>
          )}
        </div>

        {syncError && (
          <div className="mx-3 mb-1 px-3 py-1.5 rounded bg-red-900/30 text-red-400 text-xs flex items-center gap-1">
            <AlertCircle size={11} /> Sync error
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {visibleNav.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 bg-indigo-700 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-slate-500 truncate">{user?.role}</p>
            </div>
            <button onClick={handleLogout} className="ml-auto text-slate-500 hover:text-red-400 flex-shrink-0">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <div className="flex items-center gap-3 px-4 py-3 bg-surface-900 border-b border-slate-800 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-400 hover:text-white">
            <Menu size={20} />
          </button>
          <span className="font-semibold text-white">POS System</span>
          <div className="ml-auto flex items-center gap-2">
            {isOnline ? <Wifi size={16} className="text-emerald-400" /> : <WifiOff size={16} className="text-amber-400" />}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
