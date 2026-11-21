import { openDB } from 'idb';

const DB_NAME = 'pos-offline-db';
const DB_VERSION = 1;

let dbInstance = null;

export const getDB = async () => {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Products store
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('barcode', 'barcode');
        productStore.createIndex('sku', 'sku');
        productStore.createIndex('categoryId', 'categoryId');
        productStore.createIndex('name', 'name');
      }

      // Categories store
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }

      // Offline sales queue - unsynced sales waiting to push
      if (!db.objectStoreNames.contains('offlineSalesQueue')) {
        const queueStore = db.createObjectStore('offlineSalesQueue', { keyPath: 'clientId' });
        queueStore.createIndex('status', 'status');
        queueStore.createIndex('createdAt', 'createdAt');
      }

      // Synced sales cache
      if (!db.objectStoreNames.contains('sales')) {
        const saleStore = db.createObjectStore('sales', { keyPath: 'id' });
        saleStore.createIndex('createdAt', 'createdAt');
        saleStore.createIndex('receiptNumber', 'receiptNumber');
      }

      // Inventory store
      if (!db.objectStoreNames.contains('inventory')) {
        const invStore = db.createObjectStore('inventory', { keyPath: 'id' });
        invStore.createIndex('productId', 'productId');
      }

      // Sync operations queue (generic)
      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'clientId' });
        syncStore.createIndex('status', 'status');
        syncStore.createIndex('entity', 'entity');
      }

      // App metadata
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    },
  });

  return dbInstance;
};

// ─── Products ────────────────────────────────────────────────────────────────

export const saveProducts = async (products) => {
  const db = await getDB();
  const tx = db.transaction('products', 'readwrite');
  await Promise.all([
    ...products.map(p => tx.store.put(p)),
    tx.done,
  ]);
};

export const getProducts = async (search = '') => {
  const db = await getDB();
  const all = await db.getAll('products');
  if (!search) return all.filter(p => p.isActive !== false);

  const q = search.toLowerCase();
  return all.filter(p =>
    p.isActive !== false && (
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.barcode?.includes(q)
    )
  );
};

export const getProductByBarcode = async (barcode) => {
  const db = await getDB();
  return db.getFromIndex('products', 'barcode', barcode);
};

export const saveProduct = async (product) => {
  const db = await getDB();
  await db.put('products', product);
};

// ─── Categories ──────────────────────────────────────────────────────────────

export const saveCategories = async (categories) => {
  const db = await getDB();
  const tx = db.transaction('categories', 'readwrite');
  await Promise.all([
    ...categories.map(c => tx.store.put(c)),
    tx.done,
  ]);
};

export const getCategories = async () => {
  const db = await getDB();
  return db.getAll('categories');
};

// ─── Inventory ───────────────────────────────────────────────────────────────

export const saveInventory = async (inventory) => {
  const db = await getDB();
  const tx = db.transaction('inventory', 'readwrite');
  await Promise.all([...inventory.map(i => tx.store.put(i)), tx.done]);
};

export const getInventoryForProduct = async (productId) => {
  const db = await getDB();
  const items = await db.getAllFromIndex('inventory', 'productId', productId);
  return items[0] || null;
};

export const decrementInventoryLocal = async (productId, quantity) => {
  const db = await getDB();
  const tx = db.transaction('inventory', 'readwrite');
  const items = await tx.store.index('productId').getAll(productId);
  if (items[0]) {
    const updated = { ...items[0], quantity: Math.max(0, items[0].quantity - quantity) };
    await tx.store.put(updated);
  }
  await tx.done;
};

// ─── Offline Sales Queue ─────────────────────────────────────────────────────

export const enqueueSale = async (sale) => {
  const db = await getDB();
  const entry = {
    ...sale,
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
    lastAttempt: null,
  };
  await db.put('offlineSalesQueue', entry);
  return entry;
};

export const getPendingSales = async () => {
  const db = await getDB();
  const all = await db.getAllFromIndex('offlineSalesQueue', 'status', 'pending');
  return all.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

export const markSaleSynced = async (clientId) => {
  const db = await getDB();
  const entry = await db.get('offlineSalesQueue', clientId);
  if (entry) {
    await db.put('offlineSalesQueue', { ...entry, status: 'synced', syncedAt: new Date().toISOString() });
  }
};

export const markSaleError = async (clientId, error) => {
  const db = await getDB();
  const entry = await db.get('offlineSalesQueue', clientId);
  if (entry) {
    await db.put('offlineSalesQueue', {
      ...entry,
      status: entry.attempts >= 3 ? 'failed' : 'pending',
      attempts: (entry.attempts || 0) + 1,
      lastError: error,
      lastAttempt: new Date().toISOString(),
    });
  }
};

export const getAllQueuedSales = async () => {
  const db = await getDB();
  return db.getAll('offlineSalesQueue');
};

// ─── Sales Cache ─────────────────────────────────────────────────────────────

export const saveSales = async (sales) => {
  const db = await getDB();
  const tx = db.transaction('sales', 'readwrite');
  await Promise.all([...sales.map(s => tx.store.put(s)), tx.done]);
};

export const getSalesCache = async () => {
  const db = await getDB();
  return db.getAll('sales');
};

// ─── Generic Sync Queue ───────────────────────────────────────────────────────

export const enqueueOperation = async (operation) => {
  const db = await getDB();
  await db.put('syncQueue', { ...operation, status: 'pending', createdAt: new Date().toISOString() });
};

export const getPendingOperations = async () => {
  const db = await getDB();
  return db.getAllFromIndex('syncQueue', 'status', 'pending');
};

export const markOperationSynced = async (clientId) => {
  const db = await getDB();
  const op = await db.get('syncQueue', clientId);
  if (op) await db.put('syncQueue', { ...op, status: 'synced' });
};

// ─── Meta / Last sync ────────────────────────────────────────────────────────

export const setMeta = async (key, value) => {
  const db = await getDB();
  await db.put('meta', { key, value, updatedAt: new Date().toISOString() });
};

export const getMeta = async (key) => {
  const db = await getDB();
  const item = await db.get('meta', key);
  return item?.value;
};
