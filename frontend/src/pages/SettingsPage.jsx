// SettingsPage.jsx
import React, { useState } from 'react';
import { useSyncStore, useAuthStore } from '../store/syncStore';
import { sync, updatePendingCount } from '../services/syncEngine';
import { getAllQueuedSales } from '../services/db';
import toast from 'react-hot-toast';
import { RefreshCw, Wifi, WifiOff, Database, Shield, Info } from 'lucide-react';

export default function SettingsPage() {
  const { isOnline, isSyncing, pendingCount, lastSync, syncError } = useSyncStore();
  const { user } = useAuthStore();
  const [clearing, setClearing] = useState(false);

  const handleManualSync = async () => {
    if (!isOnline) return toast.error('No internet connection');
    await sync();
    toast.success('Sync completed');
  };

  const handleClearOfflineQueue = async () => {
    if (!confirm('Clear all failed/pending sync entries? This cannot be undone.')) return;
    setClearing(true);
    try {
      const db = (await import('../services/db')).getDB ? await (await import('../services/db')).getDB() : null;
      if (db) {
        const tx = db.transaction('offlineSalesQueue', 'readwrite');
        await tx.store.clear();
        await tx.done;
      }
      await updatePendingCount();
      toast.success('Offline queue cleared');
    } catch { toast.error('Failed to clear queue'); }
    finally { setClearing(false); }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-500 text-sm">System configuration and sync status</p>
      </div>

      {/* Network Status */}
      <section className="bg-surface-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          {isOnline ? <Wifi size={16} className="text-emerald-400" /> : <WifiOff size={16} className="text-amber-400" />}
          Network & Sync
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Connection</span>
            <span className={isOnline ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Pending Sync</span>
            <span className={pendingCount > 0 ? 'text-amber-400 font-medium' : 'text-slate-300'}>
              {pendingCount} items
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Last Synced</span>
            <span className="text-slate-300">
              {lastSync ? new Date(lastSync).toLocaleTimeString() : 'Never'}
            </span>
          </div>
          {syncError && (
            <div className="py-2 border-b border-slate-800">
              <p className="text-slate-400 mb-1">Last Sync Error</p>
              <p className="text-red-400 text-xs font-mono bg-red-900/20 px-2 py-1 rounded">{syncError}</p>
            </div>
          )}
        </div>
        <div className="flex gap-3 pt-1">
          <button
            onClick={handleManualSync}
            disabled={!isOnline || isSyncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
          {pendingCount > 0 && (
            <button
              onClick={handleClearOfflineQueue}
              disabled={clearing}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-xl text-sm font-medium border border-red-800/40"
            >
              <Database size={14} />
              Clear Queue
            </button>
          )}
        </div>
      </section>

      {/* Account info */}
      <section className="bg-surface-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 className="font-semibold text-white flex items-center gap-2"><Shield size={16} className="text-indigo-400" /> Account</h2>
        <div className="space-y-2 text-sm">
          {[
            ['Name', `${user?.firstName} ${user?.lastName}`],
            ['Email', user?.email],
            ['Role', user?.role],
            ['Device ID', localStorage.getItem('deviceId')?.slice(0, 20) + '...'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between py-2 border-b border-slate-800 last:border-0">
              <span className="text-slate-400">{label}</span>
              <span className="text-slate-300 font-mono text-xs">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="bg-surface-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="font-semibold text-white flex items-center gap-2 mb-3"><Info size={16} className="text-slate-400" /> About</h2>
        <div className="text-sm text-slate-500 space-y-1">
          <p>POS System v1.0.0</p>
          <p>Offline-first · PWA · Multi-branch</p>
          <p className="text-xs font-mono text-slate-600 mt-2">React + Vite · Node.js · PostgreSQL · IndexedDB</p>
        </div>
      </section>
    </div>
  );
}
