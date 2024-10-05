// src/routes/message.routes.js

import express from 'express';
import { sendMessage, getMessages, uploadFileToS3 } from '../controllers/message.controller.js';
//import { authenticateUser } from '../middlewere/authenticate.js'; // Ensure you have authentication middleware

const router = express.Router();

// Route: POST /api/messages/send
router.post('/send',  sendMessage);
router.post('/uploadFileToS3', uploadFileToS3);
// Route: GET /api/messages/:roomId
router.get('/:roomId', getMessages);

export default router;
