import express from 'express';
import { getCheckoutDetails, createOrder } from '../controllers/checkoutController.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/details', protect, getCheckoutDetails);
router.post('/create', protect, createOrder);

export default router;
