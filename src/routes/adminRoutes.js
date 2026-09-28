import express from 'express'

import {
  getSalesReport,
  getDisputes,
  getAllOrders,
  getDeliveryProviders,
  approveDeliveryProvider,
  rejectDeliveryProvider,
} from '../controllers/adminControllers.js'

import { getAdminDashboard } from '../controllers/adminDashboardController.js'

import {
  listSellers,
  getPendingSellers,
  getSellerById,
  updateSellerStatus,
  approveSeller,
  rejectSeller,
  suspendSeller,
} from '../controllers/Adminsellercontroller.js'

import { adminAuth } from '../middleware/Adminmiddleware.js'

const router = express.Router()

// Every route below requires a valid JWT and an admin role.
router.use(...adminAuth)

/* Dashboard */
router.get('/dashboard', getAdminDashboard)
router.get('/getdashboarddata', getAdminDashboard) // legacy alias

/* Seller management */
router.get('/sellers', listSellers)
router.get('/sellers/pending', getPendingSellers) // must stay above /sellers/:id
router.get('/sellers/:id', getSellerById)
router.patch('/sellers/:id/status', updateSellerStatus)

// Legacy per-action endpoints (same logic as PATCH /:id/status)
router.patch('/sellers/:id/approve', approveSeller)
router.patch('/sellers/:id/reject', rejectSeller)
router.patch('/sellers/:id/suspend', suspendSeller)

/* Other admin features (unchanged) */
router.get('/reports/sales', getSalesReport)
router.get('/disputes', getDisputes)
router.get('/orders', getAllOrders)

router.get('/delivery-providers', getDeliveryProviders)
router.put('/delivery-providers/:id/approve', approveDeliveryProvider)
router.put('/delivery-providers/:id/reject', rejectDeliveryProvider)

export default router