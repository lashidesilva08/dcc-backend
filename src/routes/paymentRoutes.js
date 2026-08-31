import express from "express";
import {completeMockPayment,
    initiatePayment,
    handlePaymentWebhook,
    handleMintWebhook,
    handleSimulatedPaymentWebhook,
    getPaymentStatus,
    initiateRefund,
} from "../controllers/paymentControllers.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// POST /api/v1/payments/initiate
// Auth required — buyer initiates payment (COD or PayHere)
router.post("/initiate", protect, initiatePayment);

// POST /api/v1/payments/webhook
// Used by the simulated frontend payment gateway.
// NO AUTH — webhook/payment notification endpoint.
router.post("/webhook", handleSimulatedPaymentWebhook);

// POST /api/v1/payments/webhook/payhere
// NO AUTH — PayHere servers call this directly with the payment notification
router.post("/webhook/payhere", handlePaymentWebhook);

// POST /api/v1/payments/webhook/mint
// NO AUTH — Mint servers call this directly
router.post("/webhook/mint", handleMintWebhook);

// POST /api/v1/payments/webhook/koko
// NO AUTH — Koko servers call this directly with payment notification
router.post("/webhook/koko", handleKokoWebhook);

// POST /api/v1/payments/webhook/onepay
// NO AUTH — OnePay servers call this directly with payment notification
router.post("/webhook/onepay", handleOnePayWebhook);

// GET /api/v1/payments/status/:orderId
// Auth required — frontend polls this after PayHere redirect to check if payment succeeded
router.get("/status/:orderId", protect, getPaymentStatus);

// POST /api/v1/payments/refund/:orderId
// Auth required — buyer requests a refund for a cancelled order
router.post("/refund/:orderId", protect, initiateRefund);
router.post("/mock/complete", protect, completeMockPayment)

export default router;