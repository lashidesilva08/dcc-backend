import express from 'express'

import {
    getShopSettings,
    updateShopSettings,
} from '../controllers/sellerSettingsController.js'

import {
    protect,
    requireRole,
} from '../middleware/auth.middleware.js'

const router = express.Router()

// Dev5: Seller authentication
router.use(protect)
router.use(requireRole('SELLER'))

// GET /api/v1/seller/settings
router.get('/', getShopSettings)

// PUT /api/v1/seller/settings
router.put('/', updateShopSettings)

export default router