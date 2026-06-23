import express from "express";

import {
  getShopBySlug,
  getShopProductsBySlug,
} from "../controllers/shopControllers.js";

const router = express.Router();

router.get("/:shopUrl/products", getShopProductsBySlug);

router.get("/:shopUrl", getShopBySlug);

export default router;