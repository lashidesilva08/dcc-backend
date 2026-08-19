import prisma from "../config/prisma.js";


// ======================================================
// CHECKOUT HELPERS
// ======================================================

const ALLOWED_PAYMENT_METHODS = [
    "COD",
    "PAYHERE"
];

const ALLOWED_DELIVERY_METHODS = [
    "platform",
    "pickup",
    "courier"
];

const ALLOWED_ORDER_STATUSES = [
    "placed",
    "confirmed",
    "processing",
    "dispatched",
    "out_for_delivery",
    "delivered",
    "cancelled"
];


/**
 * Calculate delivery fee on the SERVER.
 *
 * Never trust totals sent from the frontend.
 *
 * Temporary pricing:
 * Platform = LKR 350
 * Pickup   = Free
 * Courier  = LKR 550
 * Free delivery for orders >= LKR 10,000
 */
function calculateDeliveryFee(subtotal, deliveryMethod) {

    if (deliveryMethod === "pickup") {
        return 0;
    }

    if (subtotal >= 10000) {
        return 0;
    }

    if (deliveryMethod === "courier") {
        return 550;
    }

    return 350;
}


/**
 * Generate readable unique-ish order number.
 */
function generateOrderNumber() {
    return `DCC-${Date.now()}-${Math.floor(
        100 + Math.random() * 900
    )}`;
}


// ======================================================
// CREATE ORDER / CHECKOUT
// POST /api/v1/orders/checkout
// ======================================================

