import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

class NotificationService {

  /**
   * Create notification
   */
  async create({
    userId,
    title,
    message,
    type = "GENERAL",
    link = null,
  }) {

    return await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link,
      },
    });

  }

  /**
   * Get notifications of a user
   */
  async getUserNotifications(userId) {

    return await prisma.notification.findMany({

      where: {
        userId,
      },

      orderBy: {
        createdAt: "desc",
      },

    });

  }

  /**
   * Get unread notifications
   */
  async getUnreadNotifications(userId) {

    return await prisma.notification.findMany({

      where: {
        userId,
        isRead: false,
      },

      orderBy: {
        createdAt: "desc",
      },

    });

  }

  /**
   * Count unread
   */
  async unreadCount(userId) {

    return await prisma.notification.count({

      where: {
        userId,
        isRead: false,
      },

    });

  }

  /**
   * Mark one notification as read
   */
  async markRead(id, userId) {

    return await prisma.notification.updateMany({

      where: {
        id,
        userId,
      },

      data: {
        isRead: true,
      },

    });

  }

  /**
   * Mark all notifications as read
   */
  async markAllRead(userId) {

    return await prisma.notification.updateMany({

      where: {
        userId,
        isRead: false,
      },

      data: {
        isRead: true,
      },

    });

  }

  /**
   * Delete notification
   */
  async delete(id, userId) {

    return await prisma.notification.deleteMany({

      where: {
        id,
        userId,
      },

    });

  }

  /**
   * Create Order Notification
   */
  async orderPlaced(userId, orderId) {

    return await this.create({

      userId,

      title: "Order Placed",

      message: `Your order #${orderId} has been placed successfully.`,

      type: "ORDER",

      link: `/orders/${orderId}`,

    });

  }

  /**
   * Order Status Changed
   */
  async orderStatus(userId, orderId, status) {

    return await this.create({

      userId,

      title: "Order Updated",

      message: `Your order #${orderId} is now ${status}.`,

      type: "ORDER",

      link: `/orders/${orderId}`,

    });

  }

  /**
   * Seller Approved
   */
  async sellerApproved(userId) {

    return await this.create({

      userId,

      title: "Seller Approved",

      message:
        "Congratulations! Your seller account has been approved.",

      type: "SELLER",

      link: "/seller/dashboard",

    });

  }

  /**
   * Seller Rejected
   */
  async sellerRejected(userId) {

    return await this.create({

      userId,

      title: "Seller Application",

      message:
        "Unfortunately your seller application has been rejected.",

      type: "SELLER",

      link: "/seller",

    });

  }

  /**
   * Welcome Notification
   */
  async welcome(userId) {

    return await this.create({

      userId,

      title: "Welcome",

      message:
        "Welcome to Digital City Center.",

      type: "ACCOUNT",

      link: "/account",

    });

  }

}

export default new NotificationService();