import express from 'express';
import {getAllCategories, getCategoryBySlug, createCategory, updateCategory, deleteCategory} from '../controllers/categoryControllers.js';
import { adminAuth } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.get("/", getAllCategories);
router.get("/:slug", getCategoryBySlug);

// Legacy admin endpoints. They were previously unprotected; the admin panel
// now uses /api/v1/admin/categories instead, but these stay for compatibility.
router.post("/", ...adminAuth, createCategory);
router.put("/:id", ...adminAuth, updateCategory);
router.delete("/:id", ...adminAuth, deleteCategory);

export default router;