const express = require('express');
const router = express.Router();

const reportsController = require('../controllers/reportsController');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { queryReportSchema } = require('../validators/reportValidator');

// Enforce authentication across all reports endpoints
router.use(authenticateToken);

// GET /api/reports?type=daily|month_to_date|monthly&date=YYYY-MM-DD
router.get('/', validate(queryReportSchema, 'query'), reportsController.getReport);

module.exports = router;
