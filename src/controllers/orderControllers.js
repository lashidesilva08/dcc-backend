import { PrismaClient } from "@prisma/client";
import emailService from "../services/email.service.js";
import notificationService from "../services/notification.service.js";

const prisma = new PrismaClient();

/**
 * Create Order
 * POST /api/orders
 */
export const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get logged-in user
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    /*
     * TODO:
     * Replace this section with your actual checkout/order creation logic.
     *
     * The important part is:
     * after the real order is successfully created,
     * call notificationService.orderPlaced().
     */

    const orderNumber = `ORD-${Date.now()}`;

    // --------------------------------------------------
    // TEMPORARY ORDER DATA
    // Replace this with your actual Prisma order creation.
    // --------------------------------------------------

    const order = {
      orderNumber,
      totalAmount: req.body.total || 0,
    };

    // --------------------------------------------------
    // SEND EMAIL
    // --------------------------------------------------

    try {
      await emailService.sendOrderConfirmation(user, {
        id: order.orderNumber,
        total: order.totalAmount,
      });

      console.log("✅ Order confirmation email sent");
    } catch (emailError) {
      console.error(
        "❌ Order confirmation email failed:",
        emailError
      );

      // Do not fail the order because email failed
    }

    // --------------------------------------------------
    // CREATE WEBSITE NOTIFICATION
    // --------------------------------------------------

    try {
      await notificationService.orderPlaced(
        user.id,
        order.orderNumber
      );

      console.log("✅ Order notification created");
    } catch (notificationError) {
      console.error(
        "❌ Order notification failed:",
        notificationError
      );
    }

    return res.status(201).json({
      success: true,
      message: "Order placed successfully.",
      orderId: order.orderNumber,
    });
  } catch (error) {
    console.error("Create Order Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create order.",
    });
  }
};

/**
 * Get My Orders
 * GET /api/orders/my-orders
 */
export const getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const orders = await prisma.order.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error("Get My Orders Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load orders.",
    });
  }
};

/**
 * Update Order Status
 * PATCH /api/orders/:id/status
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Order status is required.",
      });
    }

    const order = await prisma.order.findUnique({
      where: {
        id: Number(id),
      },
      include: {
        user: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    const updatedOrder = await prisma.order.update({
      where: {
        id: Number(id),
      },
      data: {
        status,
      },
      include: {
        user: true,
      },
    });

    // --------------------------------------------------
    // SEND ORDER STATUS EMAIL
    // --------------------------------------------------

    try {
      await emailService.sendOrderStatus(
        order.user,
        {
          id: order.orderNumber,
          status,
        }
      );

      console.log("✅ Order status email sent");
    } catch (emailError) {
      console.error(
        "❌ Order status email failed:",
        emailError
      );
    }

    // --------------------------------------------------
    // CREATE ORDER STATUS NOTIFICATION
    // --------------------------------------------------

    try {
      await notificationService.orderStatus(
        order.user.id,
        order.orderNumber,
        status
      );

      console.log("✅ Order status notification created");
    } catch (notificationError) {
      console.error(
        "❌ Order status notification failed:",
        notificationError
      );
    }

    return res.status(200).json({
      success: true,
      message: `Order ${id} status updated to ${status}`,
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Update Order Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update order status.",
    });
  }
};

/**
 * Get Seller Orders
 * GET /api/orders/seller
 */
export const getSellerOrders = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "Specific shop orders for seller",
    });
  } catch (error) {
    console.error("Get Seller Orders Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * Get Invoice
 * GET /api/orders/:id/invoice
 */
export const getInvoice = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "Invoice PDF link generated",
      downloadUrl: "http://...",
    });
  } catch (error) {
    console.error("Get Invoice Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate invoice.",
    });
  }
};

/**
 * Checkout
 * POST /api/orders/checkout
 */
export const checkout = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    /*
     * IMPORTANT:
     * Put your existing real checkout/order creation
     * logic here.
     *
     * After creating the real order, use:
     *
     * const order = await prisma.order.create(...)
     */

    const orderNumber = `ORD-${Date.now()}`;

    // TEMPORARY until your real checkout logic is connected
    const order = {
      orderNumber,
      totalAmount: req.body.total || 0,
    };

    // --------------------------------------------------
    // EMAIL
    // --------------------------------------------------

    try {
      await emailService.sendOrderConfirmation(user, {
        id: order.orderNumber,
        total: order.totalAmount,
      });

      console.log("✅ Checkout confirmation email sent");
    } catch (emailError) {
      console.error(
        "❌ Checkout email failed:",
        emailError
      );
    }

    // --------------------------------------------------
    // WEBSITE NOTIFICATION
    // --------------------------------------------------

    try {
      await notificationService.orderPlaced(
        user.id,
        order.orderNumber
      );

      console.log("✅ Checkout notification created");
    } catch (notificationError) {
      console.error(
        "❌ Checkout notification failed:",
        notificationError
      );
    }

    return res.status(201).json({
      success: true,
      message: "Order placed successfully.",
      orderId: order.orderNumber,
    });
  } catch (error) {
    console.error("Checkout Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to place order.",
    });
  }
};

/**
 * Get Order By ID
 * GET /api/orders/:id
 */
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: {
        id: Number(id),
      },
      include: {
        user: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Get Order Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve order.",
    });
  }
};

/**
 * Cancel Order
 * PATCH /api/orders/:id/cancel
 */
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await prisma.order.findFirst({
      where: {
        id: Number(id),
        userId,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    const updatedOrder = await prisma.order.update({
      where: {
        id: Number(id),
      },
      data: {
        status: "CANCELLED",
      },
    });

    // Create notification
    try {
      await notificationService.orderStatus(
        userId,
        order.orderNumber,
        "CANCELLED"
      );

      console.log("✅ Order cancellation notification created");
    } catch (notificationError) {
      console.error(
        "❌ Cancellation notification failed:",
        notificationError
      );
    }

    return res.status(200).json({
      success: true,
      message: "Order cancelled.",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Cancel Order Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel order.",
    });
  }
};

/**
 * Track Order
 * GET /api/orders/:id/track
 */
export const trackOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    return res.status(200).json({
      success: true,
      status: order.status,
    });
  } catch (error) {
    console.error("Track Order Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to track order.",
    });
  }
};