import express from "express";

import {
  createShop,
  getShopById,
  updateShop,
  getShopAnalytics,
  getAllShops,
  getShopByUrl,
  getShopProductsBySlug,
} from "../controllers/shopControllers.js";

const router = express.Router();

router.get("/", getAllShops);

router.post("/", createShop);

router.get("/url/:shopUrl", getShopByUrl);

router.get("/url/:shopUrl/products", getShopProductsBySlug);

router.get("/:id", getShopById);

router.put("/:id", updateShop);

router.get("/my-shop/analytics", getShopAnalytics);

export default router;