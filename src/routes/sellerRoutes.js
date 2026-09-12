import express from 'express'

import {
  getSellerMe,
  getSellerDashboard,
  getSellerProfileStatus,
  getSellerBankDetails,
  updateSellerBankDetails,
} from '../controllers/sellerControllers.js'

import {
  protect,
  requireRole,
} from '../middleware/auth.middleware.js'

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
// Seller approval status
// ---------------------------------------------------------

router.get('/status', getSellerProfileStatus)

// ---------------------------------------------------------
// Logged-in seller
// ---------------------------------------------------------

router.get('/me', getSellerMe)

// ---------------------------------------------------------
// Seller dashboard
// ---------------------------------------------------------

router.get('/dashboard', getSellerDashboard)

// ---------------------------------------------------------
// Seller payout bank details
// ---------------------------------------------------------

router.get('/bank-details', getSellerBankDetails)
router.put('/bank-details', updateSellerBankDetails)

export default router