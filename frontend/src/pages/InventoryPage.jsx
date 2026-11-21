import React, { useState, useEffect } from 'react';
import { AlertTriangle, Package, RefreshCw, Plus, Minus, Edit2 } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { inventoryAPI } from '../services/api';

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | low | out
  const [adjustModal, setAdjustModal] = useState(null);

  useEffect(() => { loadInventory(); }, []);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const { data } = await inventoryAPI.list();
      setInventory(data.data);
    } catch { toast.error('Failed to load inventory'); }
    finally { setLoading(false); }
  };

  const filtered = inventory.filter(item => {
    if (filter === 'low') return item.quantity <= item.lowStockAlert && item.quantity > 0;
    if (filter === 'out') return item.quantity === 0;
    return true;
  });

  const stats = {
    total: inventory.length,
    low: inventory.filter(i => i.quantity > 0 && i.quantity <= i.lowStockAlert).length,
    out: inventory.filter(i => i.quantity === 0).length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Inventory</h1>
          <p className="text-slate-500 text-sm">{stats.total} products tracked</p>
        </div>
        <button onClick={loadInventory} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white bg-slate-800 px-3 py-2 rounded-lg">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Products', value: stats.total, cls: 'text-white', bg: 'bg-surface-900' },
          { label: 'Low Stock', value: stats.low, cls: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-800/50' },
          { label: 'Out of Stock', value: stats.out, cls: 'text-red-400', bg: 'bg-red-900/20 border-red-800/50' },
        ].map(({ label, value, cls, bg }) => (
          <div key={label} className={clsx('rounded-2xl p-5 border border-slate-800', bg)}>
            <p className={clsx('text-2xl font-bold', cls)}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-1 bg-surface-900 p-1 rounded-xl w-fit border border-slate-800">
        {[
          { value: 'all', label: 'All' },
          { value: 'low', label: `Low Stock (${stats.low})` },
          { value: 'out', label: `Out of Stock (${stats.out})` },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              filter === value ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Product</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden lg:table-cell">Branch</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Qty</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium hidden md:table-cell">Alert At</th>
                <th className="text-center px-4 py-3 text-slate-500 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>{[...Array(6)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                  ))}</tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-600">
                    <Package size={28} className="mx-auto mb-2" />
                    No items match this filter
                  </td>
                </tr>
              ) : filtered.map(item => {
                const isOut = item.quantity === 0;
                const isLow = item.quantity <= item.lowStockAlert && !isOut;

                return (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-sm">
                          {item.product?.category?.icon || '📦'}
                        </div>
                        <div>
                          <p className="text-white font-medium">{item.product?.name}</p>
                          <p className="text-slate-600 text-xs">{item.product?.sku || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                      {item.product?.category?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">
                      {item.branch?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={clsx('font-bold text-base', isOut ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-white')}>
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-right hidden md:table-cell">
                      {item.lowStockAlert}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isOut ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/30 text-red-400">Out of stock</span>
                      ) : isLow ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-900/30 text-amber-400 flex items-center gap-1 justify-center w-fit mx-auto">
                          <AlertTriangle size={10} /> Low
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-900/30 text-emerald-400">In Stock</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setAdjustModal(item)}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-400 hover:bg-indigo-900/20 px-2 py-1.5 rounded-lg transition-colors"
                      >
                        <Edit2 size={12} /> Adjust
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust modal */}
      {adjustModal && (
        <AdjustModal
          item={adjustModal}
          onClose={() => setAdjustModal(null)}
          onSave={async ({ delta, reason }) => {
            try {
              await inventoryAPI.adjust({
                productId: adjustModal.productId,
                branchId: adjustModal.branchId,
                delta,
                reason,
              });
              setInventory(inv => inv.map(i =>
                i.id === adjustModal.id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
              ));
              toast.success('Stock adjusted');
              setAdjustModal(null);
            } catch { toast.error('Failed to adjust stock'); }
          }}
        />
      )}
    </div>
  );
}

function AdjustModal({ item, onClose, onSave }) {
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-sm bg-surface-900 rounded-2xl border border-slate-700 shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-white">Adjust Stock</h2>
          <p className="text-sm text-slate-500">{item.product?.name} · Current: {item.quantity}</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Adjustment (use negative to reduce)</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setDelta(d => d - 1)} className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center text-white">
                <Minus size={16} />
              </button>
              <input
                type="number"
                value={delta}
                onChange={e => setDelta(parseInt(e.target.value) || 0)}
                className="flex-1 bg-surface-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-center text-lg font-mono focus:outline-none focus:border-indigo-500"
              />
              <button onClick={() => setDelta(d => d + 1)} className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center text-white">
                <Plus size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">New quantity: {Math.max(0, item.quantity + delta)}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Reason</label>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Stock count, received delivery..."
              className="w-full bg-surface-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium">Cancel</button>
            <button
              onClick={() => onSave({ delta, reason })}
              disabled={delta === 0}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-40"
            >
              Save Adjustment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
