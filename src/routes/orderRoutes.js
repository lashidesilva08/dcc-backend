import express from "express";

import {
    createOrder,
    getMyOrders,
    updateOrderStatus,
    getSellerOrders,
    getInvoice,
    getOrderById,
    cancelOrder,
    trackOrder
} from "../controllers/orderControllers.js";

import {
    protect,
    requireRole
} from "../middleware/auth.js";


const router = express.Router();


// ======================================================
// ALL ORDER ROUTES BELOW REQUIRE LOGIN
// ======================================================

router.use(protect);


// ======================================================
// BUYER ROUTES
// ======================================================

// Checkout
router.post("/checkout", createOrder);

// Logged-in buyer order history
router.get("/my-orders", getMyOrders);

// Track order
router.get("/track/:id", trackOrder);


// ======================================================
// SELLER ROUTES
// ======================================================

// IMPORTANT:
// Keep this BEFORE "/:id"
router.get(
    "/seller-orders",
    requireRole("SELLER", "ADMIN"),
    getSellerOrders
);


// ======================================================
// ORDER MANAGEMENT
// ======================================================

// Update order status
router.patch(
    "/:id/status",
    requireRole("SELLER", "ADMIN"),
    updateOrderStatus
);

// Invoice
router.get("/:id/invoice", getInvoice);

// Get one order
router.get("/:id", getOrderById);

// Cancel order
router.delete("/:id", cancelOrder);


export default router;