export const createOrder = async (req, res) => {

    try {

        const userId = req.user?.id;

        const {
            items,
            deliveryAddress,
            deliveryMethod = "platform",
            paymentMethod,
            notes
        } = req.body;


        // ==================================================
        // 1. AUTHENTICATION
        // ==================================================

        if (!userId) {

            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });

        }


        // ==================================================
        // 2. VALIDATE CART
        // ==================================================

        if (
            !Array.isArray(items) ||
            items.length === 0
        ) {

            return res.status(400).json({
                success: false,
                message: "Cart is empty."
            });

        }


        // ==================================================
        // 3. VALIDATE DELIVERY ADDRESS
        // ==================================================

        if (
            !deliveryAddress ||
            !deliveryAddress.trim()
        ) {

            return res.status(400).json({
                success: false,
                message: "Delivery address is required."
            });

        }


        // ==================================================
        // 4. VALIDATE DELIVERY METHOD
        // ==================================================

        if (
            !ALLOWED_DELIVERY_METHODS.includes(
                deliveryMethod
            )
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid delivery method."
            });

        }


        // ==================================================
        // 5. VALIDATE PAYMENT METHOD
        // ==================================================

        if (
            !ALLOWED_PAYMENT_METHODS.includes(
                paymentMethod
            )
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid payment method."
            });

        }


        // ==================================================
        // 6. NORMALIZE REQUEST ITEMS
        // ==================================================

        const normalizedItems = [];

        for (const item of items) {

            const variantId =
                Number(item.variantId);

            const quantity =
                Number(item.quantity);


            if (
                !Number.isInteger(variantId) ||
                variantId <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Invalid product variant."
                });

            }


            if (
                !Number.isInteger(quantity) ||
                quantity <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Invalid product quantity."
                });

            }


            /*
             * If the same variant appears more than once,
             * combine the quantities.
             */
            const existing =
                normalizedItems.find(
                    (entry) =>
                        entry.variantId === variantId
                );


            if (existing) {

                existing.quantity += quantity;

            } else {

                normalizedItems.push({
                    variantId,
                    quantity
                });

            }

        }


        // ==================================================
        // 7. FETCH REAL PRODUCT DATA FROM DATABASE
        // ==================================================

        const variantIds =
            normalizedItems.map(
                (item) => item.variantId
            );


        const variants =
            await prisma.productVariant.findMany({

                where: {
                    id: {
                        in: variantIds
                    }
                },

                include: {

                    listing: {

                        include: {
                            seller: true
                        }

                    },

                    images: true
                }

            });


        if (
            variants.length !==
            normalizedItems.length
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "One or more products could not be found."
            });

        }


        // ==================================================
        // 8. VALIDATE PRODUCTS + CALCULATE SUBTOTAL
        // ==================================================

        let subtotal = 0;

        const orderItems = [];


        for (const requestedItem of normalizedItems) {

            const variant =
                variants.find(
                    (variantRecord) =>
                        variantRecord.id ===
                        requestedItem.variantId
                );


            if (!variant) {

                return res.status(404).json({
                    success: false,
                    message:
                        `Product variant ${requestedItem.variantId} not found.`
                });

            }


            if (variant.status !== "active") {

                return res.status(400).json({
                    success: false,
                    message:
                        `${variant.listing.title} is currently unavailable.`
                });

            }


            if (
                variant.listing.status !== "active"
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        `${variant.listing.title} is currently unavailable.`
                });

            }


            if (
                variant.stock <
                requestedItem.quantity
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        `Not enough stock for ${variant.listing.title}.`
                });

            }


            /*
             * IMPORTANT:
             *
             * Price comes from PostgreSQL.
             * Never trust price sent from frontend.
             */
            const unitPrice =
                Number(variant.price);


            const itemSubtotal =
                unitPrice *
                requestedItem.quantity;


            subtotal += itemSubtotal;


            orderItems.push({

                variantId:
                    variant.id,

                sellerId:
                    variant.listing.sellerId,

                quantity:
                    requestedItem.quantity,

                unitPrice,

                subtotal:
                    itemSubtotal

            });

        }


        // ==================================================
        // 9. DELIVERY CALCULATION
        // ==================================================

        const deliveryFee =
            calculateDeliveryFee(
                subtotal,
                deliveryMethod
            );


        const totalAmount =
            subtotal + deliveryFee;


        // ==================================================
        // 10. GENERATE ORDER NUMBER
        // ==================================================

        const orderNumber =
            generateOrderNumber();


        // ==================================================
        // 11. DATABASE TRANSACTION
        // ==================================================

        const order =
            await prisma.$transaction(
                async (tx) => {


                    // --------------------------------------
                    // Re-check and reduce stock safely
                    // --------------------------------------

                    for (const item of orderItems) {

                        const stockUpdate =
                            await tx.productVariant.updateMany({

                                where: {

                                    id:
                                        item.variantId,

                                    status:
                                        "active",

                                    stock: {
                                        gte:
                                            item.quantity
                                    }

                                },

                                data: {

                                    stock: {
                                        decrement:
                                            item.quantity
                                    }

                                }

                            });


                        if (
                            stockUpdate.count !== 1
                        ) {

                            throw new Error(
                                `Insufficient stock for variant ${item.variantId}.`
                            );

                        }

                    }


                    // --------------------------------------
                    // Create main order
                    // --------------------------------------

                    const newOrder =
                        await tx.order.create({

                            data: {

                                userId,

                                orderNumber,

                                totalAmount,

                                deliveryFee,

                                paymentMethod,

                                paymentStatus:
                                    "pending",

                                orderStatus:
                                    "placed",

                                deliveryAddress:
                                    deliveryAddress.trim(),

                                notes:
                                    [
                                        `Delivery method: ${deliveryMethod}`,
                                        notes?.trim()
                                    ]
                                        .filter(Boolean)
                                        .join(" | ") || null,


                                orderItems: {

                                    create:
                                        orderItems

                                }

                            },


                            include: {

                                orderItems: {

                                    include: {

                                        variant: {

                                            include: {

                                                listing: true,

                                                images: true

                                            }

                                        },

                                        seller: true

                                    }

                                }

                            }

                        });


                    return newOrder;

                }
            );


        // ==================================================
        // 12. SUCCESS RESPONSE
        // ==================================================

        return res.status(201).json({

            success: true,

            message:
                "Order placed successfully.",

            data: {

                orderId:
                    order.id,

                orderNumber:
                    order.orderNumber,

                subtotal,

                deliveryMethod,

                deliveryFee,

                totalAmount,

                paymentMethod:
                    order.paymentMethod,

                paymentStatus:
                    order.paymentStatus,

                orderStatus:
                    order.orderStatus,

                deliveryAddress:
                    order.deliveryAddress,

                items:
                    order.orderItems

            }

        });


    } catch (error) {

        console.error(
            "Checkout error:",
            error
        );


        /*
         * Stock can change between validation
         * and transaction execution.
         */
        if (
            error.message?.includes(
                "Insufficient stock"
            )
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "One of the products no longer has enough stock. Please refresh your cart."

            });

        }


        return res.status(500).json({

            success: false,

            message:
                "Checkout failed.",

            error:
                error.message

        });

    }

};


