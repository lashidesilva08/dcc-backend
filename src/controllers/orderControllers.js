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
    orderStatus: status,
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

    const {
      items,
      deliveryAddress,
      deliveryMethod,
      paymentMethod,
      notes,
    } = req.body;

    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty.",
      });
    }

    if (!deliveryAddress) {
      return res.status(400).json({
        success: false,
        message: "Delivery address is required.",
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required.",
      });
    }

    // --------------------------------------------------
    // GET USER
    // --------------------------------------------------

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

    // --------------------------------------------------
    // GET PRODUCT VARIANTS
    // --------------------------------------------------

    const variantIds = items.map((item) =>
      Number(item.variantId)
    );

    const variants = await prisma.productVariant.findMany({
      where: {
        id: {
          in: variantIds,
        },
      },
      include: {
        listing: {
          include: {
            seller: true,
          },
        },
      },
    });

    // Make sure every requested variant exists
    if (variants.length !== variantIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more products are no longer available.",
      });
    }

    // --------------------------------------------------
    // VALIDATE STOCK + CALCULATE TOTAL
    // --------------------------------------------------

    let subtotal = 0;

    const orderItemsData = [];

    for (const item of items) {
      const variantId = Number(item.variantId);
      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid product quantity.",
        });
      }

      const variant = variants.find(
        (v) => v.id === variantId
      );

      if (!variant) {
        return res.status(400).json({
          success: false,
          message: `Product variant ${variantId} not found.`,
        });
      }

      if (variant.status !== "active") {
        return res.status(400).json({
          success: false,
          message: `${variant.listing.title} is no longer available.`,
        });
      }

      if (variant.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${variant.listing.title}. Available stock: ${variant.stock}.`,
        });
      }

      const itemSubtotal =
        variant.price * quantity;

      subtotal += itemSubtotal;

      orderItemsData.push({
        variantId: variant.id,
        sellerId: variant.listing.sellerId,
        quantity,
        unitPrice: variant.price,
        subtotal: itemSubtotal,
      });
    }

    // --------------------------------------------------
    // DELIVERY FEE
    // --------------------------------------------------

    // Adjust this according to your actual delivery rules.
    const deliveryFee =
      deliveryMethod === "pickup"
        ? 0
        : 300;

    const totalAmount =
      subtotal + deliveryFee;

    // --------------------------------------------------
    // ORDER NUMBER
    // --------------------------------------------------

    const orderNumber = `ORD-${Date.now()}`;

    // --------------------------------------------------
    // CREATE ORDER + ORDER ITEMS
    // --------------------------------------------------

    const order = await prisma.$transaction(
      async (tx) => {
        const createdOrder =
          await tx.order.create({
            data: {
              userId,
              orderNumber,
              totalAmount,
              deliveryFee,
              paymentMethod,
              paymentStatus:
                paymentMethod === "COD"
                  ? "pending"
                  : "pending",
              orderStatus: "placed",
              deliveryAddress,
              notes: notes || null,

              orderItems: {
                create: orderItemsData,
              },
            },

            include: {
              orderItems: true,
            },
          });

        // ------------------------------------------------
        // REDUCE STOCK
        // ------------------------------------------------

        for (const item of items) {
          const variantId =
            Number(item.variantId);

          const quantity =
            Number(item.quantity);

          await tx.productVariant.update({
            where: {
              id: variantId,
            },
            data: {
              stock: {
                decrement: quantity,
              },
            },
          });
        }

        // ------------------------------------------------
        // UPDATE LISTING SOLD COUNT
        // ------------------------------------------------

        for (const item of items) {
          const variant =
            variants.find(
              (v) =>
                v.id ===
                Number(item.variantId)
            );

          if (variant) {
            await tx.listing.update({
              where: {
                id: variant.listingId,
              },
              data: {
                sold: {
                  increment: Number(
                    item.quantity
                  ),
                },
              },
            });
          }
        }

        return createdOrder;
      }
    );

    // --------------------------------------------------
    // SEND ORDER CONFIRMATION EMAIL
    // --------------------------------------------------

    try {
      await emailService.sendOrderConfirmation(
        user,
        {
          id: order.orderNumber,
          total: order.totalAmount,
        }
      );

      console.log(
        "✅ Checkout confirmation email sent"
      );
    } catch (emailError) {
      console.error(
        "❌ Checkout email failed:",
        emailError
      );
    }

    // --------------------------------------------------
    // CREATE WEBSITE NOTIFICATION
    // --------------------------------------------------

    try {
      await notificationService.orderPlaced(
        user.id,
        order.orderNumber
      );

      console.log(
        "✅ Checkout notification created"
      );
    } catch (notificationError) {
      console.error(
        "❌ Checkout notification failed:",
        notificationError
      );
    }

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(201).json({
      success: true,
      message: "Order placed successfully.",

      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        subtotal,
        deliveryFee: order.deliveryFee,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
      },
    });
  } catch (error) {
    console.error(
      "Checkout Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to place order.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
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
        orderStatus: "CANCELLED",
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
      Status: order.orderStatus,
    });
  } catch (error) {
    console.error("Track Order Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to track order.",
    });
  }
};



/**
 * GET /api/notifications
 */
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const notifications =
      await notificationService.getUserNotifications(userId);

    return res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error("Get Notifications Error:", error);

    return res.status(500).json({
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

    return res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error("Get Unread Notifications Error:", error);

    return res.status(500).json({
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

    return res.status(200).json({
      success: true,
      unread: count,
    });
  } catch (error) {
    console.error("Unread Count Error:", error);

    return res.status(500).json({
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

    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
    });
  } catch (error) {
    console.error("Mark Notification Read Error:", error);

    return res.status(500).json({
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
    await notificationService.markAllRead(req.user.id);

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
    });
  } catch (error) {
    console.error("Mark All Notifications Read Error:", error);

    return res.status(500).json({
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

    return res.status(200).json({
      success: true,
      message: "Notification deleted.",
    });
  } catch (error) {
    console.error("Delete Notification Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete notification.",
    });
  }
};