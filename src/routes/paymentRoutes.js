import express from "express";
import { initiatePayment, handlePaymentWebhook, initiateRefund} from "../controllers/paymentControllers.js";

const router = express.Router();

router.post("/initiate", initiatePayment);
router.post("/webhook", handlePaymentWebhook);
router.post("/refund", initiateRefund);

export default router;