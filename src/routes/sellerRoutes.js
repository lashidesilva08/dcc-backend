
import express from 'express'

import {
  getSellerMe,
  getSellerDashboard,
} from '../controllers/sellerControllers.js'

import {
  protect,
  requireRole,
} from '../middleware/auth.middleware.js'

const router = express.Router()

// Authentication required for all seller routes
router.use(protect)

// Only SELLER accounts can access these routes
router.use(requireRole('SELLER'))

// Logged-in seller information / approval status
router.get('/me', getSellerMe)

// Seller dashboard
router.get('/dashboard', getSellerDashboard)

export default router

