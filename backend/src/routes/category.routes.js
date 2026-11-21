// category.routes.js
const catRouter = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { prisma } = require('../config/database');

catRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: categories });
  } catch (err) { next(err); }
});

catRouter.post('/', authenticate, authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const cat = await prisma.category.create({ data: req.body });
    res.status(201).json({ success: true, data: cat });
  } catch (err) { next(err); }
});

catRouter.put('/:id', authenticate, authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const cat = await prisma.category.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: cat });
  } catch (err) { next(err); }
});

catRouter.delete('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    await prisma.category.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, message: 'Category deactivated' });
  } catch (err) { next(err); }
});

module.exports = catRouter;
