const { prisma } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const generateReceiptNumber = () => {
  const date = new Date();
  const prefix = `RCP-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${random}`;
};

const createSale = async ({ userId, branchId, items, paymentMethod, amountPaid, discountAmount = 0, notes, clientId, offlineCreatedAt }) => {
  // Deduplication: if clientId exists and already synced, skip
  if (clientId) {
    const existing = await prisma.sale.findFirst({ where: { clientId } });
    if (existing) {
      logger.warn(`Duplicate sale detected via clientId: ${clientId}`);
      return { ...existing, isDuplicate: true };
    }
  }

  // Fetch products with current prices
  const productIds = items.map(i => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: { inventory: { where: { branchId } } },
  });

  const productMap = Object.fromEntries(products.map(p => [p.id, p]));

  // Validate stock and build line items
  const lineItems = [];
  let subtotal = 0;
  let taxAmount = 0;

  for (const item of items) {
    const product = productMap[item.productId];
    if (!product) {
      throw new AppError(`Product ${item.productId} not found`, 404, 'NOT_FOUND');
    }

    const inv = product.inventory[0];
    if (inv && inv.quantity < item.quantity) {
      throw new AppError(`Insufficient stock for ${product.name}`, 400, 'INSUFFICIENT_STOCK');
    }

    const unitPrice = Number(item.unitPrice || product.price);
    const taxRate = Number(product.taxRate);
    const itemDiscount = Number(item.discount || 0);
    const itemSubtotal = (unitPrice * item.quantity) - itemDiscount;
    const itemTax = itemSubtotal * (taxRate / 100);

    subtotal += itemSubtotal;
    taxAmount += itemTax;

    lineItems.push({
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPrice,
      taxRate,
      discount: itemDiscount,
      subtotal: itemSubtotal,
    });
  }

  const total = subtotal + taxAmount - discountAmount;
  const changeDue = Math.max(0, amountPaid - total);

  // Create sale + items + update inventory in a transaction
  const sale = await prisma.$transaction(async (tx) => {
    const newSale = await tx.sale.create({
      data: {
        receiptNumber: generateReceiptNumber(),
        userId,
        branchId,
        subtotal,
        taxAmount,
        discountAmount,
        total,
        paymentMethod,
        amountPaid,
        changeDue,
        notes,
        clientId,
        syncStatus: 'SYNCED',
        offlineCreatedAt: offlineCreatedAt ? new Date(offlineCreatedAt) : null,
        items: { create: lineItems },
      },
      include: { items: true, user: { select: { firstName: true, lastName: true } } },
    });

    // Update inventory
    for (const item of items) {
      const inv = productMap[item.productId]?.inventory[0];
      if (inv) {
        await tx.inventory.update({
          where: { id: inv.id },
          data: { quantity: { decrement: item.quantity } },
        });
      }
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        userId,
        action: 'SALE_CREATED',
        entity: 'sale',
        entityId: newSale.id,
        saleId: newSale.id,
        metadata: { total, paymentMethod, itemCount: items.length },
      },
    });

    return newSale;
  });

  logger.info(`Sale created: ${sale.receiptNumber} | Total: ${sale.total}`);
  return sale;
};

const getSales = async ({ branchId, userId, role, page = 1, limit = 20, startDate, endDate, status }) => {
  const skip = (page - 1) * limit;
  const where = {};

  if (role === 'CASHIER') where.userId = userId;
  if (branchId && role !== 'ADMIN') where.branchId = branchId;
  if (status) where.status = status;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        items: true,
        user: { select: { firstName: true, lastName: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.sale.count({ where }),
  ]);

  return { sales, total, page, totalPages: Math.ceil(total / limit) };
};

const getSaleById = async (id) => {
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { name: true, sku: true } } } },
      user: { select: { firstName: true, lastName: true, email: true } },
      branch: true,
    },
  });
  if (!sale) throw new AppError('Sale not found', 404, 'NOT_FOUND');
  return sale;
};

const voidSale = async (saleId, userId) => {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { items: true },
  });

  if (!sale) throw new AppError('Sale not found', 404, 'NOT_FOUND');
  if (sale.status !== 'COMPLETED') throw new AppError('Sale cannot be voided', 400, 'INVALID_OPERATION');

  const updatedSale = await prisma.$transaction(async (tx) => {
    const voided = await tx.sale.update({
      where: { id: saleId },
      data: { status: 'VOID' },
    });

    // Restore inventory
    for (const item of sale.items) {
      await tx.inventory.updateMany({
        where: { productId: item.productId, branchId: sale.branchId },
        data: { quantity: { increment: item.quantity } },
      });
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: 'SALE_VOIDED',
        entity: 'sale',
        entityId: saleId,
        saleId,
      },
    });

    return voided;
  });

  return updatedSale;
};

module.exports = { createSale, getSales, getSaleById, voidSale };
