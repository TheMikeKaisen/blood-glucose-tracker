const express = require('express');
const router = express.Router();

const readingsController = require('../controllers/readingsController');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createReadingSchema,
  updateReadingSchema,
  patchReadingSchema,
  queryReadingsSchema,
} = require('../validators/readingValidator');

// Enforce authentication across all readings endpoints
router.use(authenticateToken);

// Reading CRUD endpoints
router.post('/', validate(createReadingSchema), readingsController.createReading);
router.get('/', validate(queryReadingsSchema, 'query'), readingsController.getReadings);
router.get('/:id', readingsController.getReadingById);
router.put('/:id', validate(updateReadingSchema), readingsController.updateReading);
router.patch('/:id', validate(patchReadingSchema), readingsController.patchReading);
router.delete('/:id', readingsController.deleteReading);

module.exports = router;
