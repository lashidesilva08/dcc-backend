import express from "express";
import {
    createOrder,
    getInvoice,
    getMyOrders,
    getSellerOrders,
    getSellerOrderById,
    updateOrderStatus,
    getOrderById,
    cancelOrder,
    trackOrder,
} from "../controllers/orderControllers.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// All order routes require authentication
router.use(protect);

router.post("/checkout", createOrder);           // Buyer: create order from cart
router.get("/my-orders", getMyOrders);           // Buyer: order history
router.get("/seller-orders", getSellerOrders);   // Seller: view their orders (status filter, search, pagination)
router.get("/seller-orders/:id", getSellerOrderById); // Seller: single order details (own items only)
router.get("/track/:id", trackOrder);            // Buyer: track an order
router.get("/:id/invoice", getInvoice);          // Buyer/Admin: get invoice
router.get("/:id", getOrderById);               // Buyer/Admin: order details
router.patch("/:id/status", updateOrderStatus);  // Seller/Admin: update status
router.delete("/:id", cancelOrder);             // Buyer: cancel order

export default router;