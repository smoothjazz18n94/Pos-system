import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import {
  Search, Barcode, ShoppingCart, Trash2, Plus, Minus,
  CreditCard, Smartphone, Banknote, CheckCircle, Printer,
  X, ChevronRight, PackageX
} from 'lucide-react';
import clsx from 'clsx';
import { useCartStore, useAuthStore, useSyncStore } from '../store/syncStore';
import { getProducts, getCategories, enqueueSale, decrementInventoryLocal } from '../services/db';
import { saleAPI } from '../services/api';
import { updatePendingCount } from '../services/syncEngine';
import Receipt from '../components/pos/Receipt';

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'MOBILE_MONEY', label: 'Mobile Money', icon: Smartphone },
  { value: 'CARD', label: 'Card', icon: CreditCard },
];

export default function POSPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkoutMode, setCheckoutMode] = useState(false);
  const [amountPaid, setAmountPaid] = useState('');
  const [completedSale, setCompletedSale] = useState(null);
  const [processing, setProcessing] = useState(false);

  const searchRef = useRef();
  const { isOnline } = useSyncStore();
  const { user } = useAuthStore();
  const cart = useCartStore();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([getProducts(), getCategories()]);
      setProducts(prods);
      setCategories([{ id: 'all', name: 'All' }, ...cats]);
    } catch (err) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchCat = activeCategory === 'all' || p.categoryId === activeCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search);
    return matchCat && matchSearch && p.isActive !== false;
  });

  const handleBarcodeSearch = async (e) => {
    if (e.key === 'Enter' && search) {
      const product = products.find(p => p.barcode === search || p.sku === search);
      if (product) {
        cart.addItem(product);
        setSearch('');
        toast.success(`Added: ${product.name}`, { duration: 1000 });
      } else {
        toast.error('Product not found');
      }
    }
  };

  const getInventoryQty = (product) => {
    const inv = product.inventory?.find(i => i.branchId === user?.branchId);
    return inv?.quantity ?? product.inventory?.[0]?.quantity ?? Infinity;
  };

  const handleCheckout = async () => {
    if (cart.items.length === 0) return toast.error('Cart is empty');
    const total = cart.getTotal();
    const paid = parseFloat(amountPaid);
    if (cart.paymentMethod === 'CASH' && paid < total) {
      return toast.error('Amount paid is less than total');
    }

    setProcessing(true);
    const clientId = uuidv4();
    const saleData = {
      clientId,
      userId: user.id,
      branchId: user.branchId,
      items: cart.items.map(i => ({
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        taxRate: i.taxRate,
        discount: i.discount,
      })),
      paymentMethod: cart.paymentMethod,
      amountPaid: cart.paymentMethod === 'CASH' ? paid : total,
      discountAmount: cart.discount,
      notes: cart.note,
      subtotal: cart.getSubtotal(),
      taxAmount: cart.getTaxAmount(),
      total,
      changeDue: cart.paymentMethod === 'CASH' ? Math.max(0, paid - total) : 0,
      offlineCreatedAt: new Date().toISOString(),
    };

    try {
      let sale;

      if (isOnline) {
        try {
          const { data } = await saleAPI.create(saleData);
          sale = data.data;
        } catch (apiErr) {
          // Fallback to offline queue
          console.warn('Online sale failed, queuing offline:', apiErr.message);
          await enqueueSale(saleData);
          sale = { ...saleData, id: clientId, receiptNumber: `OFFLINE-${clientId.slice(0, 8).toUpperCase()}`, status: 'pending_sync' };
        }
      } else {
        // Offline: queue locally
        await enqueueSale(saleData);
        sale = { ...saleData, id: clientId, receiptNumber: `OFFLINE-${clientId.slice(0, 8).toUpperCase()}`, status: 'pending_sync' };
      }

      // Update local inventory immediately
      for (const item of cart.items) {
        await decrementInventoryLocal(item.productId, item.quantity);
      }

      // Reload products to reflect updated stock
      const updatedProducts = await getProducts();
      setProducts(updatedProducts);

      await updatePendingCount();
      setCompletedSale(sale);
      cart.clearCart();
      setCheckoutMode(false);
      setAmountPaid('');

      toast.success(isOnline ? '✓ Sale completed!' : '✓ Sale saved offline');
    } catch (err) {
      toast.error('Failed to process sale');
    } finally {
      setProcessing(false);
    }
  };

  if (completedSale) {
    return (
      <Receipt
        sale={completedSale}
        onNew={() => setCompletedSale(null)}
        user={user}
      />
    );
  }

  return (
    <div className="flex h-full bg-surface-950 overflow-hidden">
      {/* Product grid */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Search + categories */}
        <div className="p-4 bg-surface-900 border-b border-slate-800 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleBarcodeSearch}
              placeholder="Search products or scan barcode..."
              className="w-full bg-surface-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
            <Barcode size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600" />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={clsx(
                  'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                  activeCategory === cat.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array(10).fill(0).map((_, i) => (
                <div key={i} className="bg-surface-900 rounded-xl h-28 animate-pulse" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-600">
              <PackageX size={40} className="mb-2" />
              <p>No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map(product => {
                const qty = getInventoryQty(product);
                const inCart = cart.items.find(i => i.productId === product.id)?.quantity || 0;
                const outOfStock = qty === 0;

                return (
                  <button
                    key={product.id}
                    onClick={() => !outOfStock && cart.addItem(product)}
                    disabled={outOfStock}
                    className={clsx(
                      'bg-surface-900 border rounded-xl p-3 text-left transition-all active:scale-95',
                      outOfStock
                        ? 'border-slate-800 opacity-50 cursor-not-allowed'
                        : 'border-slate-800 hover:border-indigo-500 hover:bg-slate-800',
                      inCart > 0 && 'border-indigo-500 bg-indigo-950/30'
                    )}
                  >
                    <div className="aspect-square bg-slate-800 rounded-lg mb-2 flex items-center justify-center text-2xl">
                      {product.category?.icon || '📦'}
                    </div>
                    <p className="text-xs font-medium text-white leading-tight line-clamp-2 mb-1">{product.name}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-indigo-400 font-semibold text-sm">
                        ₵{Number(product.price).toFixed(2)}
                      </span>
                      {inCart > 0 && (
                        <span className="bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                          {inCart}
                        </span>
                      )}
                    </div>
                    {qty !== Infinity && qty <= 10 && (
                      <p className="text-xs text-amber-500 mt-0.5">{qty} left</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart panel */}
      <div className="w-80 xl:w-96 bg-surface-900 border-l border-slate-800 flex flex-col flex-shrink-0">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-indigo-400" />
            <h2 className="font-semibold text-white text-sm">Cart</h2>
          </div>
          <span className="text-xs text-slate-500">{cart.getItemCount()} items</span>
          {cart.items.length > 0 && (
            <button onClick={cart.clearCart} className="text-slate-600 hover:text-red-400 ml-2">
              <Trash2 size={14} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-700">
              <ShoppingCart size={28} className="mb-1" />
              <p className="text-sm">Cart is empty</p>
            </div>
          ) : (
            cart.items.map(item => (
              <CartItem key={item.productId} item={item} cart={cart} />
            ))
          )}
        </div>

        {/* Totals */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span>₵{cart.getSubtotal().toFixed(2)}</span>
            </div>
            {cart.getTaxAmount() > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Tax</span>
                <span>₵{cart.getTaxAmount().toFixed(2)}</span>
              </div>
            )}
            {cart.discount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discount</span>
                <span>-₵{cart.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-white font-bold text-base pt-1 border-t border-slate-800">
              <span>Total</span>
              <span>₵{cart.getTotal().toFixed(2)}</span>
            </div>
          </div>

          {!checkoutMode ? (
            <button
              onClick={() => setCheckoutMode(true)}
              disabled={cart.items.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              Checkout <ChevronRight size={16} />
            </button>
          ) : (
            <CheckoutPanel
              cart={cart}
              amountPaid={amountPaid}
              setAmountPaid={setAmountPaid}
              onConfirm={handleCheckout}
              onCancel={() => { setCheckoutMode(false); setAmountPaid(''); }}
              processing={processing}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CartItem({ item, cart }) {
  return (
    <div className="bg-surface-950 rounded-xl p-3 flex gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white truncate">{item.productName}</p>
        <p className="text-xs text-slate-500 mt-0.5">₵{item.unitPrice.toFixed(2)} each</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => cart.updateQuantity(item.productId, item.quantity - 1)}
          className="w-6 h-6 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center text-slate-400">
          <Minus size={10} />
        </button>
        <span className="text-white text-sm w-6 text-center font-medium">{item.quantity}</span>
        <button onClick={() => cart.updateQuantity(item.productId, item.quantity + 1)}
          className="w-6 h-6 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center text-slate-400">
          <Plus size={10} />
        </button>
        <span className="text-white text-sm w-14 text-right font-semibold">
          ₵{item.subtotal.toFixed(2)}
        </span>
        <button onClick={() => cart.removeItem(item.productId)} className="text-slate-700 hover:text-red-400">
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

function CheckoutPanel({ cart, amountPaid, setAmountPaid, onConfirm, onCancel, processing }) {
  const total = cart.getTotal();
  const change = Math.max(0, parseFloat(amountPaid || 0) - total);

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => cart.setPaymentMethod(value)}
            className={clsx(
              'flex-1 py-2 rounded-lg text-xs font-medium flex flex-col items-center gap-1 transition-colors',
              cart.paymentMethod === value
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            )}
          >
            <Icon size={14} />
            {label.split(' ')[0]}
          </button>
        ))}
      </div>

      {cart.paymentMethod === 'CASH' && (
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Amount paid (₵)</label>
          <input
            type="number"
            value={amountPaid}
            onChange={e => setAmountPaid(e.target.value)}
            placeholder={total.toFixed(2)}
            className="w-full bg-surface-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-center text-lg font-mono focus:outline-none focus:border-indigo-500"
            autoFocus
          />
          {parseFloat(amountPaid) > 0 && (
            <div className="flex justify-between text-sm mt-1.5 px-1">
              <span className="text-slate-500">Change</span>
              <span className={clsx('font-semibold', change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                ₵{change.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={processing || (cart.paymentMethod === 'CASH' && parseFloat(amountPaid || 0) < total)}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold flex items-center justify-center gap-1.5"
        >
          {processing ? (
            <span className="animate-spin">↻</span>
          ) : (
            <><CheckCircle size={15} /> Confirm</>
          )}
        </button>
      </div>
    </div>
  );
}