// ======================================================
// GET LOGGED-IN USER ORDERS
// GET /api/v1/orders/my-orders
// ======================================================

export const getMyOrders =
    async (req, res) => {

        try {

            const userId =
                req.user.id;


            const orders =
                await prisma.order.findMany({

                    where: {
                        userId
                    },

                    include: {

                        orderItems: {

                            include: {

                                variant: {

                                    include: {

                                        listing: true,

                                        images: true

                                    }

                                },

                                seller: true

                            }

                        },

                        delivery: true,

                        transactions: true

                    },

                    orderBy: {
                        createdAt: "desc"
                    }

                });


            return res.status(200).json({

                success: true,

                data: orders

            });


        } catch (error) {

            console.error(
                "Get my orders error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to retrieve orders.",

                error:
                    error.message

            });

        }

    };


// ======================================================
// GET SINGLE ORDER
// GET /api/v1/orders/:id
// ======================================================

export const getOrderById =
    async (req, res) => {

        try {

            const orderId =
                Number(req.params.id);

            const userId =
                req.user.id;


            if (
                !Number.isInteger(orderId) ||
                orderId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid order ID."

                });

            }


            const order =
                await prisma.order.findFirst({

                    where: {

                        id:
                            orderId,

                        userId

                    },

                    include: {

                        orderItems: {

                            include: {

                                variant: {

                                    include: {

                                        listing: true,

                                        images: true

                                    }

                                },

                                seller: true

                            }

                        },

                        delivery: true,

                        transactions: true

                    }

                });


            if (!order) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Order not found."

                });

            }


            return res.status(200).json({

                success: true,

                data: order

            });


        } catch (error) {

            console.error(
                "Get order error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to retrieve order.",

                error:
                    error.message

            });

        }

    };


// ======================================================
// CANCEL ORDER
// DELETE /api/v1/orders/:id
// ======================================================

export const cancelOrder =
    async (req, res) => {

        try {

            const orderId =
                Number(req.params.id);

            const userId =
                req.user.id;


            if (
                !Number.isInteger(orderId) ||
                orderId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid order ID."

                });

            }


            const order =
                await prisma.order.findFirst({

                    where: {

                        id:
                            orderId,

                        userId

                    },

                    include: {
                        orderItems: true
                    }

                });


            if (!order) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Order not found."

                });

            }


            if (
                order.orderStatus ===
                "cancelled"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Order is already cancelled."

                });

            }


            if (
                order.orderStatus ===
                "delivered"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Delivered orders cannot be cancelled."

                });

            }


            await prisma.$transaction(
                async (tx) => {


                    await tx.order.update({

                        where: {
                            id: orderId
                        },

                        data: {

                            orderStatus:
                                "cancelled"

                        }

                    });


                    // --------------------------------------
                    // Return stock
                    // --------------------------------------

                    for (
                        const item
                        of order.orderItems
                    ) {

                        await tx.productVariant.update({

                            where: {

                                id:
                                    item.variantId

                            },

                            data: {

                                stock: {

                                    increment:
                                        item.quantity

                                }

                            }

                        });

                    }

                }
            );


            return res.status(200).json({

                success: true,

                message:
                    "Order cancelled successfully."

            });


        } catch (error) {

            console.error(
                "Cancel order error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to cancel order.",

                error:
                    error.message

            });

        }

    };


// ======================================================
// UPDATE ORDER STATUS
// PATCH /api/v1/orders/:id/status
// ======================================================

