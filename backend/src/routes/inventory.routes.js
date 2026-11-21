// inventory.routes.js
const invRouter = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { prisma } = require('../config/database');

invRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const { branchId, lowStock } = req.query;
    const targetBranch = req.user.role === 'ADMIN' ? branchId : req.user.branchId;
    const where = targetBranch ? { branchId: targetBranch } : {};

    const inventory = await prisma.inventory.findMany({
      where,
      include: {
        product: { include: { category: true } },
        branch: { select: { name: true } },
      },
      orderBy: { product: { name: 'asc' } },
    });

    const filtered = lowStock === 'true'
      ? inventory.filter(i => i.quantity <= i.lowStockAlert)
      : inventory;

    res.json({ success: true, data: filtered });
  } catch (err) { next(err); }
});

invRouter.put('/:id', authenticate, authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { quantity, lowStockAlert, delta } = req.body;
    const data = {};
    if (delta !== undefined) data.quantity = { increment: delta };
    else if (quantity !== undefined) data.quantity = quantity;
    if (lowStockAlert !== undefined) data.lowStockAlert = lowStockAlert;

    const inv = await prisma.inventory.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: inv });
  } catch (err) { next(err); }
});

invRouter.post('/adjust', authenticate, authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { productId, branchId, delta, reason } = req.body;
    const inv = await prisma.inventory.upsert({
      where: { productId_branchId: { productId, branchId } },
      update: { quantity: { increment: delta } },
      create: { productId, branchId, quantity: Math.max(0, delta) },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'INVENTORY_ADJUST',
        entity: 'inventory',
        entityId: inv.id,
        metadata: { delta, reason },
      },
    });

    res.json({ success: true, data: inv });
  } catch (err) { next(err); }
});

module.exports = invRouter;
