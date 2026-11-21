const { prisma } = require('../config/database');
const { createSale } = require('./sale.service');
const logger = require('../utils/logger');

/**
 * SYNC ENGINE
 *
 * Strategy: Last-Write-Wins with clientId-based deduplication.
 * Each offline operation has a unique clientId and a timestamp.
 * On sync, we process in chronological order and skip duplicates.
 *
 * Conflict resolution:
 * - Sales: deduplicated by clientId — never created twice
 * - Products: version vector — server wins if server version > client version
 * - Inventory: incremental deltas — sum of changes applied, not overwrite
 */

const processSyncBatch = async (operations, userId, branchId) => {
  const results = {
    processed: 0,
    skipped: 0,
    errors: [],
    conflicts: [],
  };

  // Sort by timestamp so earlier ops apply first
  const sorted = [...operations].sort((a, b) => {
    const ta = new Date(a.timestamp || 0);
    const tb = new Date(b.timestamp || 0);
    return ta - tb;
  });

  for (const op of sorted) {
    try {
      const result = await processSingleOperation(op, userId, branchId);
      if (result.skipped) {
        results.skipped++;
      } else if (result.conflict) {
        results.conflicts.push({ clientId: op.clientId, entity: op.entity, resolution: result.resolution });
      } else {
        results.processed++;
      }

      // Log each sync operation
      await prisma.syncLog.create({
        data: {
          branchId,
          clientId: op.deviceId || 'unknown',
          entity: op.entity,
          entityId: op.clientId,
          operation: op.operation,
          payload: op.data,
          status: result.conflict ? 'CONFLICT' : 'SYNCED',
          conflictData: result.conflict ? result.conflictData : undefined,
          resolvedAt: new Date(),
        },
      }).catch(() => {}); // non-critical

    } catch (error) {
      logger.error(`Sync operation failed: ${op.entity}/${op.clientId}`, error);
      results.errors.push({
        clientId: op.clientId,
        entity: op.entity,
        error: error.message,
        code: error.code,
      });
    }
  }

  return results;
};

const processSingleOperation = async (op, userId, branchId) => {
  const { entity, operation, clientId, data, timestamp } = op;

  switch (entity) {
    case 'sale':
      return await syncSale({ operation, clientId, data, userId, branchId, timestamp });
    case 'product':
      return await syncProduct({ operation, clientId, data, userId, branchId });
    case 'inventory':
      return await syncInventory({ operation, clientId, data, branchId });
    default:
      logger.warn(`Unknown sync entity: ${entity}`);
      return { skipped: true, reason: 'unknown_entity' };
  }
};

const syncSale = async ({ operation, clientId, data, userId, branchId, timestamp }) => {
  if (operation === 'create') {
    // Check dedup
    const existing = await prisma.sale.findFirst({ where: { clientId } });
    if (existing) {
      return { skipped: true, reason: 'duplicate' };
    }

    await createSale({
      ...data,
      userId: data.userId || userId,
      branchId: data.branchId || branchId,
      clientId,
      offlineCreatedAt: timestamp,
    });

    return { success: true };
  }

  return { skipped: true, reason: 'unsupported_operation' };
};

const syncProduct = async ({ operation, clientId, data, userId, branchId }) => {
  if (operation === 'create') {
    const existing = await prisma.product.findFirst({ where: { clientId } });
    if (existing) return { skipped: true, reason: 'duplicate' };

    await prisma.product.create({
      data: {
        ...data,
        clientId,
        branchId: data.branchId || branchId,
        syncVersion: 1,
      },
    });
    return { success: true };
  }

  if (operation === 'update') {
    // Find by clientId or serverId
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: data.id }, { clientId }] },
    });

    if (!product) return { skipped: true, reason: 'not_found' };

    // Version check — server wins if ahead
    if (product.syncVersion > (data.syncVersion || 0)) {
      return {
        conflict: true,
        resolution: 'server_wins',
        conflictData: { serverVersion: product.syncVersion, clientVersion: data.syncVersion },
      };
    }

    await prisma.product.update({
      where: { id: product.id },
      data: {
        name: data.name,
        price: data.price,
        costPrice: data.costPrice,
        taxRate: data.taxRate,
        isActive: data.isActive,
        syncVersion: product.syncVersion + 1,
      },
    });

    return { success: true };
  }

  return { skipped: true };
};

const syncInventory = async ({ operation, data, branchId }) => {
  if (operation === 'decrement') {
    const inv = await prisma.inventory.findFirst({
      where: {
        productId: data.productId,
        branchId: data.branchId || branchId,
      },
    });

    if (!inv) return { skipped: true, reason: 'not_found' };

    const newQty = Math.max(0, inv.quantity - data.delta);
    await prisma.inventory.update({
      where: { id: inv.id },
      data: { quantity: newQty },
    });

    return { success: true };
  }

  return { skipped: true };
};

const getSyncStatus = async (branchId, since) => {
  const where = { branchId };
  if (since) where.createdAt = { gte: new Date(since) };

  const logs = await prisma.syncLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return logs;
};

// Returns server state since a timestamp so client can reconcile
const getServerDelta = async (branchId, since) => {
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [products, sales, inventory] = await Promise.all([
    prisma.product.findMany({
      where: { branchId, updatedAt: { gte: sinceDate } },
      include: { category: true },
    }),
    prisma.sale.findMany({
      where: { branchId, updatedAt: { gte: sinceDate } },
      include: { items: true },
    }),
    prisma.inventory.findMany({
      where: { branchId, updatedAt: { gte: sinceDate } },
    }),
  ]);

  return { products, sales, inventory, serverTime: new Date().toISOString() };
};

module.exports = { processSyncBatch, getSyncStatus, getServerDelta };
