// src/routes/call.routes.js

import express from 'express';
import { getCallHistory } from '../controllers/call.controller.js';

const router = express.Router();

/**
 * @route   GET /api/calls/history
 * @desc    Get call history for a specific user
 * @access  Public (Adjust as necessary)
 * @queryParams
 *          userId - The ID of the user or doctor
 *          role - "Doctor" or "User"
 */
router.get('/callHistory', getCallHistory);

export default router;
