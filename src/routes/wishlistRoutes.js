import express from "express";
import { getWishlist, addToWishlist, removeFromWishlist, clearWishlist } from "../controllers/wishlistControllers.js";

const router = express.Router();

// All wishlist routes require authentication
router.get("/", getWishlist);
router.post("/add", addToWishlist);
router.delete("/:id", removeFromWishlist);
router.delete("/", clearWishlist);

export default router;