import express from 'express';
import { getBanners, getFeaturedShops, updateHeroBanner } from '../controllers/homepageControllers.js';

const router = express.Router();

router.get("/banners", getBanners);
router.get("/featured", getFeaturedShops);
router.put("/banners", updateHeroBanner); // Admin Only

export default router;