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
// Seller order-item status machine
//
// A seller only ever manages the OrderItem rows
// that belong to them (never another seller's rows
// in the same multi-seller order, and never fields
// on the parent Order itself).
//
// Key -> array of itemStatus values that are legal
// "next steps" from that key.
// ─────────────────────────────────────────────
export const SELLER_ITEM_STATUS_FLOW = {
    placed: ["confirmed", "rejected"],
    confirmed: ["processing", "rejected"],
    processing: ["ready_for_pickup", "dispatched"],
    ready_for_pickup: ["dispatched"],
    dispatched: [],   // handed to courier — handled by the delivery module from here
    rejected: [],     // terminal
    cancelled: [],    // terminal (buyer/admin cancelled)
};

const SELLER_MANAGEABLE_STATUSES = Object.keys(SELLER_ITEM_STATUS_FLOW);

function isValidSellerTransition(currentStatus, nextStatus) {
    const allowedNext = SELLER_ITEM_STATUS_FLOW[currentStatus];
    if (!allowedNext) return false; // unknown current status, e.g. legacy value
    return allowedNext.includes(nextStatus);
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
    try {
        const userId = req.user.id;
        const { items: rawItems, deliveryAddress, notes, paymentMethod } = req.body;

        if (!deliveryAddress) {
            return res.status(400).json({ success: false, message: "Delivery address is required." });
        }

        // 1. Validate payload items
        if (!Array.isArray(rawItems) || rawItems.length === 0) {
            return res.status(400).json({ success: false, message: "No items provided. Please send an items array in the request body." });
        }

        const variantIds = rawItems.map((i) => Number(i.variantId)).filter((id) => Number.isInteger(id) && id > 0);
        if (variantIds.length !== rawItems.length) {
            return res.status(400).json({ success: false, message: "Each item must have a valid variantId." });
        }

        // 2. Hydrate items from DB (fetch live prices, stock, seller info)
        const variants = await prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            include: {
                listing: {
                    include: {
                        seller: { select: { id: true, shopName: true } },
                    },
                },
            },
        });

        const variantMap = new Map(variants.map((v) => [v.id, v]));

        const items = [];
        for (const raw of rawItems) {
            const variantId = Number(raw.variantId);
            const quantity = Math.max(1, Math.floor(Number(raw.quantity) || 1));
            const variant = variantMap.get(variantId);

            if (!variant) {
                return res.status(400).json({ success: false, message: `Variant ID ${variantId} not found.` });
            }
            if (variant.status !== "active") {
                return res.status(400).json({ success: false, message: `Variant "${variant.sku || variantId}" is not available.` });
            }
            if (variant.listing?.status !== "active") {
                return res.status(400).json({ success: false, message: `Product "${variant.listing?.title || variantId}" is not available.` });
            }

            const unitPrice = Number(variant.price) || 0;
            const stock = Number(variant.stock) || 0;
            const sellerId = variant.listing?.seller?.id || null;

            items.push({
                variantId,
                quantity,
                unitPrice,
                lineTotal: unitPrice * quantity,
                stock,
                name: variant.listing?.title || "Product",
                sellerId,
            });
        }

        // 3. Check stock availability for all items
        for (const item of items) {
            if (item.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for "${item.name}". Only ${item.stock} left.`,
                });
            }
        }

        // 4. Compute order totals
        const FREE_DELIVERY_THRESHOLD = 15000;
        const DEFAULT_DELIVERY_FEE = 350;
        const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
        const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DEFAULT_DELIVERY_FEE;
        const total = subtotal + deliveryFee;

        const orderNumber = generateOrderNumber();

        // 5. Create order atomically in a Prisma transaction
        const order = await prisma.$transaction(async (tx) => {
            // Create the Order
            const newOrder = await tx.order.create({
                data: {
                    userId,
                    orderNumber,
                    totalAmount: total,
                    deliveryFee,
                    paymentMethod: paymentMethod === "COD" ? "COD" : "PENDING",
                    paymentStatus: "pending",
                    orderStatus: "placed",
                    deliveryAddress,
                    notes: notes || null,
                    orderItems: {
                        create: items.map((item) => ({
                            variantId: item.variantId,
                            sellerId: item.sellerId,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            subtotal: item.lineTotal,
                            itemStatus: "placed",
                        })),
                    },
                },
                include: {
                    orderItems: true,
                    user: true,
                },
            });

            // Deduct stock from each ProductVariant
            for (const item of items) {
                await tx.productVariant.update({
                    where: { id: item.variantId },
                    data: { stock: { decrement: item.quantity } },
                });
            }

            // Create a pending Transaction record
            await tx.transaction.create({
                data: {
                    orderId: newOrder.id,
                    transactionReference: paymentMethod === "COD" ? `COD-${orderNumber}` : `TXN-${orderNumber}`,
                    paymentGateway: paymentMethod === "COD" ? "COD" : "PENDING",
                    amount: total,
                    currency: "LKR",
                    status: "pending",
                },
            });

            return newOrder;
        });

        // Send order confirmation email asynchronously for COD orders
        if (paymentMethod === "COD" && order.user) {
            emailService.sendOrderConfirmation(order.user, {
                id: order.orderNumber,
                total: order.totalAmount,
            }).catch((err) => console.error("Error sending COD checkout order confirmation email:", err));
        }

        return res.status(201).json({
            success: true,
            message: "Order placed successfully. Proceed to payment.",
            orderId: order.id,
            orderNumber: order.orderNumber,
            totalAmount: total,
            deliveryFee,
            itemCount: items.length,
        });

    } catch (error) {
        console.error("createOrder error:", error);
        return res.status(500).json({ success: false, message: "Failed to create order.", error: error.message });
    }
};

// ─────────────────────────────────────────────
// 2. GET MY ORDERS
//    GET /api/v1/orders/my-orders
//    Auth: Required
// ─────────────────────────────────────────────
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

export const updateOrderStatus =
  async (req, res) => {
    try {
      const orderId =
        Number(req.params.id)

      const { status } =
        req.body

      const validStatuses = [
        'placed',
        'confirmed',
        'processing',
        'ready_for_pickup',
        'dispatched',
        'shipped',
        'delivered',
        'cancelled',
        'rejected',
      ]

      if (
        !Number.isInteger(orderId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid order ID.',
        })
      }

      if (
        !status ||
        !validStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Invalid status. Allowed statuses: ${validStatuses.join(', ')}`,
        })
      }

      /*
       * ADMIN
       *
       * Admin can manage the full order.
       */
      if (
        String(
          req.user.role
        ).toUpperCase() ===
        'ADMIN'
      ) {
        const order =
          await prisma.order.findUnique(
            {
              where: {
                id: orderId,
              },
            }
          )

        if (!order) {
          return res.status(404).json({
            success: false,
            message:
              'Order not found.',
          })
        }

        const updated =
          await prisma.order.update(
            {
              where: {
                id: orderId,
              },

              data: {
                orderStatus:
                  status,
              },
            }
          )

        return res.status(200).json({
          success: true,
          message:
            `Order status updated to "${status}".`,
          orderId:
            updated.id,
          orderStatus:
            updated.orderStatus,
        })
      }

      /*
       * SELLER
       */
      if (
        String(
          req.user.role
        ).toUpperCase() !==
        'SELLER'
      ) {
        return res.status(403).json({
          success: false,
          message:
            'Only sellers or admins can update order status.',
        })
      }

      const seller =
        await prisma.seller.findUnique(
          {
            where: {
              userId:
                req.user.id,
            },
          }
        )

      if (!seller) {
        return res.status(403).json({
          success: false,
          message:
            'Seller account not found.',
        })
      }

      /*
       * Check whether this seller owns
       * at least one OrderItem in this order.
       *
       * IMPORTANT: this query is always scoped by
       * `sellerId: seller.id` — a seller can never see or
       * touch another seller's OrderItem rows, even inside
       * the same multi-seller order.
       */
      const sellerItems =
        await prisma.orderItem.findMany(
          {
            where: {
              orderId,
              sellerId:
                seller.id,
            },

            select: {
              id: true,
              itemStatus: true,
            },
          }
        )

      if (
        sellerItems.length === 0
      ) {
        return res.status(403).json({
          success: false,
          message:
            'You cannot manage this order because it does not contain your products.',
        })
      }

      // Sellers may only drive their items through the
      // seller-facing status machine (not "shipped"/"delivered",
      // which belong to the delivery module/admin).
      if (!SELLER_MANAGEABLE_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Sellers cannot set status to "${status}". Allowed values: ${SELLER_MANAGEABLE_STATUSES.join(', ')}`,
        })
      }

      // All of this seller's items in the order should be at
      // the same stage before a bulk transition is applied.
      const currentStatuses = [
        ...new Set(sellerItems.map((item) => item.itemStatus)),
      ]

      if (currentStatuses.length > 1) {
        return res.status(409).json({
          success: false,
          message:
            'Your items in this order are at different stages. Please refresh and update them individually.',
          currentStatuses,
        })
      }

      const currentStatus = currentStatuses[0]

      if (!isValidSellerTransition(currentStatus, status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot change status from "${currentStatus}" to "${status}".`,
          allowedNext: SELLER_ITEM_STATUS_FLOW[currentStatus] || [],
        })
      }

      /*
       * IMPORTANT:
       *
       * Update seller's OrderItems,
       * NOT the complete Order.
       *
       * This protects multi-seller orders.
       */
      await prisma.orderItem.updateMany(
        {
          where: {
            orderId,
            sellerId:
              seller.id,
          },

          data: {
            itemStatus:
              status,
          },
        }
      )

      return res.status(200).json({
        success: true,

        message:
          `Your order items have been updated to "${status}".`,

        orderId,

        sellerId:
          seller.id,

        itemStatus:
          status,
      })
    } catch (error) {
      console.error(
        'updateOrderStatus error:',
        error
      )

      return res.status(500).json({
        success: false,
        message:
          'Failed to update order status.',
      })
    }
  }

