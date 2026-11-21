const router = require('express').Router();
const { body, query } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { prisma } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

// GET /products - list with pagination + search
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search, categoryId, branchId, isActive } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (req.user.role !== 'ADMIN') where.branchId = req.user.branchId;
    else if (branchId) where.branchId = branchId;

    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          inventory: { where: { branchId: req.user.branchId } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: Number(limit),
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ success: true, data: products, meta: { total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) } });
  } catch (err) { next(err); }
});

// GET /products/barcode/:code
router.get('/barcode/:code', authenticate, async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { barcode: req.params.code },
      include: {
        category: true,
        inventory: { where: { branchId: req.user.branchId } },
      },
    });
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

// GET /products/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { category: true, inventory: true },
    });
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

// POST /products
router.post('/',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  [
    body('name').trim().notEmpty(),
    body('price').isFloat({ min: 0 }),
    body('taxRate').optional().isFloat({ min: 0, max: 100 }),
    validate,
  ],
  async (req, res, next) => {
    try {
      const { initialQuantity, lowStockAlert, ...productData } = req.body;
      const branchId = productData.branchId || req.user.branchId;

      const product = await prisma.$transaction(async (tx) => {
        const p = await tx.product.create({
          data: { ...productData, branchId },
          include: { category: true },
        });

        if (branchId && initialQuantity !== undefined) {
          await tx.inventory.create({
            data: {
              productId: p.id,
              branchId,
              quantity: Number(initialQuantity) || 0,
              lowStockAlert: Number(lowStockAlert) || 10,
            },
          });
        }

        return p;
      });

      res.status(201).json({ success: true, data: product });
    } catch (err) { next(err); }
  }
);

// PUT /products/:id
router.put('/:id',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  async (req, res, next) => {
    try {
      const { initialQuantity, lowStockAlert, ...data } = req.body;
      const product = await prisma.product.update({
        where: { id: req.params.id },
        data: { ...data, syncVersion: { increment: 1 } },
        include: { category: true },
      });
      res.json({ success: true, data: product });
    } catch (err) { next(err); }
  }
);

// DELETE /products/:id (soft delete)
router.delete('/:id',
  authenticate,
  authorize('ADMIN'),
  async (req, res, next) => {
    try {
      await prisma.product.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });
      res.json({ success: true, message: 'Product deactivated' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
