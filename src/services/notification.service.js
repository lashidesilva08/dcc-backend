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
   * Get all notifications for a user
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
   * Count unread notifications
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
   * Order placed
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
   * Order status changed
   */
  async orderStatus(userId, orderNumber, status) {
  const normalizedStatus = String(status).toUpperCase();

  const messages = {
    PLACED: {
      title: "Order Placed 📦",
      message: `Your order #${orderNumber} has been placed successfully.`,
      type: "ORDER",
      link: `/orders/${orderNumber}`,
    },

    CONFIRMED: {
      title: "Order Confirmed ✅",
      message: `Your order #${orderNumber} has been confirmed.`,
      type: "ORDER",
      link: `/orders/${orderNumber}`,
    },

    PROCESSING: {
      title: "Order Processing 📦",
      message: `Your order #${orderNumber} is being prepared.`,
      type: "ORDER",
      link: `/orders/${orderNumber}`,
    },

    SHIPPED: {
      title: "Order Shipped 🚚",
      message: `Your order #${orderNumber} has been shipped.`,
      type: "DELIVERY",
      link: `/orders/${orderNumber}/track`,
    },

    OUT_FOR_DELIVERY: {
      title: "Out for Delivery 🛵",
      message: `Your order #${orderNumber} is out for delivery.`,
      type: "DELIVERY",
      link: `/orders/${orderNumber}/track`,
    },

    DELIVERED: {
      title: "Order Delivered 🎉",
      message: `Your order #${orderNumber} has been delivered successfully.`,
      type: "DELIVERY",
      link: `/orders/${orderNumber}`,
    },

    CANCELLED: {
      title: "Order Cancelled ❌",
      message: `Your order #${orderNumber} has been cancelled.`,
      type: "ORDER",
      link: `/orders/${orderNumber}`,
    },

    REFUNDED: {
      title: "Refund Processed 💰",
      message: `Your refund for order #${orderNumber} has been processed.`,
      type: "PAYMENT",
      link: `/orders/${orderNumber}`,
    },
  };

  const notification = messages[normalizedStatus] || {
    title: "Order Updated",
    message: `Your order #${orderNumber} status is now ${normalizedStatus}.`,
    type: "ORDER",
    link: `/orders/${orderNumber}`,
  };

  return await this.create({
    userId,
    ...notification,
  });
}

  /**
   * Seller approved
   */
  async sellerApproved(userId) {
    return await this.create({
      userId,
      title: "Seller Approved",
      message: "Congratulations! Your seller account has been approved.",
      type: "SELLER",
      link: "/seller/dashboard",
    });
  }

  /**
   * Seller rejected
   */
  async sellerRejected(userId) {
    return await this.create({
      userId,
      title: "Seller Application",
      message: "Unfortunately your seller application has been rejected.",
      type: "SELLER",
      link: "/seller",
    });
  }


  /**
 * Product added to cart
 */
async cartAdded(userId, productName, productId = null) {
  return await this.create({
    userId,
    title: "Added to Cart 🛒",
    message: `${productName} has been added to your cart.`,
    type: "CART",
    link: productId ? `/products/${productId}` : "/cart",
  });
}

/**
 * Payment successful
 */
async paymentSuccess(userId, orderNumber, amount) {
  return await this.create({
    userId,
    title: "Payment Successful 💳",
    message: `Payment of LKR ${Number(amount).toLocaleString()} for order #${orderNumber} was successful.`,
    type: "PAYMENT",
    link: `/orders/${orderNumber}`,
  });
}

/**
 * Payment failed
 */
async paymentFailed(userId, orderNumber) {
  return await this.create({
    userId,
    title: "Payment Failed ❌",
    message: `Your payment for order #${orderNumber} could not be completed. Please try again.`,
    type: "PAYMENT",
    link: `/orders/${orderNumber}`,
  });
}

/**
 * Order confirmed
 */
async orderConfirmed(userId, orderNumber) {
  return await this.create({
    userId,
    title: "Order Confirmed 📦",
    message: `Your order #${orderNumber} has been confirmed.`,
    type: "ORDER",
    link: `/orders/${orderNumber}`,
  });
}

/**
 * Order processing
 */
async orderProcessing(userId, orderNumber) {
  return await this.create({
    userId,
    title: "Order Processing 📦",
    message: `Your order #${orderNumber} is now being prepared.`,
    type: "ORDER",
    link: `/orders/${orderNumber}`,
  });
}

/**
 * Order shipped
 */
async orderShipped(userId, orderNumber) {
  return await this.create({
    userId,
    title: "Order Shipped 🚚",
    message: `Your order #${orderNumber} has been shipped.`,
    type: "DELIVERY",
    link: `/orders/${orderNumber}/track`,
  });
}

/**
 * Out for delivery
 */
async outForDelivery(userId, orderNumber) {
  return await this.create({
    userId,
    title: "Out for Delivery 🛵",
    message: `Your order #${orderNumber} is out for delivery.`,
    type: "DELIVERY",
    link: `/orders/${orderNumber}/track`,
  });
}

/**
 * Order delivered
 */
async orderDelivered(userId, orderNumber) {
  return await this.create({
    userId,
    title: "Order Delivered ✅",
    message: `Your order #${orderNumber} has been delivered successfully.`,
    type: "DELIVERY",
    link: `/orders/${orderNumber}`,
  });
}

/**
 * Refund processed
 */
async refundProcessed(userId, orderNumber, amount) {
  return await this.create({
    userId,
    title: "Refund Processed 💰",
    message: `Your refund of LKR ${Number(amount).toLocaleString()} for order #${orderNumber} has been processed.`,
    type: "PAYMENT",
    link: `/orders/${orderNumber}`,
  });
}

/**
 * Review reminder
 */
async reviewReminder(userId, orderNumber) {
  return await this.create({
    userId,
    title: "How was your order? ⭐",
    message: `Your order #${orderNumber} was delivered. Share your experience by leaving a review.`,
    type: "REVIEW",
    link: `/orders/${orderNumber}/review`,
  });
}

/**
 * Seller receives a new order
 */
async sellerNewOrder(userId, orderNumber) {
  return await this.create({
    userId,
    title: "New Order Received 🛍️",
    message: `You have received a new order #${orderNumber}.`,
    type: "SELLER",
    link: `/seller/orders`,
  });
}

/**
 * Seller receives payment
 */
async sellerPaymentReceived(userId, orderNumber, amount) {
  return await this.create({
    userId,
    title: "Payment Received 💰",
    message: `Payment for order #${orderNumber} has been received.`,
    type: "SELLER",
    link: `/seller/orders`,
  });
}

/**
 * New product review
 */
async newReview(userId, productName) {
  return await this.create({
    userId,
    title: "New Product Review ⭐",
    message: `Your product "${productName}" received a new review.`,
    type: "REVIEW",
    link: "/seller/products",
  });
}

/**
 * Promotion / announcement
 */
async announcement(userId, title, message, link = "/") {
  return await this.create({
    userId,
    title,
    message,
    type: "PROMOTION",
    link,
  });
}

  /**
   * Welcome notification
   */
  async welcome(userId) {
    return await this.create({
      userId,
      title: "Welcome",
      message: "Welcome to Digital City Center.",
      type: "ACCOUNT",
      link: "/account",
    });
  }
}

export default new NotificationService();