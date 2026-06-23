import express from "express";

import {
  getShopBySlug,
  getShopProductsBySlug,
} from "../controllers/shopControllers.js";

const router = express.Router();

router.get("/:shopUrl", getShopBySlug);

router.get("/:shopUrl/products", getShopProductsBySlug);

export default router;