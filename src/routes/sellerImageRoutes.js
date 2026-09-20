import express from 'express'
import {
    uploadShopLogo,
    uploadShopBanner,
    removeShopLogo,
    removeShopBanner,
} from '../controllers/sellerImageController.js'

import {
    protect,
    requireRole,
} from '../middleware/auth.middleware.js'

import { sellerImageUpload } from '../middleware/sellerImageUpload.js'

const router = express.Router()

router.use(protect)
router.use(requireRole('SELLER'))

// D5-07 — Shop Logo
router.post(
    '/logo',
    sellerImageUpload.single('logo'),
    uploadShopLogo
)

// D5-08 — Shop Banner
router.post(
    '/banner',
    sellerImageUpload.single('banner'),
    uploadShopBanner
)

//  Remove Shop Logo
router.delete(
    '/logo',
    removeShopLogo
)

//  Remove Shop Banner
router.delete(
    '/banner',
    removeShopBanner
)

export default router