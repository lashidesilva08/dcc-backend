import express from "express";
import {getAllProducts,getCategories,createProduct,updateProduct,deleteProduct,getProductReviews,submitReview, getProductById, getMyListings
} from "../controllers/productControllers.js";
import { protect } from "../middleware/auth.js";
import { getProducts } from "../controllers/sellerControllers.js";

const router = express.Router();

// 1. SPECIFIC Public Routes (Always put static paths first!)
router.get("/categories", getCategories);
router.get("/my-listings", protect, getMyListings); 
router.get("/reviews/:productId", getProductReviews);

// 2. DYNAMIC Public Routes (Put parameter paths at the bottom)
router.get("/", getAllProducts);
router.get("/:id", getProductById); 

// 3. Protected Routes
router.post("/", protect,createProduct);          // Seller only logic
router.put("/:id",protect, updateProduct);        // Seller only logic
router.delete("/:id",protect, deleteProduct);     // Seller only logic
router.post("/reviews", submitReview);    // Buyer only logic (Removed the duplicate line)

export default router;