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


