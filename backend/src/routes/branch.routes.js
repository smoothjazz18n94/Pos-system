// branch.routes.js
const branchRouter = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { prisma } = require('../config/database');

branchRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const branches = await prisma.branch.findMany({
      where: req.user.role === 'ADMIN' ? {} : { id: req.user.branchId },
      include: { _count: { select: { users: true, products: true, sales: true } } },
    });
    res.json({ success: true, data: branches });
  } catch (err) { next(err); }
});

branchRouter.post('/', authenticate, authorize('ADMIN'),
  async (req, res, next) => {
    try {
      const branch = await prisma.branch.create({ data: req.body });
      res.status(201).json({ success: true, data: branch });
    } catch (err) { next(err); }
  }
);

branchRouter.put('/:id', authenticate, authorize('ADMIN'),
  async (req, res, next) => {
    try {
      const branch = await prisma.branch.update({ where: { id: req.params.id }, data: req.body });
      res.json({ success: true, data: branch });
    } catch (err) { next(err); }
  }
);

module.exports = branchRouter;
