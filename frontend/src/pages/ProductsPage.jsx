import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package, X, Save } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { productAPI, categoryAPI } from '../services/api';
import { saveProducts, saveCategories } from '../services/db';
import { useSyncStore } from '../store/syncStore';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [selected, setSelected] = useState(null);
  const { isOnline } = useSyncStore();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([productAPI.list({ limit: 500 }), categoryAPI.list()]);
      setProducts(p.data.data);
      setCategories(c.data.data);
      await saveProducts(p.data.data);
      await saveCategories(c.data.data);
    } catch (err) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.includes(search)
  );

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this product?')) return;
    try {
      await productAPI.delete(id);
      setProducts(ps => ps.map(p => p.id === id ? { ...p, isActive: false } : p));
      toast.success('Product deactivated');
    } catch { toast.error('Failed to deactivate product'); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-slate-500 text-sm">{products.filter(p => p.isActive).length} active products</p>
        </div>
        {isOnline && (
          <button
            onClick={() => { setSelected(null); setModal('add'); }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors"
          >
            <Plus size={16} /> Add Product
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or SKU..."
          className="w-full bg-surface-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Table */}
      <div className="bg-surface-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Product</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden sm:table-cell">Category</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Price</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium hidden md:table-cell">Cost</th>
                <th className="text-center px-4 py-3 text-slate-500 font-medium hidden lg:table-cell">Tax</th>
                <th className="text-center px-4 py-3 text-slate-500 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-800 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.map(product => (
                <tr key={product.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-sm flex-shrink-0">
                        {product.category?.icon || '📦'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">{product.name}</p>
                        <p className="text-slate-600 text-xs">{product.sku || product.barcode || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">
                    {product.category?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-white text-right font-medium">
                    ₵{Number(product.price).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-right hidden md:table-cell">
                    {product.costPrice ? `₵${Number(product.costPrice).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-center hidden lg:table-cell">
                    {Number(product.taxRate || 0)}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      product.isActive ? 'bg-emerald-900/40 text-emerald-400' : 'bg-slate-800 text-slate-500'
                    )}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setSelected(product); setModal('edit'); }}
                        className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-900/30 rounded-lg transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <ProductModal
          product={selected}
          categories={categories}
          onClose={() => { setModal(null); setSelected(null); }}
          onSave={async (data) => {
            try {
              if (modal === 'add') {
                const res = await productAPI.create(data);
                setProducts(ps => [res.data.data, ...ps]);
                toast.success('Product created');
              } else {
                const res = await productAPI.update(selected.id, data);
                setProducts(ps => ps.map(p => p.id === selected.id ? res.data.data : p));
                toast.success('Product updated');
              }
              setModal(null);
              setSelected(null);
              await loadData(); // refresh to update IndexedDB
            } catch (err) {
              toast.error(err.response?.data?.message || 'Failed to save product');
            }
          }}
        />
      )}
    </div>
  );
}

function ProductModal({ product, categories, onClose, onSave }) {
  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    barcode: product?.barcode || '',
    price: product?.price || '',
    costPrice: product?.costPrice || '',
    taxRate: product?.taxRate || 0,
    categoryId: product?.categoryId || '',
    description: product?.description || '',
    initialQuantity: '',
    lowStockAlert: 10,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-lg bg-surface-900 rounded-2xl border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-white">{product ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Product Name *" required>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className={inputClass} />
            </Field>
            <Field label="Category">
              <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} className={inputClass}>
                <option value="">No category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="SKU">
              <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} className={inputClass} placeholder="e.g. BEV-001" />
            </Field>
            <Field label="Barcode">
              <input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} className={inputClass} />
            </Field>
            <Field label="Selling Price (₵) *">
              <input type="number" step="0.01" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required className={inputClass} />
            </Field>
            <Field label="Cost Price (₵)">
              <input type="number" step="0.01" min="0" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} className={inputClass} />
            </Field>
            <Field label="Tax Rate (%)">
              <input type="number" step="0.01" min="0" max="100" value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: e.target.value }))} className={inputClass} />
            </Field>
            {!product && (
              <Field label="Initial Quantity">
                <input type="number" min="0" value={form.initialQuantity} onChange={e => setForm(f => ({ ...f, initialQuantity: e.target.value }))} className={inputClass} placeholder="0" />
              </Field>
            )}
          </div>

          <Field label="Description">
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className={inputClass + ' resize-none'} />
          </Field>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-medium">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
              <Save size={14} /> {saving ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass = 'w-full bg-surface-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600';
const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
    {children}
  </div>
);
