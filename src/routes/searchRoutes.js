import express from "express";
import {
searchProducts,
getSearchSuggestions,
getTrending,
getAllCategories,
getProductsByCategory,
} from "../controllers/searchControllers.js";

const router = express.Router();

// Search products
// GET /api/v1/search?q=iphone
router.get("/", searchProducts);

// Autocomplete suggestions
//GET /api/v1/search/suggestions?q=iph
router.get("/suggestions", getSearchSuggestions);

// Trending searches/products
//GET /api/v1/search/trending
router.get("/trending", getTrending);

// Get all categories
//GET /api/v1/search/categories
router.get("/categories", getAllCategories);

// Get products by category
//GET /api/v1/search/category/Electronics
router.get("/category/:slug", getProductsByCategory);

export default router;
