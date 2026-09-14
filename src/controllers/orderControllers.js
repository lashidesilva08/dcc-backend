import prisma from "../config/prisma.js";
import crypto from "crypto";
import emailService from "../services/email.service.js";


// Helper: generate a unique order number like DCC-20260810-A3X9
function generateOrderNumber() {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `DCC-${datePart}-${randomPart}`;
}

// ─────────────────────────────────────────────
// 1. CHECKOUT (Create Order from Payload Items)
//    POST /api/v1/orders/checkout
//    Auth: Required
//
//    Expects req.body.items: [{ variantId, quantity }]
//    Prices and seller info are resolved server-side from DB.
// ─────────────────────────────────────────────
export const createOrder = async (req, res) => {
  res.status(201).json({ message: "Multi-vendor checkout processed", orderId: "ORD-99" });
};

export const getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Number(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          orderItems: {
            include: {
              variant: {
                include: {
                  images: { where: { isMain: true }, take: 1 },
                  listing: { select: { title: true } },
                },
              },
            },
          },
          transactions: {
            select: {
              status: true,
              paymentGateway: true,
              paidAt: true,
              transactionReference: true,
            },
          },
          delivery: {
            select: {
              deliveryStatus: true,
              trackingNumber: true,
            },
          },
        },
      }),
      prisma.order.count({ where: { userId } }),
    ]);

    return res.status(200).json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error("getMyOrders error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch orders." });
  }
};

// ─────────────────────────────────────────────
// 3. GET ORDER BY ID
//    GET /api/v1/orders/:id
//    Auth: Required
// ─────────────────────────────────────────────
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: Number(id) },
      include: {
        orderItems: {
          include: {
            variant: {
              include: {
                images: true,
                listing: { select: { id: true, title: true } },
              },
            },
            seller: { select: { id: true, shopName: true, shopUrl: true } },
          },
        },
        transactions: true,
        delivery: true,
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    // Allow access to the owner or admin
    if (order.userId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    return res.status(200).json({ success: true, order });

  } catch (error) {
    console.error("getOrderById error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch order." });
  }
};

// ─────────────────────────────────────────────
// 4. CANCEL ORDER
//    DELETE /api/v1/orders/:id
//    Auth: Required
// ─────────────────────────────────────────────
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({ where: { id: Number(id) } });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (order.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const cancellableStatuses = ["placed", "confirmed"];
    if (!cancellableStatuses.includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled. Current status: "${order.orderStatus}".`,
      });
    }

    // Cancel order and restore stock
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { orderStatus: "cancelled" },
      });

      // Restore stock for each item
      const orderItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
      for (const item of orderItems) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully.",
      orderId: order.id,
      orderNumber: order.orderNumber,
    });

  } catch (error) {
    console.error("cancelOrder error:", error);
    return res.status(500).json({ success: false, message: "Failed to cancel order." });
  }
};

// ─────────────────────────────────────────────
// 5. UPDATE ORDER STATUS (Seller / Admin)
//    PATCH /api/v1/orders/:id/status
//    Auth: Required (seller or admin)
// ─────────────────────────────────────────────
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["placed", "confirmed", "processing", "shipped", "delivered", "cancelled"];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const order = await prisma.order.findUnique({ where: { id: Number(id) } });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const updated = await prisma.order.update({
      where: { id: Number(id) },
      data: { orderStatus: status },
    });

    return res.status(200).json({
      success: true,
      message: `Order status updated to "${status}".`,
      orderId: updated.id,
      orderStatus: updated.orderStatus,
    });

  } catch (error) {
    console.error("updateOrderStatus error:", error);
    return res.status(500).json({ success: false, message: "Failed to update order status." });
  }
};

// ─────────────────────────────────────────────
// 6. GET SELLER ORDERS
//    GET /api/v1/orders/seller-orders
//    Auth: Required (seller)
// ─────────────────────────────────────────────
export const getSellerOrders = async (req, res) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });

    if (!seller) {
      return res.status(403).json({ success: false, message: "Seller account not found." });
    }

    const orders = await prisma.orderItem.findMany({
      where: { sellerId: seller.id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            paymentStatus: true,
            orderStatus: true,
            createdAt: true,
            deliveryAddress: true,
          },
        },
        variant: {
          include: {
            listing: { select: { id: true, title: true } },
            images: { where: { isMain: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ success: true, orders });

  } catch (error) {
    console.error("getSellerOrders error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch seller orders." });
  }
};

// ─────────────────────────────────────────────
// 6b. GET SELLER ORDER DETAILS
//     GET /api/v1/orders/seller-orders/:id
//     Auth: Required (seller)
//
//     Returns a single order scoped to the requesting seller:
//     buyer info, delivery info, payment method, and ONLY the
//     OrderItem rows that belong to this seller — never another
//     seller's items on the same multi-seller order.
// ─────────────────────────────────────────────
export const getSellerOrderById = async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (!Number.isInteger(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order ID." });
    }

    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) {
      return res.status(403).json({ success: false, message: "Seller account not found." });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        delivery: true,
        transactions: {
          select: {
            transactionReference: true,
            paymentGateway: true,
            status: true,
            paidAt: true,
          },
        },
        orderItems: {
          where: { sellerId: seller.id },
          include: {
            variant: {
              include: {
                images: true,
                listing: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    // Multi-seller safety: this seller must own at least one
    // item in the order, and only their own items are returned.
    if (!order.orderItems || order.orderItems.length === 0) {
      return res.status(403).json({
        success: false,
        message: "You cannot view this order because it does not contain your products.",
      });
    }

    const sellerSubtotal = order.orderItems.reduce((sum, i) => sum + Number(i.subtotal || 0), 0);

    return res.status(200).json({
      success: true,
      order: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        deliveryAddress: order.deliveryAddress,
        notes: order.notes,
        createdAt: order.createdAt,
        buyer: order.user,
        delivery: order.delivery,
        transaction: order.transactions || null,
        items: order.orderItems,
        sellerItemStatus: deriveSellerStatus(order.orderItems),
        sellerSubtotal,
        allowedNextStatuses:
          order.orderItems.length > 0 &&
            [...new Set(order.orderItems.map((i) => i.itemStatus))].length === 1
            ? SELLER_ITEM_STATUS_FLOW[order.orderItems[0].itemStatus] || []
            : [],
      },
    });

  } catch (error) {
    console.error("getSellerOrderById error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch order details." });
  }
};

export const getInvoice = async (req, res) => {
  res.status(200).json({ message: "Invoice PDF link generated", downloadUrl: "http://..." });
};

export const checkout = async (req, res) => {
  res.status(201).json({
    message: "Order placed successfully"
  });
};

export const getOrderById = async (req, res) => {
  res.status(200).json({
    message: "Order details retrieved"
  });
};

export const cancelOrder = async (req, res) => {
  res.status(200).json({
    message: "Order cancelled"
  });
};


export const trackOrder = async (req, res) => {
  res.status(200).json({
    status: "OUT_FOR_DELIVERY"
  });
};