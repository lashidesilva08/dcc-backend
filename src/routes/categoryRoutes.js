import express from 'express';
import {getAllCategories, getCategoryBySlug, createCategory, updateCategory, deleteCategory} from '../controllers/categoryControllers.js';

const router = express.Router();

router.get("/", getAllCategories);
router.get("/:slug", getCategoryBySlug);
router.post("/", createCategory); // Admin Only
router.put("/:id", updateCategory); // Admin Only
router.delete("/:id", deleteCategory); // Admin Only

export default router;