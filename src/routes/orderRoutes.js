import express from "express";
import {
  createOrder,
  getMyOrders,
  getSellerOrders,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderItemStatus,
  cancelOrder,
  trackOrder,
  getInvoice,
} from "../controllers/orderControllers.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Public / optional track endpoint
router.get("/track/:id", trackOrder);
router.get("/:id/track", trackOrder);

// All other endpoints require authentication
router.use(protect);

// Buyer & general order placement & history
router.post("/checkout", createOrder);
router.post("/", createOrder);
router.get("/my-orders", getMyOrders);

// Seller order management
router.get("/seller-orders", getSellerOrders);
router.patch("/items/:itemId/status", updateOrderItemStatus);

// Admin order management
router.get("/all", requireRole("ADMIN", "SUPER_ADMIN"), getAllOrders);

// Specific order detail, status, invoice, cancellation
router.get("/:id/invoice", getInvoice);
router.get("/:id", getOrderById);
router.patch("/:id/status", updateOrderStatus);
router.patch("/:id/cancel", cancelOrder);
router.delete("/:id", cancelOrder);

export default router;