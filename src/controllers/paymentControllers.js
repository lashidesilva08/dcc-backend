import prisma from "../config/prisma.js";
import {
    generatePayHereHash,
    verifyWebhookHash,
    getPayHereCheckoutParams,
} from "../services/payhere.service.js";
import {
    getMintCheckoutParams,
    verifyMintWebhookHash,
} from "../services/mint.service.js";

// ─────────────────────────────────────────────
// 1. INITIATE PAYMENT
//    POST /api/v1/payments/initiate
//    Auth: Required
// ─────────────────────────────────────────────
export const initiatePayment = async (req, res) => {
    try {
        const { orderId, method } = req.body;

        if (!orderId || !method) {
            return res.status(400).json({ success: false, message: "orderId and method are required." });
        }

        const allowedMethods = ["COD", "PAYHERE", "MINT"];
        if (!allowedMethods.includes(method.toUpperCase())) {
            return res.status(400).json({ success: false, message: `Payment method must be one of: ${allowedMethods.join(", ")}` });
        }

        // Fetch order and verify it belongs to the logged-in user
        const order = await prisma.order.findUnique({
            where: { id: Number(orderId) },
            include: { transactions: true },
        });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        if (order.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: "Access denied. This is not your order." });
        }

        if (order.paymentStatus === "paid") {
            return res.status(400).json({ success: false, message: "This order has already been paid." });
        }

        const normalizedMethod = method.toUpperCase();

        // ─── COD Flow ────────────────────────────────────────────────
        if (normalizedMethod === "COD") {
            await prisma.$transaction([
                prisma.order.update({
                    where: { id: order.id },
                    data: {
                        paymentMethod: "COD",
                        paymentStatus: "pending",
                        orderStatus: "placed",
                    },
                }),
                prisma.transaction.upsert({
                    where: { orderId: order.id },
                    create: {
                        orderId: order.id,
                        transactionReference: `COD-${order.orderNumber}`,
                        paymentGateway: "COD",
                        amount: order.totalAmount,
                        currency: "LKR",
                        status: "pending",
                    },
                    update: {
                        paymentGateway: "COD",
                        status: "pending",
                    },
                }),
            ]);

            return res.status(200).json({
                success: true,
                method: "COD",
                message: "Order placed successfully. Pay on delivery.",
                orderNumber: order.orderNumber,
            });
        }

        // ─── PayHere Flow ─────────────────────────────────────────────
        if (normalizedMethod === "PAYHERE") {
            const merchantId = process.env.PAYHERE_MERCHANT_ID;
            const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;

            if (!merchantId || !merchantSecret) {
                return res.status(500).json({
                    success: false,
                    message: "PayHere is not configured. Please contact support.",
                });
            }

            // Fetch full user details for checkout form
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { id: true, name: true, email: true, phone: true },
            });

            const hash = generatePayHereHash(
                merchantId,
                String(order.id),
                order.totalAmount,
                "LKR",
                merchantSecret
            );

            // Update payment method on the order
            await prisma.order.update({
                where: { id: order.id },
                data: { paymentMethod: "PAYHERE" },
            });

            const checkoutParams = getPayHereCheckoutParams(order, user, hash);

            return res.status(200).json({
                success: true,
                method: "PAYHERE",
                message: "Checkout params ready. Submit to PayHere.",
                checkoutParams,
            });
        }

        // ─── Mint Flow ────────────────────────────────────────────────
        if (normalizedMethod === "MINT") {
            const appId = process.env.MINT_APP_ID;

            if (!appId) {
                return res.status(500).json({
                    success: false,
                    message: "Mint is not configured. Please contact support.",
                });
            }

            // Fetch full user details for checkout form
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { id: true, name: true, email: true, phone: true },
            });

            // Update payment method on the order
            await prisma.order.update({
                where: { id: order.id },
                data: { paymentMethod: "MINT" },
            });

            const checkoutParams = getMintCheckoutParams(order, user);

            return res.status(200).json({
                success: true,
                method: "MINT",
                message: "Checkout params ready. Submit to Mint.",
                checkoutParams,
            });
        }

    } catch (error) {
        console.error("initiatePayment error:", error);
        return res.status(500).json({ success: false, message: "Payment initiation failed.", error: error.message });
    }
};

