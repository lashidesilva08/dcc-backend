
import express from 'express'

import {
  getSellerNotifications,
  getSellerUnreadNotificationCount,
  markSellerNotificationAsRead,
  markAllSellerNotificationsAsRead,
} from '../controllers/sellerNotificationController.js'

import {
  protect,
  requireRole,
} from '../middleware/auth.middleware.js'

const router = express.Router()


/*
 * GET /api/v1/seller/notifications
 *
 * Get all notifications for the logged-in seller.
 */
router.get(
  '/',
  protect,
  requireRole('SELLER'),
  getSellerNotifications
)


/*
 * GET /api/v1/seller/notifications/unread-count
 *
 * Get unread notification count.
 */
router.get(
  '/unread-count',
  protect,
  requireRole('SELLER'),
  getSellerUnreadNotificationCount
)


/*
 * PATCH /api/v1/seller/notifications/read-all
 *
 * Mark all seller notifications as read.
 *
 * IMPORTANT:
 * This route must be before /:id/read.
 */
router.patch(
  '/read-all',
  protect,
  requireRole('SELLER'),
  markAllSellerNotificationsAsRead
)


/*
 * PATCH /api/v1/seller/notifications/:id/read
 *
 * Mark one notification as read.
 */
router.patch(
  '/:id/read',
  protect,
  requireRole('SELLER'),
  markSellerNotificationAsRead
)


export default router

