import express from 'express';
import { getBanners, getFeaturedShops, updateHeroBanner,getActiveFlashSale, getActiveCategories} from '../controllers/homepageControllers.js';
import {
  getPublicAnnouncements,
} from '../controllers/adminAnnouncementController.js'

const router = express.Router();

router.get("/banners", getBanners);
router.put("/banners", updateHeroBanner); // Admin Only

router.get("/categories", getActiveCategories);
router.get("/featured", getFeaturedShops);
router.get("/flash-sale", getActiveFlashSale);

router.get('/announcements', getPublicAnnouncements)


export default router;   