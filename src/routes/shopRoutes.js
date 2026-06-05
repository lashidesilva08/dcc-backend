import express from "express";
import { createShop, getShopById, updateShop, getShopAnalytics } from "../controllers/shopControllers.js";

const router = express.Router();

router.post("/", createShop);
router.get("/:id", getShopById);
router.put("/:id", updateShop);
router.get("/my-shop/analytics", getShopAnalytics);


// /**
//  * @description Admin: Approve a pending shop
//  * @access Private (Admin/Super Admin only)
//  */
// // router.patch("/approve/:id", protect, approveShop); 

// /**
//  * @description Public: Get all products belonging to a specific shop
//  * @access Public
//  */
// // router.get("/:id/products", getShopProducts); 

// /**
//  * @description Admin: Manually activate or disable a shop
//  * @access Private (Admin only)
//  */
// router.patch("/status/:id", protect, toggleShopStatus); 

// /**
//  * @description Seller: Bulk update stock levels for their own products
//  * @access Private (Seller only)
//  */
// router.put("/inventory/bulk", protect, updateInventoryBulk);

// /**
//  * @description Public: Get all reviews for products in a specific shop
//  * @access Public
//  */
// router.get("/:id/reviews", getShopReviews); 

// /**
//  * @description Seller: Update shop branding (banner and description)
//  * @access Private (Seller only)
//  */
// router.put("/branding", protect, updateShopBranding); 


export default router;