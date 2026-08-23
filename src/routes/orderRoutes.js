import express from "express";

import {
  createOrder,
  getMyOrders,
  updateOrderStatus,
  getSellerOrders,
  getInvoice,
  checkout,
  getOrderById,
  cancelOrder,
  trackOrder,
} from "../controllers/orderControllers.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

// Checkout
router.post("/checkout", checkout);

// Create order
router.post("/", createOrder);

// Get logged-in user's orders
router.get("/my-orders", getMyOrders);

// Seller orders
router.get("/seller", getSellerOrders);

// Get order by ID
router.get("/:id", getOrderById);

// Get invoice
router.get("/:id/invoice", getInvoice);

// Update order status
router.patch("/:id/status", updateOrderStatus);

// Cancel order
router.patch("/:id/cancel", cancelOrder);

// Track order
router.get("/:id/track", trackOrder);

export default router;