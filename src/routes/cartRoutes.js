import express from "express";
import { getCart, addToCart, removeFromCart, updateCartItem, clearCart } from "../controllers/cartControllers.js";

const router = express.Router();

router.get("/", getCart);             // View cart
router.post("/add", addToCart);       // Add item
router.delete("/:id", removeFromCart); // Remove item
router.put("/update/:id", updateCartItem); // Update item quantity
router.delete("/clear", clearCart); // Clear cart


export default router;