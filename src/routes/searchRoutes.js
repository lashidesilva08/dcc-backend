import express from "express";



const router = express.Router();

router.get("/suggestions", getSuggestions);
router.get("/trending", getTrending);

import { searchProducts, getAllCategories, getProductsByCategory, getSearchSuggestions,getSuggestions,getTrending} from "../controllers/searchControllers.js";

//    Search products by keyword, filters (price, rating, etc.), and sorting
router.get("/", searchProducts);

//    Get autocomplete suggestions based on search query
router.get("/suggestions", getSearchSuggestions);

//   Get all marketplace categories (Fashion, Groceries, etc.)
router.get("/categories", getAllCategories);

//   Get products within a specific category
router.get("/category/:slug", getProductsByCategory);


export default router;