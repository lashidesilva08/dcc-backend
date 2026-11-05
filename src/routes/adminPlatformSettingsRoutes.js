import express from 'express'

import {
  getPlatformSettings,
  updatePlatformSettings,
  getCategoryCommissions,
  updateCategoryCommission,
  deleteCategoryCommission,
} from '../controllers/adminPlatformSettingsController.js'

import {
  getAdminAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../controllers/adminAnnouncementController.js'

import { adminAuth } from '../middleware/adminMiddleware.js'
import { uploadPlatformBanner } from '../middleware/platformBannerUpload.js'

const router = express.Router()

router.use(...adminAuth)

// General settings
router.get('/settings', getPlatformSettings)
router.put('/settings', updatePlatformSettings)

// Category commissions
router.get('/settings/commissions', getCategoryCommissions)

router.put(
  '/settings/commissions/:categoryId',
  updateCategoryCommission
)

router.delete(
  '/settings/commissions/:categoryId',
  deleteCategoryCommission
)

// Announcements and promotions
router.get('/announcements', getAdminAnnouncements)

router.post(
  '/announcements',
  uploadPlatformBanner,
  createAnnouncement
)

router.patch(
  '/announcements/:id',
  uploadPlatformBanner,
  updateAnnouncement
)

router.delete(
  '/announcements/:id',
  deleteAnnouncement
)

export default router