// Helper: derive a single "seller status" for an order from
// that seller's own items. If every item is at the same stage,
// use that; otherwise report "mixed" so the UI can flag it.
function deriveSellerStatus(items) {
    const statuses = [...new Set(items.map((i) => i.itemStatus))];
    return statuses.length === 1 ? statuses[0] : "mixed";
}

// ─────────────────────────────────────────────
// 6. GET SELLER ORDERS
//    GET /api/v1/orders/seller-orders
//    Auth: Required (seller)
//
//    Query params:
//      status  — filter by this seller's item status
//                (placed | confirmed | processing |
//                 ready_for_pickup | dispatched | rejected | cancelled)
//      search  — match order number or numeric order ID
//      page, limit — pagination (default 1 / 10)
// ─────────────────────────────────────────────
export const getSellerOrders = async (req, res) => {
    try {
        const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });

        if (!seller) {
            return res.status(403).json({ success: false, message: "Seller account not found." });
        }

        const { status, search } = req.query;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Number(req.query.limit) || 10);

        // Fetch every OrderItem that belongs to this seller only.
        const sellerItems = await prisma.orderItem.findMany({
            where: { sellerId: seller.id },
            include: {
                order: {
                    include: {
                        user: { select: { id: true, name: true, email: true, phone: true } },
                        delivery: {
                            select: {
                                deliveryStatus: true,
                                trackingNumber: true,
                            },
                        },
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

        // Group this seller's items by their parent order.
        const grouped = new Map();
        for (const item of sellerItems) {
            if (!item.order) continue;
            if (!grouped.has(item.orderId)) {
                grouped.set(item.orderId, {
                    orderId: item.order.id,
                    orderNumber: item.order.orderNumber,
                    orderStatus: item.order.orderStatus,
                    paymentStatus: item.order.paymentStatus,
                    paymentMethod: item.order.paymentMethod,
                    deliveryAddress: item.order.deliveryAddress,
                    createdAt: item.order.createdAt,
                    buyer: item.order.user,
                    delivery: item.order.delivery || null,
                    items: [],
                });
            }
            grouped.get(item.orderId).items.push(item);
        }

        let orders = Array.from(grouped.values()).map((order) => ({
            ...order,
            sellerItemStatus: deriveSellerStatus(order.items),
            sellerSubtotal: order.items.reduce((sum, i) => sum + Number(i.subtotal || 0), 0),
            itemCount: order.items.reduce((sum, i) => sum + Number(i.quantity || 0), 0),
        }));

        // Filter: status (matches this seller's derived status for the order)
        if (status && status !== "all") {
            orders = orders.filter((o) => o.sellerItemStatus === status);
        }

        // Filter: search by order ID (numeric) or order number (partial, case-insensitive)
        if (search) {
            const term = String(search).trim().toLowerCase();
            orders = orders.filter((o) => {
                return (
                    String(o.orderId) === term ||
                    o.orderNumber.toLowerCase().includes(term)
                );
            });
        }

        // Sort newest first (already mostly true from item order, re-assert for safety)
        orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const total = orders.length;
        const start = (page - 1) * limit;
        const paginated = orders.slice(start, start + limit);

        return res.status(200).json({
            success: true,
            orders: paginated,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });

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

// ─────────────────────────────────────────────
// 7. GET INVOICE
//    GET /api/v1/orders/:id/invoice
//    Auth: Required
// ─────────────────────────────────────────────
export const getInvoice = async (req, res) => {
    try {
        const { id } = req.params;

        const order = await prisma.order.findUnique({
            where: { id: Number(id) },
            include: {
                orderItems: {
                    include: {
                        variant: { include: { listing: { select: { title: true } } } },
                    },
                },
                transactions: { select: { transactionReference: true, paidAt: true, paymentGateway: true } },
                user: { select: { name: true, email: true, phone: true } },
            },
        });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        if (order.userId !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Access denied." });
        }

        return res.status(200).json({ success: true, invoice: order });

    } catch (error) {
        console.error("getInvoice error:", error);
        return res.status(500).json({ success: false, message: "Failed to generate invoice." });
    }
};

// ─────────────────────────────────────────────
// 8. TRACK ORDER
//    GET /api/v1/orders/track/:id
//    Auth: Required
// ─────────────────────────────────────────────
export const trackOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const order = await prisma.order.findUnique({
            where: { id: Number(id) },
            select: {
                id: true,
                orderNumber: true,
                orderStatus: true,
                paymentStatus: true,
                createdAt: true,
                delivery: {
                    select: {
                        deliveryStatus: true,
                        trackingNumber: true,
                        trackingPoints: true,
                        statusHistory: true,
                        pickedUpAt: true,
                        deliveredAt: true,
                    },
                },
            },
        });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        return res.status(200).json({ success: true, tracking: order });

    } catch (error) {
        console.error("trackOrder error:", error);
        return res.status(500).json({ success: false, message: "Failed to track order." });
    }
};