export const updateOrderStatus =
    async (req, res) => {

        try {

            const orderId =
                Number(req.params.id);

            const {
                status
            } = req.body;


            if (
                !Number.isInteger(orderId) ||
                orderId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid order ID."

                });

            }


            if (!status) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Status is required."

                });

            }


            const normalizedStatus =
                String(status)
                    .trim()
                    .toLowerCase();


            if (
                !ALLOWED_ORDER_STATUSES.includes(
                    normalizedStatus
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid order status."

                });

            }


            const existingOrder =
                await prisma.order.findUnique({

                    where: {
                        id: orderId
                    }

                });


            if (!existingOrder) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Order not found."

                });

            }


            const updatedOrder =
                await prisma.order.update({

                    where: {
                        id: orderId
                    },

                    data: {

                        orderStatus:
                            normalizedStatus

                    }

                });


            return res.status(200).json({

                success: true,

                message:
                    "Order status updated successfully.",

                data:
                    updatedOrder

            });


        } catch (error) {

            console.error(
                "Update order status error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to update order status.",

                error:
                    error.message

            });

        }

    };


// ======================================================
// SELLER ORDERS
// GET /api/v1/orders/seller-orders
// ======================================================

export const getSellerOrders =
    async (req, res) => {

        try {

            const seller =
                await prisma.seller.findUnique({

                    where: {
                        userId:
                            req.user.id
                    }

                });


            if (!seller) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Seller profile not found."

                });

            }


            const orderItems =
                await prisma.orderItem.findMany({

                    where: {
                        sellerId:
                            seller.id
                    },

                    include: {

                        order: {

                            include: {

                                user: {

                                    select: {

                                        id: true,

                                        name: true,

                                        email: true,

                                        phone: true

                                    }

                                }

                            }

                        },

                        variant: {

                            include: {

                                listing: true,

                                images: true

                            }

                        }

                    },

                    orderBy: {
                        createdAt: "desc"
                    }

                });


            return res.status(200).json({

                success: true,

                data:
                    orderItems

            });


        } catch (error) {

            console.error(
                "Seller orders error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to retrieve seller orders.",

                error:
                    error.message

            });

        }

    };


// ======================================================
// TRACK ORDER
// GET /api/v1/orders/track/:id
// ======================================================

export const trackOrder =
    async (req, res) => {

        try {

            const orderId =
                Number(req.params.id);

            const userId =
                req.user.id;


            if (
                !Number.isInteger(orderId) ||
                orderId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid order ID."

                });

            }


            const order =
                await prisma.order.findFirst({

                    where: {

                        id:
                            orderId,

                        userId

                    },

                    include: {
                        delivery: true
                    }

                });


            if (!order) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Order not found."

                });

            }


            return res.status(200).json({

                success: true,

                data: {

                    orderId:
                        order.id,

                    orderNumber:
                        order.orderNumber,

                    orderStatus:
                        order.orderStatus,

                    paymentStatus:
                        order.paymentStatus,

                    delivery:
                        order.delivery

                }

            });


        } catch (error) {

            console.error(
                "Track order error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to track order.",

                error:
                    error.message

            });

        }

    };


// ======================================================
// GET INVOICE
// GET /api/v1/orders/:id/invoice
// ======================================================

export const getInvoice =
    async (req, res) => {

        try {

            const orderId =
                Number(req.params.id);

            const userId =
                req.user.id;


            if (
                !Number.isInteger(orderId) ||
                orderId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid order ID."

                });

            }


            const order =
                await prisma.order.findFirst({

                    where: {

                        id:
                            orderId,

                        userId

                    },

                    include: {

                        user: {

                            select: {

                                name: true,

                                email: true,

                                phone: true

                            }

                        },

                        orderItems: {

                            include: {

                                variant: {

                                    include: {

                                        listing: true

                                    }

                                },

                                seller: true

                            }

                        }

                    }

                });


            if (!order) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Order not found."

                });

            }


            return res.status(200).json({

                success: true,

                message:
                    "Invoice data retrieved successfully.",

                data:
                    order

            });


        } catch (error) {

            console.error(
                "Invoice error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to generate invoice.",

                error:
                    error.message

            });

        }

    };