// ─────────────────────────────────────────────
// 2. PAYHERE WEBHOOK (Server Notification)
//    POST /api/v1/payments/webhook/payhere
//    Auth: NONE — PayHere calls this directly
// ─────────────────────────────────────────────
export const handlePaymentWebhook = async (req, res) => {
    try {
        const paymentData = req.body;

        console.log("[PayHere Webhook] Received:", paymentData);

        const merchantId = process.env.PAYHERE_MERCHANT_ID;
        const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;

        // 1. Verify the MD5 signature
        const isVerified = verifyWebhookHash(paymentData, merchantId, merchantSecret);

        if (!isVerified) {
            console.error("[PayHere Webhook] Hash verification FAILED. Possible tampered request.");
            return res.status(400).send("Hash verification failed.");
        }

        const orderId = Number(paymentData.merchant_order_id);
        const statusCode = Number(paymentData.status_code);
        const payherePaymentId = paymentData.payment_id;

        // PayHere status codes:
        //  2  = Success
        //  0  = Pending
        // -1  = Cancelled
        // -2  = Failed
        // -3  = Chargedback

        if (statusCode === 2) {
            // Payment SUCCESS — update order and transaction
            await prisma.$transaction([
                prisma.order.update({
                    where: { id: orderId },
                    data: {
                        paymentStatus: "paid",
                        orderStatus: "confirmed",
                    },
                }),
                prisma.transaction.upsert({
                    where: { orderId },
                    create: {
                        orderId,
                        transactionReference: payherePaymentId || `PH-${orderId}`,
                        paymentGateway: "PAYHERE",
                        amount: parseFloat(paymentData.payhere_amount),
                        currency: paymentData.payhere_currency || "LKR",
                        status: "success",
                        gatewayResponse: paymentData,
                        paidAt: new Date(),
                    },
                    update: {
                        transactionReference: payherePaymentId || `PH-${orderId}`,
                        status: "success",
                        gatewayResponse: paymentData,
                        paidAt: new Date(),
                    },
                }),
            ]);

            console.log(`[PayHere Webhook] ✅ Order #${orderId} marked as PAID.`);

        } else if (statusCode === 0) {
            // Pending
            await prisma.transaction.upsert({
                where: { orderId },
                create: {
                    orderId,
                    transactionReference: payherePaymentId || `PH-PENDING-${orderId}`,
                    paymentGateway: "PAYHERE",
                    amount: parseFloat(paymentData.payhere_amount),
                    currency: paymentData.payhere_currency || "LKR",
                    status: "pending",
                    gatewayResponse: paymentData,
                },
                update: {
                    status: "pending",
                    gatewayResponse: paymentData,
                },
            });
            console.log(`[PayHere Webhook] ⏳ Order #${orderId} payment is PENDING.`);

        } else {
            // Cancelled / Failed / Chargedback
            const failedStatus = statusCode === -1 ? "cancelled" : statusCode === -3 ? "chargedback" : "failed";

            await prisma.$transaction([
                prisma.order.update({
                    where: { id: orderId },
                    data: { paymentStatus: failedStatus },
                }),
                prisma.transaction.upsert({
                    where: { orderId },
                    create: {
                        orderId,
                        transactionReference: payherePaymentId || `PH-FAIL-${orderId}`,
                        paymentGateway: "PAYHERE",
                        amount: parseFloat(paymentData.payhere_amount) || 0,
                        currency: paymentData.payhere_currency || "LKR",
                        status: failedStatus,
                        gatewayResponse: paymentData,
                    },
                    update: {
                        status: failedStatus,
                        gatewayResponse: paymentData,
                    },
                }),
            ]);

            console.log(`[PayHere Webhook] ❌ Order #${orderId} payment ${failedStatus.toUpperCase()}.`);
        }

        // PayHere requires a 200 OK response — always send it
        res.status(200).send("OK");

    } catch (error) {
        console.error("[PayHere Webhook] Error:", error);
        // Still return 200 to prevent PayHere from retrying indefinitely
        res.status(200).send("OK");
    }
};

// ─────────────────────────────────────────────
// 3. GET PAYMENT STATUS
//    GET /api/v1/payments/status/:orderId
//    Auth: Required
// ─────────────────────────────────────────────
export const getPaymentStatus = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await prisma.order.findUnique({
            where: { id: Number(orderId) },
            select: {
                id: true,
                orderNumber: true,
                userId: true,
                paymentMethod: true,
                paymentStatus: true,
                orderStatus: true,
                totalAmount: true,
                transactions: {
                    select: {
                        id: true,
                        transactionReference: true,
                        paymentGateway: true,
                        amount: true,
                        currency: true,
                        status: true,
                        paidAt: true,
                        createdAt: true,
                    },
                },
            },
        });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        if (order.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: "Access denied." });
        }

        return res.status(200).json({
            success: true,
            orderId: order.id,
            orderNumber: order.orderNumber,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            orderStatus: order.orderStatus,
            totalAmount: order.totalAmount,
            transaction: order.transactions || null,
        });

    } catch (error) {
        console.error("getPaymentStatus error:", error);
        return res.status(500).json({ success: false, message: "Failed to get payment status.", error: error.message });
    }
};

