const router = require('express').Router();
const { authenticate } = require('../middleware/auth.middleware');
const syncService = require('../services/sync.service');

// POST /sync/batch - process a batch of offline operations
router.post('/batch', authenticate, async (req, res, next) => {
  try {
    const { operations } = req.body;
    if (!Array.isArray(operations) || operations.length === 0) {
      return res.json({ success: true, data: { processed: 0, skipped: 0, errors: [] } });
    }

    const result = await syncService.processSyncBatch(
      operations,
      req.user.id,
      req.user.branchId
    );

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /sync/delta - get server changes since timestamp
router.get('/delta', authenticate, async (req, res, next) => {
  try {
    const { since } = req.query;
    const delta = await syncService.getServerDelta(req.user.branchId, since);
    res.json({ success: true, data: delta });
  } catch (err) { next(err); }
});

// GET /sync/status - sync logs
router.get('/status', authenticate, async (req, res, next) => {
  try {
    const { since } = req.query;
    const logs = await syncService.getSyncStatus(req.user.branchId, since);
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
});

module.exports = router;
