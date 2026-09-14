
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * GET /api/v1/seller/notifications
 *
 * Get all notifications for the logged-in seller.
 */
export const getSellerNotifications = async (req, res) => {
  try {
    const userId = req.user.id

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    })
  } catch (error) {
    console.error('Get seller notifications error:', error)

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
    })
  }
}


/**
 * GET /api/v1/seller/notifications/unread-count
 *
 * Get the number of unread notifications.
 */
export const getSellerUnreadNotificationCount = async (req, res) => {
  try {
    const userId = req.user.id

    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    })

    return res.status(200).json({
      success: true,
      unreadCount,
    })
  } catch (error) {
    console.error(
      'Get seller unread notification count error:',
      error
    )

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch unread notification count',
    })
  }
}


/**
 * PATCH /api/v1/seller/notifications/:id/read
 *
 * Mark one notification as read.
 */
export const markSellerNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user.id
    const notificationId = req.params.id

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: 'Notification ID is required',
      })
    }

    // Make sure the notification belongs to this seller.
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    })

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      })
    }

    const updatedNotification = await prisma.notification.update({
      where: {
        id: notificationId,
      },
      data: {
        isRead: true,
      },
    })

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification: updatedNotification,
    })
  } catch (error) {
    console.error(
      'Mark seller notification as read error:',
      error
    )

    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
    })
  }
}


/**
 * PATCH /api/v1/seller/notifications/read-all
 *
 * Mark all notifications belonging to the logged-in seller as read.
 */
export const markAllSellerNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id

    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    })

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      updatedCount: result.count,
    })
  } catch (error) {
    console.error(
      'Mark all seller notifications as read error:',
      error
    )

    return res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
    })
  }
}
