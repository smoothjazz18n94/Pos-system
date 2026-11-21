// report.routes.js
const reportRouter = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const reportService = require('../services/report.service');

reportRouter.get('/daily', authenticate, async (req, res, next) => {
  try {
    const { date, branchId } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const targetBranch = req.user.role === 'ADMIN' ? branchId : req.user.branchId;
    const data = await reportService.getDailySales(targetBranch, targetDate);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

reportRouter.get('/weekly', authenticate, async (req, res, next) => {
  try {
    const { weekStart, branchId } = req.query;
    const targetBranch = req.user.role === 'ADMIN' ? branchId : req.user.branchId;
    const data = await reportService.getWeeklyReport(targetBranch, weekStart || new Date());
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

reportRouter.get('/monthly', authenticate, async (req, res, next) => {
  try {
    const now = new Date();
    const { year = now.getFullYear(), month = now.getMonth() + 1, branchId } = req.query;
    const targetBranch = req.user.role === 'ADMIN' ? branchId : req.user.branchId;
    const data = await reportService.getMonthlyReport(targetBranch, Number(year), Number(month));
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

reportRouter.get('/low-stock', authenticate, async (req, res, next) => {
  try {
    const branchId = req.user.role === 'ADMIN' ? req.query.branchId : req.user.branchId;
    const data = await reportService.getLowStockAlerts(branchId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

module.exports = reportRouter;
