import prisma from "../config/prisma.js";
import emailService from "../services/email.service.js";
import notificationService from "../services/notification.service.js";
import { hydrateCart, clearCartItems } from "../services/cartService.js";

const VALID_ORDER_STATUSES = [
  "placed",
  "confirmed",
  "processing",
  "dispatched",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "payment_failed",
  "rejected",
];

/**
  Helper: Calculate delivery fee & totals
 */
function calculateOrderTotals(items, customDeliveryFee) {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  let deliveryFee = Number(customDeliveryFee);
  if (isNaN(deliveryFee) || deliveryFee < 0) {
    deliveryFee = subtotal >= 15000 ? 0 : 350;
  }
  const totalAmount = subtotal + deliveryFee;
  return { subtotal, deliveryFee, totalAmount };
}

/**
 * Create Order / Unified Checkout
 * POST /api/v1/orders/checkout
 * POST /api/v1/orders
 */
export const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { items: customItems, deliveryAddress, paymentMethod = "COD", notes, deliveryFee: rawDeliveryFee, deliveryMethod = "platform" } = req.body;

    if (!deliveryAddress || typeof deliveryAddress !== "string" || !deliveryAddress.trim()) {
      return res.status(400).json({
        success: false,
        message: "Delivery address is required.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    let orderLines = [];

    if (Array.isArray(customItems) && customItems.length > 0) {
      for (const item of customItems) {
        const variantId = Number(item.variantId);
        const quantity = Math.max(1, Number(item.quantity) || 1);

        if (!variantId) {
          return res.status(400).json({
            success: false,
            message: "Invalid product variant ID specified.",
          });
        }

        const variant = await prisma.productVariant.findUnique({
          where: { id: variantId },
          include: {
            listing: {
              include: { seller: true },
            },
          },
        });

        if (!variant || variant.status !== "active" || variant.listing?.status !== "active") {
          return res.status(400).json({
            success: false,
            message: `Product variant ID ${variantId} is not available.`,
          });
        }

        if (variant.stock < quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for product "${variant.listing.title}". Only ${variant.stock} available.`,
          });
        }

        orderLines.push({
          variantId: variant.id,
          listingId: variant.listingId,
          sellerId: variant.listing.sellerId,
          quantity,
          unitPrice: Number(variant.price),
          subtotal: Number(variant.price) * quantity,
          listingTitle: variant.listing.title,
        });
      }
    } else {
      // Checkout from Redis cart
      const cartData = await hydrateCart(userId);
      if (!cartData.items || cartData.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Your shopping cart is empty.",
        });
      }

      for (const cartItem of cartData.items) {
        if (cartItem.stock < cartItem.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for item "${cartItem.name}". Only ${cartItem.stock} available.`,
          });
        }

        orderLines.push({
          variantId: cartItem.variantId,
          listingId: cartItem.listingId,
          sellerId: cartItem.sellerId,
          quantity: cartItem.quantity,
          unitPrice: cartItem.unitPrice,
          subtotal: cartItem.lineTotal,
          listingTitle: cartItem.name,
        });
      }
    }

    if (orderLines.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No items available to process checkout.",
      });
    }

    const { deliveryFee, totalAmount } = calculateOrderTotals(orderLines, rawDeliveryFee);
    const orderNumber = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Execute atomic transaction for stock reservation and order creation
    const createdOrder = await prisma.$transaction(async (tx) => {
      // Create main Order
      const newOrder = await tx.order.create({
        data: {
          userId,
          orderNumber,
          totalAmount,
          deliveryFee,
          paymentMethod: String(paymentMethod).toUpperCase(),
          paymentStatus: String(paymentMethod).toUpperCase() === "CARD" ? "paid" : "pending",
          orderStatus: "placed",
          deliveryAddress,
          notes: notes ? String(notes).trim() : null,
          orderItems: {
            create: orderLines.map((line) => ({
              variantId: line.variantId,
              sellerId: line.sellerId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              subtotal: line.subtotal,
              itemStatus: "placed",
            })),
          },
        },
        include: {
          orderItems: {
            include: {
              variant: {
                include: {
                  listing: true,
                  images: true,
                },
              },
              seller: true,
            },
          },
        },
      });

      // Create initial Transaction record
      await tx.transaction.create({
        data: {
          orderId: newOrder.id,
          transactionReference: `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          paymentGateway: String(paymentMethod).toUpperCase(),
          amount: totalAmount,
          status: String(paymentMethod).toUpperCase() === "CARD" ? "completed" : "pending",
          paidAt: String(paymentMethod).toUpperCase() === "CARD" ? new Date() : null,
        },
      });

      // Create initial Delivery record
      await tx.delivery.create({
        data: {
          orderId: newOrder.id,
          pickupAddress: "Digital City Center Central Hub",
          deliveryAddress,
          deliveryStatus: "CONFIRMED",
          statusHistory: [
            { status: "CONFIRMED", timestamp: new Date().toISOString(), note: `Delivery initialized (${deliveryMethod})` },
          ],
        },
      });

      // Update variant stocks & listing sold counts
      for (const line of orderLines) {
        await tx.productVariant.update({
          where: { id: line.variantId },
          data: { stock: { decrement: line.quantity } },
        });

        await tx.listing.update({
          where: { id: line.listingId },
          data: { sold: { increment: line.quantity } },
        });
      }

      return newOrder;
    });

    // Clear cart if checkout came from cart
    if (!customItems || customItems.length === 0) {
      await clearCartItems(userId);
    }

    // Trigger emails & notifications asynchronously
    try {
      await emailService.sendOrderConfirmation(user, {
        id: createdOrder.orderNumber,
        total: createdOrder.totalAmount,
      });
    } catch (emailError) {
      console.error("Order confirmation email error:", emailError);
    }

    try {
      await notificationService.orderPlaced(user.id, createdOrder.orderNumber);

      // Notify sellers involved
      const sellerIds = [...new Set(orderLines.map((l) => l.sellerId).filter(Boolean))];
      const sellers = await prisma.seller.findMany({
        where: { id: { in: sellerIds } },
        select: { userId: true },
      });

      for (const seller of sellers) {
        if (seller.userId) {
          await notificationService.create({
            userId: seller.userId,
            title: "New Incoming Order",
            message: `You have a new item order in #${createdOrder.orderNumber}.`,
            type: "ORDER",
            link: `/seller/orders`,
          });
        }
      }
    } catch (notifError) {
      console.error("Order notification error:", notifError);
    }

    return res.status(201).json({
      success: true,
      message: "Order placed successfully.",
      orderId: createdOrder.orderNumber,
      order: createdOrder,
    });
  } catch (error) {
    console.error("Create Order Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create order.",
      error: error.message,
    });
  }
};

