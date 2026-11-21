import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Auth Store ───────────────────────────────────────────────────────────────
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: ({ user, accessToken, refreshToken }) => {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        if (user.branchId) localStorage.setItem('branchId', user.branchId);
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },

      clearAuth: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('branchId');
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      updateUser: (updates) => set(state => ({ user: { ...state.user, ...updates } })),
    }),
    {
      name: 'pos-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

// ─── Cart Store ───────────────────────────────────────────────────────────────
export const useCartStore = create((set, get) => ({
  items: [],
  discount: 0,
  paymentMethod: 'CASH',
  note: '',

  addItem: (product) => {
    const { items } = get();
    const existing = items.find(i => i.productId === product.id);

    if (existing) {
      set({ items: items.map(i =>
        i.productId === product.id
          ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitPrice }
          : i
      )});
    } else {
      set({ items: [...items, {
        productId: product.id,
        productName: product.name,
        unitPrice: Number(product.price),
        quantity: 1,
        taxRate: Number(product.taxRate || 0),
        discount: 0,
        subtotal: Number(product.price),
        barcode: product.barcode,
        sku: product.sku,
        inventory: product.inventory,
      }]});
    }
  },

  removeItem: (productId) => {
    set(state => ({ items: state.items.filter(i => i.productId !== productId) }));
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    set(state => ({
      items: state.items.map(i =>
        i.productId === productId
          ? { ...i, quantity, subtotal: quantity * i.unitPrice }
          : i
      ),
    }));
  },

  updateDiscount: (productId, discount) => {
    set(state => ({
      items: state.items.map(i =>
        i.productId === productId
          ? { ...i, discount, subtotal: (i.quantity * i.unitPrice) - discount }
          : i
      ),
    }));
  },

  setCartDiscount: (discount) => set({ discount }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  setNote: (note) => set({ note }),

  clearCart: () => set({ items: [], discount: 0, paymentMethod: 'CASH', note: '' }),

  // Computed totals
  getSubtotal: () => {
    const { items } = get();
    return items.reduce((sum, i) => sum + i.subtotal, 0);
  },

  getTaxAmount: () => {
    const { items } = get();
    return items.reduce((sum, i) => {
      const base = i.quantity * i.unitPrice - i.discount;
      return sum + base * (i.taxRate / 100);
    }, 0);
  },

  getTotal: () => {
    const { getSubtotal, getTaxAmount, discount } = get();
    return Math.max(0, getSubtotal() + getTaxAmount() - discount);
  },

  getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}));

// ─── Sync Store ───────────────────────────────────────────────────────────────
export const useSyncStore = create((set) => ({
  isSyncing: false,
  pendingCount: 0,
  lastSync: null,
  syncError: null,
  isOnline: navigator.onLine,

  setSyncing: (v) => set({ isSyncing: v }),
  setPendingCount: (n) => set({ pendingCount: n }),
  setLastSync: (t) => set({ lastSync: t }),
  setSyncError: (e) => set({ syncError: e }),
  setOnline: (v) => set({ isOnline: v }),
}));

// ─── UI Store ─────────────────────────────────────────────────────────────────
export const useUIStore = create((set) => ({
  sidebarOpen: false,
  currentModal: null,
  modalData: null,

  toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
  openModal: (modal, data = null) => set({ currentModal: modal, modalData: data }),
  closeModal: () => set({ currentModal: null, modalData: null }),
}));
