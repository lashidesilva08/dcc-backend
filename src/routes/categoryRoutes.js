import express from 'express';
import {getAllCategories, getCategory, createCategory, updateCategory, deleteCategory} from '../controllers/categoryControllers.js';
// import { protect, requireRole } from '../middleware/auth.middleware.js'; // Temporarily commented out for Phase 1 testing

const router = express.Router();

router.get("/", getAllCategories);
router.get("/:param", getCategory);
router.post("/", createCategory); 
router.put("/:id", updateCategory); 
router.delete("/:id", deleteCategory); 

export default router;