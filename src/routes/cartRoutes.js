import express from "express";

import {
    getCart,
    addToCart,
    removeFromCart,
    updateCartItem,
    clearCart
} from "../controllers/cartControllers.js";

import {
    protect
} from "../middleware/auth.js";


const router =
    express.Router();


// All cart operations belong to
// the authenticated buyer.
router.use(protect);


// View cart
router.get(
    "/",
    getCart
);


// Add item
router.post(
    "/add",
    addToCart
);


// IMPORTANT:
// Static route must come before "/:id"
router.delete(
    "/clear",
    clearCart
);


// Update quantity
router.put(
    "/update/:id",
    updateCartItem
);


// Remove one cart line
router.delete(
    "/:id",
    removeFromCart
);


export default router;