/**
 * Alias for checkout endpoint
 */
export const checkout = createOrder;

/**
 * Get My Orders (Buyer)
 * GET /api/v1/orders/my-orders
 */
export const getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const statusFilter = req.query.status ? String(req.query.status).toLowerCase() : null;

    const where = {
      userId,
      ...(statusFilter && VALID_ORDER_STATUSES.includes(statusFilter)
        ? { orderStatus: statusFilter }
        : {}),
    };

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          orderItems: {
            include: {
              variant: {
                include: {
                  listing: true,
                  images: true,
                },
              },
              seller: {
                select: { id: true, shopName: true, shopUrl: true, image: true },
              },
            },
          },
          delivery: true,
          transactions: true,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
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
 * Get Seller Orders
 * GET /api/v1/orders/seller-orders
 */
export const getSellerOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const statusFilter = req.query.status ? String(req.query.status).toLowerCase() : null;
    const searchQuery = req.query.search ? String(req.query.search).trim() : null;

    const seller = await prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      return res.status(403).json({
        success: false,
        message: "Seller profile not found for logged-in user.",
      });
    }

    const whereItem = {
      sellerId: seller.id,
      ...(statusFilter ? { itemStatus: statusFilter } : {}),
      ...(searchQuery
        ? {
            order: {
              orderNumber: { contains: searchQuery, mode: "insensitive" },
            },
          }
        : {}),
    };

    const [totalItems, orderItems] = await Promise.all([
      prisma.orderItem.count({ where: whereItem }),
      prisma.orderItem.findMany({
        where: whereItem,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          order: {
            include: {
              user: {
                select: { id: true, name: true, email: true, phone: true },
              },
              delivery: true,
            },
          },
          variant: {
            include: {
              listing: true,
              images: true,
            },
          },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      sellerId: seller.id,
      shopName: seller.shopName,
      items: orderItems,
      pagination: {
        total: totalItems,
        page,
        limit,
        totalPages: Math.ceil(totalItems / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Get Seller Orders Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while loading seller orders.",
    });
  }
};

/**
 * Get Order By ID
 * GET /api/v1/orders/:id
 */
export const getOrderById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const orderNumber = String(req.params.id);

    const where = !isNaN(id) ? { id } : { orderNumber };

    const order = await prisma.order.findUnique({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
        orderItems: {
          include: {
            variant: {
              include: {
                listing: true,
                images: true,
              },
            },
            seller: {
              select: { id: true, shopName: true, shopUrl: true, image: true, userId: true },
            },
          },
        },
        delivery: {
          include: {
            deliveryProvider: { select: { id: true, providerName: true, phone: true } },
            assignedDriver: { select: { id: true, fullName: true, phone: true, vehicleType: true } },
          },
        },
        transactions: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    // Security Check: Customer owner, Admin, or Seller of at least one item
    const isOwner = order.userId === req.user.id;
    const isAdmin = req.user.role === "ADMIN" || req.user.role === "SUPER_ADMIN";
    const isSeller = order.orderItems.some((item) => item.seller?.userId === req.user.id);

    if (!isOwner && !isAdmin && !isSeller) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this order.",
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
 * Update Main Order Status
 * PATCH /api/v1/orders/:id/status
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID.",
      });
    }

    const normalizedStatus = String(status || "").toLowerCase();

    if (!VALID_ORDER_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_ORDER_STATUSES.join(", ")}`,
      });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        orderItems: { include: { seller: true } },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    // Authorization: Admin or Seller involved in order
    const isAdmin = req.user.role === "ADMIN" || req.user.role === "SUPER_ADMIN";
    const isSeller = order.orderItems.some((item) => item.seller?.userId === req.user.id);

    if (!isAdmin && !isSeller) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only sellers or admins can update order status.",
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        orderStatus: normalizedStatus,
        paymentStatus: normalizedStatus === "delivered" ? "paid" : order.paymentStatus,
        orderItems: {
          updateMany: {
            where: { orderId: id },
            data: { itemStatus: normalizedStatus },
          },
        },
      },
      include: { user: true, orderItems: true },
    });

    // Send notifications & status email
    try {
      await emailService.sendOrderStatus(order.user, {
        id: order.orderNumber,
        status: normalizedStatus,
      });
    } catch (emailError) {
      console.error("Order status email failed:", emailError);
    }

    try {
      await notificationService.orderStatus(order.user.id, order.orderNumber, normalizedStatus);
    } catch (notificationError) {
      console.error("Order status notification failed:", notificationError);
    }

    return res.status(200).json({
      success: true,
      message: `Order #${order.orderNumber} status updated to ${normalizedStatus}.`,
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
 * Update Individual Order Item Status (Seller)
 * PATCH /api/v1/orders/items/:itemId/status
 */
export const updateOrderItemStatus = async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    const { status } = req.body;

    if (!itemId || isNaN(itemId)) {
      return res.status(400).json({ success: false, message: "Invalid item ID." });
    }

    const normalizedStatus = String(status || "").toLowerCase();
    if (!VALID_ORDER_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_ORDER_STATUSES.join(", ")}`,
      });
    }

    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: itemId },
      include: { order: { include: { user: true } } },
    });

    if (!orderItem) {
      return res.status(404).json({ success: false, message: "Order item not found." });
    }

    const isAdmin = req.user.role === "ADMIN" || req.user.role === "SUPER_ADMIN";
    if (!isAdmin && (!seller || orderItem.sellerId !== seller.id)) {
      return res.status(403).json({ success: false, message: "Unauthorized item modification." });
    }

    const updatedItem = await prisma.orderItem.update({
      where: { id: itemId },
      data: { itemStatus: normalizedStatus },
    });

    // If all items in this order now share this status, update main order status
    const siblingItems = await prisma.orderItem.findMany({
      where: { orderId: orderItem.orderId },
    });

    const allSameStatus = siblingItems.every((item) => item.itemStatus === normalizedStatus);
    if (allSameStatus) {
      await prisma.order.update({
        where: { id: orderItem.orderId },
        data: { orderStatus: normalizedStatus },
      });
    }

    try {
      await notificationService.orderStatus(
        orderItem.order.userId,
        orderItem.order.orderNumber,
        normalizedStatus
      );
    } catch (notifErr) {
      console.error("Item status notification error:", notifErr);
    }

    return res.status(200).json({
      success: true,
      message: `Item status updated to ${normalizedStatus}.`,
      item: updatedItem,
    });
  } catch (error) {
    console.error("Update Order Item Status Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update item status." });
  }
};

/**
 * Cancel Order
 * DELETE /api/v1/orders/:id
 * PATCH /api/v1/orders/:id/cancel
 */
export const cancelOrder = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user.id;

    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid order ID." });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: true,
        user: true,
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const isOwner = order.userId === userId;
    const isAdmin = req.user.role === "ADMIN" || req.user.role === "SUPER_ADMIN";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized to cancel this order." });
    }

    if (["dispatched", "out_for_delivery", "delivered", "cancelled"].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order in status "${order.orderStatus}".`,
      });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Update order status
      const updated = await tx.order.update({
        where: { id },
        data: {
          orderStatus: "cancelled",
          orderItems: {
            updateMany: {
              where: { orderId: id },
              data: { itemStatus: "cancelled" },
            },
          },
        },
      });

      // Restore stock for variants & update listing sold numbers
      for (const item of order.orderItems) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });

        // Get listingId from variant
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          select: { listingId: true },
        });

        if (variant) {
          await tx.listing.update({
            where: { id: variant.listingId },
            data: { sold: { decrement: Math.min(item.quantity, 0) } },
          });
        }
      }

      return updated;
    });

    try {
      await notificationService.orderStatus(order.userId, order.orderNumber, "CANCELLED");
    } catch (notifErr) {
      console.error("Cancellation notification failed:", notifErr);
    }

    return res.status(200).json({
      success: true,
      message: "Order has been cancelled and item stock restored.",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Cancel Order Error:", error);
    return res.status(500).json({ success: false, message: "Failed to cancel order." });
  }
};

