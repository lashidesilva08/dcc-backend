import notificationService from "../services/notification.service.js";

/**
 * GET /api/notifications
 */
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const notifications =
      await notificationService.getUserNotifications(userId);

    res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    });

  } catch (error) {
    console.error("Get Notifications:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load notifications.",
    });
  }
};

/**
 * GET /api/notifications/unread
 */
export const getUnreadNotifications = async (req, res) => {
  try {

    const userId = req.user.id;

    const notifications =
      await notificationService.getUnreadNotifications(userId);

    res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to load unread notifications.",
    });

  }
};

/**
 * GET /api/notifications/count
 */
export const unreadCount = async (req, res) => {

  try {

    const count =
      await notificationService.unreadCount(req.user.id);

    res.status(200).json({
      success: true,
      unread: count,
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Unable to count notifications.",
    });

  }

};

/**
 * PATCH /api/notifications/:id/read
 */
export const markAsRead = async (req, res) => {

  try {

    await notificationService.markRead(
      req.params.id,
      req.user.id
    );

    res.status(200).json({
      success: true,
      message: "Notification marked as read.",
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Unable to update notification.",
    });

  }

};

/**
 * PATCH /api/notifications/read-all
 */
export const markAllRead = async (req, res) => {

  try {

    await notificationService.markAllRead(
      req.user.id
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Unable to update notifications.",
    });

  }

};

/**
 * DELETE /api/notifications/:id
 */
export const deleteNotification = async (req, res) => {

  try {

    await notificationService.delete(
      req.params.id,
      req.user.id
    );

    res.status(200).json({
      success: true,
      message: "Notification deleted.",
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Unable to delete notification.",
    });

  }

};