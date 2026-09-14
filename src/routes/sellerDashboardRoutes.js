import express from 'express'

import {
  protect,
  requireRole,
} from '../middleware/auth.middleware.js'

import {
  getSellerDashboard,
} from '../controllers/sellerDashboardController.js'

import {
  getSellerMe,
} from '../controllers/sellerControllers.js'

const router = express.Router()

// ---------------------------------------------------------
// Authentication
// ---------------------------------------------------------

router.use(protect)

// ---------------------------------------------------------
// Seller role
// ---------------------------------------------------------

router.use(requireRole('SELLER'))

// ---------------------------------------------------------
// Seller profile
// ---------------------------------------------------------

router.get('/me', getSellerMe)

// ---------------------------------------------------------
// Seller dashboard
// ---------------------------------------------------------

router.get('/dashboard', getSellerDashboard)

export default router