/**
 * Track Order
 * GET /api/v1/orders/track/:id
 * GET /api/v1/orders/:id/track
 */
export const trackOrder = async (req, res) => {
  try {
    const rawId = req.params.id;
    const id = Number(rawId);

    const where = !isNaN(id) ? { id } : { orderNumber: String(rawId) };

    const order = await prisma.order.findUnique({
      where,
      include: {
        delivery: {
          include: {
            deliveryProvider: { select: { providerName: true, phone: true } },
            assignedDriver: { select: { fullName: true, phone: true, vehicleType: true } },
          },
        },
        orderItems: {
          include: {
            variant: { include: { listing: { select: { title: true } } } },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const timeline = [
      { status: "placed", label: "Order Placed", completed: true, timestamp: order.createdAt },
      {
        status: "confirmed",
        label: "Confirmed",
        completed: ["confirmed", "processing", "dispatched", "out_for_delivery", "delivered"].includes(order.orderStatus),
      },
      {
        status: "processing",
        label: "Processing",
        completed: ["processing", "dispatched", "out_for_delivery", "delivered"].includes(order.orderStatus),
      },
      {
        status: "dispatched",
        label: "Dispatched",
        completed: ["dispatched", "out_for_delivery", "delivered"].includes(order.orderStatus),
      },
      {
        status: "out_for_delivery",
        label: "Out for Delivery",
        completed: ["out_for_delivery", "delivered"].includes(order.orderStatus),
      },
      {
        status: "delivered",
        label: "Delivered",
        completed: order.orderStatus === "delivered",
      },
    ];

    return res.status(200).json({
      success: true,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      deliveryAddress: order.deliveryAddress,
      timeline,
      delivery: order.delivery || null,
      itemCount: order.orderItems.length,
      updatedAt: order.updatedAt,
    });
  } catch (error) {
    console.error("Track Order Error:", error);
    return res.status(500).json({ success: false, message: "Failed to track order." });
  }
};

/**
 * Get Invoice & Printable Summary
 * GET /api/v1/orders/:id/invoice
 */
export const getInvoice = async (req, res) => {
  try {
    const rawId = req.params.id;
    const id = Number(rawId);

    const where = !isNaN(id) ? { id } : { orderNumber: String(rawId) };

    const order = await prisma.order.findUnique({
      where,
      include: {
        user: { select: { name: true, email: true, phone: true } },
        orderItems: {
          include: {
            variant: { include: { listing: true } },
            seller: { select: { id: true, shopName: true, shopUrl: true, location: true } },
          },
        },
        transactions: true,
        delivery: true,
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const subtotal = order.orderItems.reduce((sum, item) => sum + item.subtotal, 0);

    const invoiceData = {
      invoiceNumber: `INV-${order.orderNumber}`,
      issueDate: order.createdAt,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      buyer: {
        name: order.user.name,
        email: order.user.email,
        phone: order.user.phone,
        deliveryAddress: order.deliveryAddress,
      },
      items: order.orderItems.map((item) => ({
        id: item.id,
        productName: item.variant.listing.title,
        sku: item.variant.sku,
        attributes: item.variant.attributes,
        sellerName: item.seller.shopName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      })),
      pricing: {
        subtotal,
        deliveryFee: order.deliveryFee,
        totalAmount: order.totalAmount,
        currency: "LKR",
      },
    };

    return res.status(200).json({
      success: true,
      message: "Invoice generated successfully.",
      invoice: invoiceData,
    });
  } catch (error) {
    console.error("Get Invoice Error:", error);
    return res.status(500).json({ success: false, message: "Failed to generate invoice." });
  }
};

/**
 * Admin: Get All Platform Orders
 * GET /api/v1/orders/all
 */
export const getAllOrders = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const statusFilter = req.query.status ? String(req.query.status).toLowerCase() : null;
    const searchQuery = req.query.search ? String(req.query.search).trim() : null;

    const where = {
      ...(statusFilter ? { orderStatus: statusFilter } : {}),
      ...(searchQuery
        ? {
            OR: [
              { orderNumber: { contains: searchQuery, mode: "insensitive" } },
              { deliveryAddress: { contains: searchQuery, mode: "insensitive" } },
              { user: { name: { contains: searchQuery, mode: "insensitive" } } },
              { user: { email: { contains: searchQuery, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          orderItems: {
            include: {
              seller: { select: { id: true, shopName: true } },
              variant: { select: { id: true, sku: true } },
            },
          },
          delivery: true,
          transactions: true,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Admin Get All Orders Error:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve platform orders." });
  }
};