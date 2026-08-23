import express from "express";

import {
  initiatePayment,
  handlePaymentWebhook,
  initiateRefund,
} from "../controllers/paymentControllers.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

/*
 * All payment operations in the current DCC frontend
 * require the buyer to be authenticated.
 */
router.use(protect);

/**
 * Start payment
 *
 * POST /api/v1/payments/initiate
 */
router.post("/initiate", initiatePayment);

/**
 * Payment success / failure callback
 *
 * POST /api/v1/payments/webhook
 */
router.post("/webhook", handlePaymentWebhook);

/**
 * Refund
 *
 * POST /api/v1/payments/refund/:orderId
 */
router.post("/refund/:orderId", initiateRefund);

export default router;