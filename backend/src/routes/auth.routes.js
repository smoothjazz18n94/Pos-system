const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const authService = require('../services/auth.service');

router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    validate,
  ],
  async (req, res, next) => {
    try {
      const result = await authService.login(req.body.email, req.body.password);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);

router.post('/refresh',
  [body('refreshToken').notEmpty(), validate],
  async (req, res, next) => {
    try {
      const tokens = await authService.refreshAccessToken(req.body.refreshToken);
      res.json({ success: true, data: tokens });
    } catch (err) { next(err); }
  }
);

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await authService.logout(req.user.id);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) { next(err); }
});

router.post('/register',
  authenticate,
  authorize('ADMIN'),
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('role').isIn(['ADMIN', 'MANAGER', 'CASHIER']),
    validate,
  ],
  async (req, res, next) => {
    try {
      const user = await authService.createUser(req.body);
      res.status(201).json({ success: true, data: user });
    } catch (err) { next(err); }
  }
);

router.get('/me', authenticate, (req, res) => {
  res.json({ success: true, data: req.user });
});

module.exports = router;
