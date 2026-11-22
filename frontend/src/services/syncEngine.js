import { v4 as uuidv4 } from 'uuid';
import {
  getPendingSales, markSaleSynced, markSaleError,
  getPendingOperations, markOperationSynced,
  saveProducts, saveCategories, saveInventory, saveSales,
  setMeta, getMeta,
} from './db';
import { syncAPI, productAPI, categoryAPI, inventoryAPI, saleAPI } from './api';
import { useSyncStore } from '../store/syncStore';

const SYNC_INTERVAL = 30 * 1000; // 30s
const BATCH_SIZE = 50;
let syncTimer = null;
let isSyncing = false;
let onlineSyncHandler = null;

// Initialise device ID (persisted per device)
export const getDeviceId = () => {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = `device-${uuidv4()}`;
    localStorage.setItem('deviceId', id);
  }
  return id;
};

// Check network status
export const isOnline = () => navigator.onLine;

/**
 * MAIN SYNC FUNCTION
 * 1. Collect all pending offline operations
 * 2. Send to server in batches
 * 3. Pull server delta to reconcile local cache
 * 4. Update sync status in UI store
 */
export const sync = async () => {
  if (isSyncing || !isOnline()) return;

  isSyncing = true;
  const { setSyncing, setSyncError, setLastSync, setPendingCount } = useSyncStore.getState();
  setSyncing(true);

  try {
    const deviceId = getDeviceId();

    // ── Step 1: Collect pending operations ──────────────────────────────────
    const pendingSales = await getPendingSales();
    const pendingOps = await getPendingOperations();

    const allOps = [
      ...pendingSales.map(sale => ({
        entity: 'sale',
        operation: 'create',
        clientId: sale.clientId,
        timestamp: sale.createdAt,
        deviceId,
        data: sale,
      })),
      ...pendingOps.map(op => ({
        ...op,
        deviceId,
      })),
    ];

    // ── Step 2: Push in batches ──────────────────────────────────────────────
    if (allOps.length > 0) {
      for (let i = 0; i < allOps.length; i += BATCH_SIZE) {
        const batch = allOps.slice(i, i + BATCH_SIZE);

        try {
          const { data } = await syncAPI.batch(batch);
          const result = data.data;

          // Mark successful syncs
          for (const op of batch) {
            const hasError = result.errors?.find(e => e.clientId === op.clientId);
            if (!hasError) {
              if (op.entity === 'sale') {
                await markSaleSynced(op.clientId);
              } else {
                await markOperationSynced(op.clientId);
              }
            } else {
              if (op.entity === 'sale') {
                await markSaleError(op.clientId, hasError.error);
              }
            }
          }

          console.log(`[Sync] Batch ${i / BATCH_SIZE + 1}: ${result.processed} processed, ${result.skipped} skipped, ${result.errors?.length} errors`);
        } catch (batchError) {
          console.error('[Sync] Batch failed:', batchError.message);
          // Non-fatal — continue with next batch
        }
      }
    }

    // ── Step 3: Pull server delta ────────────────────────────────────────────
    const lastSync = await getMeta('lastSync');
    const { data: deltaRes } = await syncAPI.delta(lastSync);
    const { products, categories, inventory, sales, serverTime } = deltaRes.data;

    if (products?.length) await saveProducts(products);
    if (categories?.length) await saveCategories(categories);
    if (inventory?.length) await saveInventory(inventory);
    if (sales?.length) await saveSales(sales);

    // ── Step 4: Update meta ──────────────────────────────────────────────────
    await setMeta('lastSync', serverTime);

    const remaining = await getPendingSales();
    setPendingCount(remaining.length);
    setLastSync(new Date().toISOString());
    setSyncError(null);

    console.log(`[Sync] Complete — server time: ${serverTime}`);

  } catch (error) {
    console.error('[Sync] Failed:', error.message);
    setSyncError(error.message);
  } finally {
    isSyncing = false;
    useSyncStore.getState().setSyncing(false);
  }
};

/**
 * INITIAL DATA LOAD
 * Load products/categories on first boot (or stale cache)
 */
export const initialDataSync = async () => {
  if (!isOnline()) return;

  try {
    const [productsRes, categoriesRes, inventoryRes] = await Promise.all([
      productAPI.list({ limit: 500 }),
      categoryAPI.list(),
      inventoryAPI.list(),
    ]);

    await saveProducts(productsRes.data.data);
    await saveCategories(categoriesRes.data.data);
    await saveInventory(inventoryRes.data.data);

    await setMeta('lastFullSync', new Date().toISOString());
    console.log('[Sync] Initial data loaded');
  } catch (error) {
    console.warn('[Sync] Initial load failed — using cached data:', error.message);
  }
};

// ── Auto-sync scheduler ────────────────────────────────────────────────────

export const startAutoSync = () => {
  stopAutoSync();

  const runSync = async () => {
    await sync();
    syncTimer = setTimeout(runSync, SYNC_INTERVAL);
  };

  // Keep exactly one network-restored listener for the authenticated session.
  onlineSyncHandler = () => {
    console.log('[Sync] Back online — syncing now');
    sync();
  };
  window.addEventListener('online', onlineSyncHandler);

  // The loop also schedules the next attempt when currently offline.
  runSync();
};

export const stopAutoSync = () => {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  if (onlineSyncHandler) {
    window.removeEventListener('online', onlineSyncHandler);
    onlineSyncHandler = null;
  }
};

// ── Pending count helper ─────────────────────────────────────────────────────

export const updatePendingCount = async () => {
  const pending = await getPendingSales();
  useSyncStore.getState().setPendingCount(pending.length);
};
