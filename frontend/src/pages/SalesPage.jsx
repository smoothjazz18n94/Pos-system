import React, { useState, useEffect } from 'react';
import { Search, Eye, Receipt, WifiOff, Clock, CheckCircle, AlertCircle, Ban } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { saleAPI } from '../services/api';
import { getAllQueuedSales } from '../services/db';
import { useSyncStore } from '../store/syncStore';

const STATUS_CONFIG = {
  COMPLETED: { label: 'Completed', icon: CheckCircle, cls: 'text-emerald-400 bg-emerald-900/30' },
  PENDING: { label: 'Pending', icon: Clock, cls: 'text-amber-400 bg-amber-900/30' },
  VOID: { label: 'Voided', icon: Ban, cls: 'text-slate-400 bg-slate-800' },
  REFUNDED: { label: 'Refunded', icon: AlertCircle, cls: 'text-red-400 bg-red-900/30' },
  pending_sync: { label: 'Pending Sync', icon: WifiOff, cls: 'text-amber-400 bg-amber-900/30' },
  synced: { label: 'Synced', icon: CheckCircle, cls: 'text-emerald-400 bg-emerald-900/30' },
  failed: { label: 'Sync Failed', icon: AlertCircle, cls: 'text-red-400 bg-red-900/30' },
};

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('online'); // 'online' | 'offline'
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { isOnline } = useSyncStore();

  useEffect(() => { loadSales(); }, [page]);
  useEffect(() => { loadOfflineQueue(); }, []);

  const loadSales = async () => {
    if (!isOnline) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await saleAPI.list({ page, limit: 20 });
      setSales(data.sales || []);
      setTotalPages(data.totalPages || 1);
    } catch { toast.error('Failed to load sales'); }
    finally { setLoading(false); }
  };

  const loadOfflineQueue = async () => {
    const queue = await getAllQueuedSales();
    setOfflineQueue(queue.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  };

  const handleVoid = async (id) => {
    if (!confirm('Void this sale? Stock will be restored.')) return;
    try {
      await saleAPI.void(id);
      setSales(ss => ss.map(s => s.id === id ? { ...s, status: 'VOID' } : s));
      toast.success('Sale voided');
    } catch { toast.error('Failed to void sale'); }
  };

  const displaySales = tab === 'online' ? sales : offlineQueue;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales History</h1>
          <p className="text-slate-500 text-sm">{isOnline ? 'Live data' : 'Showing cached data'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-surface-900 p-1 rounded-xl w-fit border border-slate-800">
        <button
          onClick={() => setTab('online')}
          className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            tab === 'online' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}
        >
          Synced Sales
        </button>
        <button
          onClick={() => setTab('offline')}
          className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
            tab === 'offline' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}
        >
          Offline Queue
          {offlineQueue.filter(s => s.status === 'pending').length > 0 && (
            <span className="bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {offlineQueue.filter(s => s.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by receipt number..."
          className="w-full bg-surface-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="bg-surface-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Receipt</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden sm:table-cell">Date</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden md:table-cell">Cashier</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden lg:table-cell">Payment</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Total</th>
                <th className="text-center px-4 py-3 text-slate-500 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : displaySales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-600">
                    <Receipt size={28} className="mx-auto mb-2" />
                    No sales found
                  </td>
                </tr>
              ) : displaySales
                  .filter(s => !search || (s.receiptNumber || s.clientId || '').toLowerCase().includes(search.toLowerCase()))
                  .map(sale => {
                    const statusKey = sale.status || 'COMPLETED';
                    const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.COMPLETED;
                    const StatusIcon = cfg.icon;
                    const isOfflineSale = !sale.id || sale.status === 'pending_sync' || sale.status === 'synced' || sale.status === 'failed';

                    return (
                      <tr key={sale.id || sale.clientId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isOfflineSale && <WifiOff size={11} className="text-amber-500 flex-shrink-0" />}
                            <span className="font-mono text-xs text-slate-300">
                              {sale.receiptNumber || sale.clientId?.slice(0, 12) + '...'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400 hidden sm:table-cell text-xs">
                          {sale.createdAt ? format(new Date(sale.createdAt), 'dd MMM yyyy HH:mm') :
                           sale.offlineCreatedAt ? format(new Date(sale.offlineCreatedAt), 'dd MMM yyyy HH:mm') : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                          {sale.user ? `${sale.user.firstName} ${sale.user.lastName}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">
                          {sale.paymentMethod?.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-3 text-white font-semibold text-right">
                          ₵{Number(sale.total).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', cfg.cls)}>
                            <StatusIcon size={10} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {!isOfflineSale && sale.status === 'COMPLETED' && (
                            <button
                              onClick={() => handleVoid(sale.id)}
                              className="text-xs text-slate-600 hover:text-red-400 transition-colors"
                            >
                              Void
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {tab === 'online' && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-sm text-slate-400 hover:text-white disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-sm text-slate-400 hover:text-white disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
