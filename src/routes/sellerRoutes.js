import express from 'express'

import {
  getMySellerProfile,
  getSellerDashboard,
} from '../controllers/sellerControllers.js'

import { protect } from '../middleware/auth.js'

import {
  requireSeller,
  requireApprovedSeller,
} from '../middleware/sellerMiddleware.js'

const router = express.Router()

/*
 * All seller routes require JWT.
 */
router.use(protect)

/*
 * Seller account information.
 *
 * Pending sellers can access this endpoint
 * so frontend can show their approval status.
 */
router.get(
  '/me',
  requireSeller,
  getMySellerProfile
)

/*
 * Seller dashboard.
 *
 * ONLY APPROVED SELLERS can access.
 */
router.get(
  '/dashboard',
  requireApprovedSeller,
  getSellerDashboard
)

export default router