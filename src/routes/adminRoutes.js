import express from 'express'

import {
  getSalesReport,
  approveDeliveryProvider,
  rejectDeliveryProvider,
} from '../controllers/adminControllers.js'

import { getAdminDashboard } from '../controllers/adminDashboardController.js'
import adminPlatformSettingsRoutes from './adminPlatformSettingsRoutes.js'
import {
  listSellers,
  getPendingSellers,
  getSellerById,
  updateSellerStatus,
  approveSeller,
  rejectSeller,
  suspendSeller,
} from '../controllers/adminSellerController.js'

import {
  getAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  setAdminCategoryStatus,
} from '../controllers/adminCategoryController.js'

import {
  listAdminOrders,
  getAdminOrderById,
  overrideOrderStatus,
  overridePaymentStatus,
  assignOrderDelivery,
  getSellerFilterOptions,
  getBuyerFilterOptions,
  getDeliveryProviderOptions,
} from '../controllers/adminOrderController.js'

import {
  listDisputes,
  getDisputeById,
  openDispute,
  updateDisputeStatus,
  resolveDispute,
} from '../controllers/adminDisputeController.js'

import { uploadCategoryIcon } from '../middleware/categoryIconUpload.js'
import { adminAuth } from '../middleware/adminMiddleware.js'

import {
  getDeliveryProviders,
  updateDeliveryProvider,
  getUnassignedDeliveries,
  assignDelivery,
} from '../controllers/adminDeliveryController.js'

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

/* Category management (JSON or multipart with optional `iconFile`) */
router.get('/categories', getAdminCategories)
router.post('/categories', uploadCategoryIcon, createAdminCategory)
router.patch('/categories/:id/status', setAdminCategoryStatus) // keep above /categories/:id
router.patch('/categories/:id', uploadCategoryIcon, updateAdminCategory)

/* Order management — lookup routes must stay above /orders/:id */
router.get('/orders', listAdminOrders)
router.get('/orders/filters/sellers', getSellerFilterOptions)
router.get('/orders/filters/buyers', getBuyerFilterOptions)
router.get('/orders/filters/delivery-providers', getDeliveryProviderOptions)
router.get('/orders/:id', getAdminOrderById)
router.patch('/orders/:id/status', overrideOrderStatus)
router.patch('/orders/:id/payment-status', overridePaymentStatus)
router.post('/orders/:id/delivery', assignOrderDelivery)
router.post('/orders/:id/disputes', openDispute)

/* Dispute handling */
router.get('/disputes', listDisputes)
router.get('/disputes/:id', getDisputeById)
router.patch('/disputes/:id/status', updateDisputeStatus)
router.post('/disputes/:id/resolve', resolveDispute)

/* Other admin features (unchanged) */
router.get('/reports/sales', getSalesReport)

/* --------------------------------------------------
   DELIVERY PROVIDER MANAGEMENT
-------------------------------------------------- */

router.get(
  '/delivery-providers',
  getDeliveryProviders
)

router.patch(
  '/delivery-providers/:id',
  updateDeliveryProvider
)

/* --------------------------------------------------
   MANUAL DELIVERY ASSIGNMENT
-------------------------------------------------- */

router.get(
  '/deliveries',
  getUnassignedDeliveries
)

router.post(
  '/deliveries/assign',
  assignDelivery
)

router.use('/', adminPlatformSettingsRoutes)

export default router