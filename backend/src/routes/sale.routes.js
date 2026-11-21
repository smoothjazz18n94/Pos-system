const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const saleService = require('../services/sale.service');

// GET /sales
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page, limit, startDate, endDate, status } = req.query;
    const result = await saleService.getSales({
      branchId: req.user.branchId,
      userId: req.user.id,
      role: req.user.role,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      startDate,
      endDate,
      status,
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// GET /sales/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const sale = await saleService.getSaleById(req.params.id);
    res.json({ success: true, data: sale });
  } catch (err) { next(err); }
});

// POST /sales - create a sale (online path)
router.post('/',
  authenticate,
  [
    body('items').isArray({ min: 1 }),
    body('items.*.productId').notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('paymentMethod').isIn(['CASH', 'MOBILE_MONEY', 'CARD']),
    body('amountPaid').isFloat({ min: 0 }),
    validate,
  ],
  async (req, res, next) => {
    try {
      const sale = await saleService.createSale({
        ...req.body,
        userId: req.user.id,
        branchId: req.body.branchId || req.user.branchId,
      });
      res.status(201).json({ success: true, data: sale });
    } catch (err) { next(err); }
  }
);

// PATCH /sales/:id/void
router.patch('/:id/void',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  async (req, res, next) => {
    try {
      const sale = await saleService.voidSale(req.params.id, req.user.id);
      res.json({ success: true, data: sale });
    } catch (err) { next(err); }
  }
);

module.exports = router;
