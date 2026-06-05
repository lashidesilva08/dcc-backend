import express from "express";

import {getAllProducts,getCategories,getProductById,createProduct,updateProduct,deleteProduct,getProductReviews,submitReview
} from "../controllers/productControllers.js";

const router = express.Router();

// Public Routes
router.get("/", getAllProducts);
router.get("/categories", getCategories);
router.get("/:id", getProductById);
router.get("/reviews/:productId", getProductReviews);

// Protected Routes (Sellers/Buyers)
router.post("/", createProduct);          // Seller only logic
router.put("/:id", updateProduct);        // Seller only logic
router.delete("/:id", deleteProduct);     // Seller only logic
router.post("/reviews", submitReview);    // Buyer only logic



// Protected Buyer Routes
router.post("/reviews",submitReview); // Rate and review


export default router;