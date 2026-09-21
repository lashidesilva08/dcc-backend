import express from "express";

import {
  getSellerMe,
  getSellerDashboard,
  getSellerProfileStatus,
  getSellerBankDetails,
  updateSellerBankDetails,
  getProducts,
  deleteProduct,
} from "../controllers/sellerControllers.js";

import { protect, requireRole } from "../middleware/auth.middleware.js";

const router = express.Router();

// Authentication
router.use(protect);
// Seller role
router.use(requireRole("SELLER"));
router.get("/status", getSellerProfileStatus);
router.get("/products", getProducts);
router.delete("/products/:id", deleteProduct);
// ---------------------------------------------------------
// Logged-in seller
// ---------------------------------------------------------

router.get("/me", getSellerMe);

// ---------------------------------------------------------
// Seller dashboard
// ---------------------------------------------------------

router.get("/dashboard", getSellerDashboard);

// ---------------------------------------------------------
// Seller payout bank details
// ---------------------------------------------------------

router.get("/bank-details",protect, getSellerBankDetails);
router.put("/bank-details", protect, updateSellerBankDetails);

export default router;
