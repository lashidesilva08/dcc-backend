import express from 'express'
import { protect, requireRole } from '../middleware/auth.js'
import {
  acceptJob,
  createDriver,
  deleteNotification,
  getAnalytics,
  getAssignedDeliveries,
  getDashboard,
  getDeliveryById,
  getDeliveryLive,
  getDrivers,
  getEarnings,
  getNotifications,
  getPoolDeliveries,
  getProviderSettings,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markDelivered,
  markNotificationRead,
  pickupOrder,
  registerProvider,
  trackPublic,
  updateDeliveryStatus,
  updateDriver,
  updateProviderSettings,
  updateTracking,
} from '../controllers/deliveryControllers.js'

const router = express.Router()
const deliveryRoles = requireRole('DELIVERY_PROVIDER', 'DELIVERY_DRIVER')

router.post('/register', registerProvider)
router.get('/track/:code', trackPublic)

router.use(protect)

router.get('/dashboard', deliveryRoles, getDashboard)
router.get('/assigned', deliveryRoles, getAssignedDeliveries)
router.get('/pool', deliveryRoles, getPoolDeliveries)
router.get('/earnings', deliveryRoles, getEarnings)
router.get('/analytics', deliveryRoles, getAnalytics)

router.get('/drivers', requireRole('DELIVERY_PROVIDER'), getDrivers)
router.post('/drivers', requireRole('DELIVERY_PROVIDER'), createDriver)
router.patch('/drivers/:id', deliveryRoles, updateDriver)

router.get('/settings', requireRole('DELIVERY_PROVIDER'), getProviderSettings)
router.put('/settings', requireRole('DELIVERY_PROVIDER'), updateProviderSettings)

router.get('/notifications', deliveryRoles, getNotifications)
router.get('/notifications/unread-count', deliveryRoles, getUnreadNotificationCount)
router.put('/notifications/read-all', deliveryRoles, markAllNotificationsRead)
router.put('/notifications/:id/read', deliveryRoles, markNotificationRead)
router.delete('/notifications/:id', deliveryRoles, deleteNotification)

router.get('/deliveries/:id/live', deliveryRoles, getDeliveryLive)
router.get('/deliveries/:id', deliveryRoles, getDeliveryById)
router.put('/deliveries/:id/status', deliveryRoles, updateDeliveryStatus)
router.patch('/deliveries/:id/track', deliveryRoles, updateTracking)
router.patch('/:id/track', deliveryRoles, updateTracking)

router.post('/:id/accept', deliveryRoles, acceptJob)
router.post('/:id/pickup', deliveryRoles, pickupOrder)
router.post('/:id/deliver', deliveryRoles, markDelivered)

export default router
