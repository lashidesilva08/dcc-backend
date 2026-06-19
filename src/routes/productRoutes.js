import express from "express";
import {getAllProducts,getCategories,getProductById,createProduct,updateProduct,deleteProduct,getProductReviews,submitReview
} from "../controllers/productControllers.js";

const router = express.Router();

// 1. SPECIFIC Public Routes (Always put static paths first!)
router.get("/categories", getCategories);
router.get("/reviews/:productId", getProductReviews);

// 2. DYNAMIC Public Routes (Put parameter paths at the bottom)
router.get("/", getAllProducts);
router.get("/:id", getProductById); 

// 3. Protected Routes
router.post("/", createProduct);          // Seller only logic
router.put("/:id", updateProduct);        // Seller only logic
router.delete("/:id", deleteProduct);     // Seller only logic
router.post("/reviews", submitReview);    // Buyer only logic (Removed the duplicate line)

export default router;