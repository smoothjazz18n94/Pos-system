const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { prisma } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

router.get('/', authenticate, authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { branchId } = req.query;
    const where = {};
    if (req.user.role === 'MANAGER') where.branchId = req.user.branchId;
    else if (branchId) where.branchId = branchId;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, isActive: true, branchId: true, lastLogin: true, createdAt: true,
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.id !== req.params.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    const { password, role, ...data } = req.body;
    if (role && req.user.role !== 'ADMIN') throw new AppError('Only admin can change roles', 403, 'FORBIDDEN');

    const updateData = { ...data };
    if (role && req.user.role === 'ADMIN') updateData.role = role;
    if (password) updateData.password = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, isActive: true, branchId: true,
      },
    });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'User deactivated' });
  } catch (err) { next(err); }
});

module.exports = router;
