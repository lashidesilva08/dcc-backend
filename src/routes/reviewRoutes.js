import express from "express";
import {getProductReviews, addReview, deleteReview} from "../controllers/reviewControllers.js";


const router = express.Router();

// Public route: Anyone can view product reviews
router.get("/product/:productId", getProductReviews);

// Protected routes: Only logged-in Buyers can submit reviews
router.post("/", addReview);

// Optional: Users can delete their own reviews
router.delete("/:id", deleteReview);

export default router;