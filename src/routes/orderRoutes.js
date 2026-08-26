import express from "express";
import { createOrder, getInvoice, getMyOrders, getSellerOrders, updateOrderStatus, getOrderById, cancelOrder, trackOrder } from "../controllers/orderControllers.js";

const router = express.Router();

router.post("/checkout", createOrder);       // Buyer: Unified checkout
router.get("/my-orders", getMyOrders);       // Buyer: Order history
router.patch("/:id/status", updateOrderStatus); // Seller/Admin: Status update
router.get("/:id/invoice", getInvoice);
router.get("/:id", getOrderById);
router.delete("/:id", cancelOrder);
router.get("/track/:id", trackOrder);
router.get("/seller-orders", getSellerOrders);

export default router;