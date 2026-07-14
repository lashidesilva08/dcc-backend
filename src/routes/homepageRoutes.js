import express from 'express';
import { getBanners, getFeaturedShops, updateHeroBanner,getActiveFlashSale, getActiveCategories} from '../controllers/homepageControllers.js';

const router = express.Router();

router.get("/banners", getBanners);
router.get("/featured", getFeaturedShops);
router.put("/banners", updateHeroBanner); // Admin Only
router.get("/flash-sale", getActiveFlashSale);

router.get("/categories", getActiveCategories);

export default router;  