import express from "express";

import {
  createShop,
  getShopById,
  updateShop,
  getShopAnalytics,
  getAllShops,
  getShopByUrl
} from "../controllers/shopControllers.js";

const router = express.Router();

router.get("/", getAllShops);
router.post("/", createShop);
router.get("/:id", getShopById);
router.put("/:id", updateShop);
router.get("/my-shop/analytics", getShopAnalytics);
router.get("/url/:shopUrl", getShopByUrl);

export default router;