// ─────────────────────────────────────────────
// 4. INITIATE REFUND
//    POST /api/v1/payments/refund/:orderId
//    Auth: Required
// ─────────────────────────────────────────────
export const initiateRefund = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;

        const order = await prisma.order.findUnique({
            where: { id: Number(orderId) },
            include: { transactions: true },
        });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        if (order.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: "Access denied." });
        }

        if (order.orderStatus !== "cancelled") {
            return res.status(400).json({
                success: false,
                message: "Only cancelled orders can be refunded.",
            });
        }

        if (order.paymentStatus !== "paid") {
            return res.status(400).json({
                success: false,
                message: "Only paid orders can be refunded.",
            });
        }

        // Update transaction status to refunded (manual admin process for now)
        await prisma.$transaction([
            prisma.order.update({
                where: { id: order.id },
                data: { paymentStatus: "refunded" },
            }),
            prisma.transaction.update({
                where: { orderId: order.id },
                data: {
                    status: "refunded",
                    gatewayResponse: {
                        ...(order.transactions?.gatewayResponse || {}),
                        refundReason: reason || "Customer requested refund",
                        refundedAt: new Date().toISOString(),
                    },
                },
            }),
        ]);

        return res.status(200).json({
            success: true,
            message: "Refund has been processed. Amount will be credited within 5-7 business days.",
            orderId: order.id,
            orderNumber: order.orderNumber,
        });

    } catch (error) {
        console.error("initiateRefund error:", error);
        return res.status(500).json({ success: false, message: "Refund processing failed.", error: error.message });
    }
};

// ─────────────────────────────────────────────
// 5. MINT WEBHOOK (Server Notification)
//    POST /api/v1/payments/webhook/mint
//    Auth: NONE — Mint servers call this directly
// ─────────────────────────────────────────────
export const handleMintWebhook = async (req, res) => {
    try {
        const paymentData = req.body;
        console.log("[Mint Webhook] Received:", paymentData);

        const appSecret = process.env.MINT_APP_SECRET;

        // 1. Verify the webhook signature
        const isVerified = verifyMintWebhookHash(paymentData, appSecret);

        if (!isVerified) {
            console.error("[Mint Webhook] Hash verification FAILED. Possible tampered request.");
            return res.status(400).send("Hash verification failed.");
        }

        const orderId = Number(paymentData.order_id);
        const status = paymentData.status; // assume "success", "failed", "cancelled"
        const mintPaymentId = paymentData.transaction_id || paymentData.payment_id;

        if (status === "success" || status === "paid") {
            // Payment SUCCESS
            await prisma.$transaction([
                prisma.order.update({
                    where: { id: orderId },
                    data: {
                        paymentStatus: "paid",
                        orderStatus: "confirmed",
                    },
                }),
                prisma.transaction.upsert({
                    where: { orderId },
                    create: {
                        orderId,
                        transactionReference: mintPaymentId || `MINT-${orderId}`,
                        paymentGateway: "MINT",
                        amount: parseFloat(paymentData.amount),
                        currency: paymentData.currency || "LKR",
                        status: "success",
                        gatewayResponse: paymentData,
                        paidAt: new Date(),
                    },
                    update: {
                        transactionReference: mintPaymentId || `MINT-${orderId}`,
                        status: "success",
                        gatewayResponse: paymentData,
                        paidAt: new Date(),
                    },
                }),
            ]);

            console.log(`[Mint Webhook] ✅ Order #${orderId} marked as PAID.`);
        } else {
            // Failed or Cancelled
            const failedStatus = status === "cancelled" ? "cancelled" : "failed";

            await prisma.$transaction([
                prisma.order.update({
                    where: { id: orderId },
                    data: { paymentStatus: failedStatus },
                }),
                prisma.transaction.upsert({
                    where: { orderId },
                    create: {
                        orderId,
                        transactionReference: mintPaymentId || `MINT-FAIL-${orderId}`,
                        paymentGateway: "MINT",
                        amount: parseFloat(paymentData.amount) || 0,
                        currency: paymentData.currency || "LKR",
                        status: failedStatus,
                        gatewayResponse: paymentData,
                    },
                    update: {
                        status: failedStatus,
                        gatewayResponse: paymentData,
                    },
                }),
            ]);

            console.log(`[Mint Webhook] ❌ Order #${orderId} payment ${failedStatus.toUpperCase()}.`);
        }

        // Mint requires a 200 OK response
        res.status(200).send("OK");

    } catch (error) {
        console.error("[Mint Webhook] Error:", error);
        res.status(200).send("OK");
    }
};