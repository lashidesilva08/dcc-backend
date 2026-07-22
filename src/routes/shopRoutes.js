import express from "express";

import {
  createShop,
  getShopById,
  updateShop,
  getShopAnalytics,
  getAllShops,
  getShopByUrl,
  getShopProductsBySlug,
  toggleFavouriteShop,
  getFavouriteStatus,
  getFavouriteCount,
  searchShops
} from "../controllers/shopControllers.js";
import {protect} from "../middleware/auth.middleware.js";


const router = express.Router();

router.get("/", getAllShops);

router.post("/", createShop);

router.get("/my-shop/analytics", getShopAnalytics);


router.get("/url/:shopUrl/products", getShopProductsBySlug);

router.get("/search", searchShops);

router.get("/url/:shopUrl", getShopByUrl);

router.get("/:id", getShopById);

router.post("/:id/favourite",protect,toggleFavouriteShop);

router.get("/:id/favourite",protect,getFavouriteStatus);

router.get("/:id/favourites/count",protect,getFavouriteCount);

router.put("/:id", updateShop);



export default router;