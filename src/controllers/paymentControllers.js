import prisma from "../config/prisma.js";
import {generatePayHereHash,verifyWebhookHash,getPayHereCheckoutParams,} from "../services/payhere.service.js";
import {getMintCheckoutParams,verifyMintWebhookHash,} from "../services/mint.service.js";
import {getKokoCheckoutParams,verifyKokoWebhookHash,} from "../services/koko.service.js";
import {getOnePayCheckoutParams,verifyOnePayWebhookHash,} from "../services/onepay.service.js";
import emailService from "../services/email.service.js";

const isKokoOnePayMockEnabled = process.env.MOCK_KOKO_ONEPAY === "true" && process.env.NODE_ENV !== "production"

async function startMockPayment(req, res, order, method) {
  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        paymentMethod: method,
        paymentStatus: "pending",
        orderStatus: "pending_payment",
      },
    }),
    prisma.transaction.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        transactionReference: `MOCK-${method}-${order.id}`,
        paymentGateway: method,
        amount: order.totalAmount,
        currency: "LKR",
        status: "pending",
        gatewayResponse: { mode: "mock", method },
      },
      update: {
        paymentGateway: method,
        status: "pending",
        gatewayResponse: { mode: "mock", method },
      },
    }),
  ])

  return res.status(200).json({
    success: true,
    requiresGateway: true,
    mock: true,
    method,
    mockGatewayPath:`/payment/mock/${order.id}?method=${method.toLowerCase()}`,
  })
}
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

        const allowedMethods = ["COD", "PAYHERE", "MINT", "KOKO", "ONEPAY"];
        if (!allowedMethods.includes(method.toUpperCase())) {
            return res.status(400).json({ success: false, message: `Payment method must be one of: ${allowedMethods.join(", ")}` });
        }

        // Fetch order and verify it belongs to the logged-in user
        const order = await prisma.order.findUnique({
            where: { id: Number(orderId) },
            include: { transactions: true, user: true },
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

            // Send order confirmation email asynchronously
            emailService.sendOrderConfirmation(order.user, {
                id: order.orderNumber,
                total: order.totalAmount,
            }).catch((err) => console.error("Error sending COD order confirmation email:", err));

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

        // ─── Koko Flow ────────────────────────────────────────────────
        if (normalizedMethod === "KOKO") {

            if (isKokoOnePayMockEnabled) {
                return startMockPayment(req, res, order, "KOKO")
            }
            const merchantId = process.env.KOKO_MERCHANT_ID;

            if (!merchantId) {
                return res.status(500).json({
                    success: false,
                    message: "Koko is not configured. Please contact support.",
                });
            }

            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { id: true, name: true, email: true, phone: true },
            });

            await prisma.order.update({
                where: { id: order.id },
                data: { paymentMethod: "KOKO" },
            });

            const checkoutParams = getKokoCheckoutParams(order, user);

            return res.status(200).json({
                success: true,
                method: "KOKO",
                message: "Checkout params ready. Submit to Koko.",
                checkoutParams,
            });
        }

        // ─── OnePay Flow ──────────────────────────────────────────────
        if (normalizedMethod === "ONEPAY") {

            if (isKokoOnePayMockEnabled) {
                return startMockPayment(req, res, order, "ONEPAY")
            }
            const appId = process.env.ONEPAY_APP_ID;

            if (!appId) {
                return res.status(500).json({
                    success: false,
                    message: "OnePay is not configured. Please contact support.",
                });
            }

            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { id: true, name: true, email: true, phone: true },
            });

            await prisma.order.update({
                where: { id: order.id },
                data: { paymentMethod: "ONEPAY" },
            });

            const checkoutParams = getOnePayCheckoutParams(order, user);

            return res.status(200).json({
                success: true,
                method: "ONEPAY",
                message: "Checkout params ready. Submit to OnePay.",
                checkoutParams,
            });
        }

    } catch (error) {
        console.error("initiatePayment error:", error);
        return res.status(500).json({ success: false, message: "Payment initiation failed.", error: error.message });
    }
};

// ─────────────────────────────────────────────
// SIMULATED PAYMENT WEBHOOK
// POST /api/v1/payments/webhook
// Auth: NONE
//
// Used by the frontend's simulated payment gateway.
// This is NOT the real PayHere webhook.
// ─────────────────────────────────────────────
export const handleSimulatedPaymentWebhook = async (req, res) => {
    try {
        const paymentData = req.body;

        console.log("[Simulated Payment Webhook] Received:", paymentData);

        const orderId = Number(paymentData.order_id);
        const statusCode = Number(paymentData.status_code);
        const amount = Number(paymentData.amount || 0);

        if (!orderId || !Number.isInteger(orderId)) {
            return res.status(400).json({
                success: false,
                message: "A valid order_id is required.",
            });
        }

        if (![2, 0].includes(statusCode)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment status.",
            });
        }

        // Find the order first
        const order = await prisma.order.findUnique({
            where: { id: orderId },
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

        // ─────────────────────────────────────
        // PAYMENT SUCCESS
        // ─────────────────────────────────────
        if (statusCode === 2) {
            const [updatedOrder] = await prisma.$transaction([
                prisma.order.update({
                    where: { id: orderId },
                    data: {
                        paymentStatus: "paid",
                        orderStatus: "confirmed",
                    },
                    include: {
                        user: true,
                    },
                }),

                prisma.transaction.upsert({
                    where: { orderId },

                    create: {
                        orderId,
                        transactionReference: `SIM-${orderId}-${Date.now()}`,
                        paymentGateway:
                            String(paymentData.gateway || "SIMULATED").toUpperCase(),
                        amount: amount || Number(order.totalAmount),
                        currency: "LKR",
                        status: "success",
                        gatewayResponse: paymentData,
                        paidAt: new Date(),
                    },

                    update: {
                        paymentGateway:
                            String(paymentData.gateway || "SIMULATED").toUpperCase(),
                        amount: amount || Number(order.totalAmount),
                        status: "success",
                        gatewayResponse: paymentData,
                        paidAt: new Date(),
                    },
                }),
            ]);

            // Send confirmation email
            emailService
                .sendOrderConfirmation(updatedOrder.user, {
                    id: updatedOrder.orderNumber,
                    total: updatedOrder.totalAmount,
                })
                .catch((err) =>
                    console.error(
                        "Error sending simulated payment confirmation email:",
                        err
                    )
                );

            console.log(
                `[Simulated Payment Webhook] ✅ Order #${orderId} marked as PAID.`
            );

            return res.status(200).json({
                success: true,
                message: "Simulated payment processed successfully.",
                orderId: updatedOrder.id,
                orderNumber: updatedOrder.orderNumber,
                paymentStatus: updatedOrder.paymentStatus,
                orderStatus: updatedOrder.orderStatus,
            });
        }

        // ─────────────────────────────────────
        // PAYMENT PENDING
        // ─────────────────────────────────────
        await prisma.transaction.upsert({
            where: { orderId },

            create: {
                orderId,
                transactionReference: `SIM-PENDING-${orderId}`,
                paymentGateway:
                    String(paymentData.gateway || "SIMULATED").toUpperCase(),
                amount: amount || Number(order.totalAmount),
                currency: "LKR",
                status: "pending",
                gatewayResponse: paymentData,
            },

            update: {
                status: "pending",
                gatewayResponse: paymentData,
            },
        });

        console.log(
            `[Simulated Payment Webhook] ⏳ Order #${orderId} payment is pending.`
        );

        return res.status(200).json({
            success: true,
            message: "Simulated payment is pending.",
            orderId,
        });

    } catch (error) {
        console.error(
            "[Simulated Payment Webhook] Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to process simulated payment.",
            error: error.message,
        });
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
            const [updatedOrder] = await prisma.$transaction([
                prisma.order.update({
                    where: { id: orderId },
                    data: {
                        paymentStatus: "paid",
                        orderStatus: "confirmed",
                    },
                    include: {
                        user: true,
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

            // Send order confirmation email asynchronously
            emailService.sendOrderConfirmation(updatedOrder.user, {
                id: updatedOrder.orderNumber,
                total: updatedOrder.totalAmount,
            }).catch((err) => console.error("Error sending PayHere order confirmation email:", err));

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
            const [updatedOrder] = await prisma.$transaction([
                prisma.order.update({
                    where: { id: orderId },
                    data: {
                        paymentStatus: "paid",
                        orderStatus: "confirmed",
                    },
                    include: {
                        user: true,
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

            // Send order confirmation email asynchronously
            emailService.sendOrderConfirmation(updatedOrder.user, {
                id: updatedOrder.orderNumber,
                total: updatedOrder.totalAmount,
            }).catch((err) => console.error("Error sending Mint order confirmation email:", err));

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
// ─────────────────────────────────────────────
// 6. KOKO WEBHOOK (Server Notification)
//    POST /api/v1/payments/webhook/koko
//    Auth: NONE — Koko servers call this directly
// ─────────────────────────────────────────────
export const handleKokoWebhook = async (req, res) => {
    try {
        const paymentData = req.body;
        console.log("[Koko Webhook] Received:", paymentData);

        const merchantSecret = process.env.KOKO_MERCHANT_SECRET;
        const isVerified = verifyKokoWebhookHash(paymentData, merchantSecret);

        if (!isVerified) {
            console.error("[Koko Webhook] Hash verification FAILED. Possible tampered request.");
            return res.status(400).send("Hash verification failed.");
        }

        const orderId = Number(paymentData.order_id);
        const status = paymentData.status;
        const kokoPaymentId = paymentData.transaction_id || paymentData.payment_id;

        if (status === "SUCCESS" || status === "PAID" || status === "APPROVED") {
            const [updatedOrder] = await prisma.$transaction([
                prisma.order.update({
                    where: { id: orderId },
                    data: {
                        paymentStatus: "paid",
                        orderStatus: "confirmed",
                    },
                    include: { user: true },
                }),
                prisma.transaction.upsert({
                    where: { orderId },
                    create: {
                        orderId,
                        transactionReference: kokoPaymentId || `KOKO-${orderId}`,
                        paymentGateway: "KOKO",
                        amount: parseFloat(paymentData.amount),
                        currency: paymentData.currency || "LKR",
                        status: "success",
                        gatewayResponse: paymentData,
                        paidAt: new Date(),
                    },
                    update: {
                        transactionReference: kokoPaymentId || `KOKO-${orderId}`,
                        status: "success",
                        gatewayResponse: paymentData,
                        paidAt: new Date(),
                    },
                }),
            ]);

            emailService.sendOrderConfirmation(updatedOrder.user, {
                id: updatedOrder.orderNumber,
                total: updatedOrder.totalAmount,
            }).catch((err) => console.error("Error sending Koko order confirmation email:", err));

            console.log(`[Koko Webhook] ✅ Order #${orderId} marked as PAID.`);
        } else {
            const failedStatus = status === "CANCELLED" ? "cancelled" : "failed";

            await prisma.$transaction([
                prisma.order.update({
                    where: { id: orderId },
                    data: { paymentStatus: failedStatus },
                }),
                prisma.transaction.upsert({
                    where: { orderId },
                    create: {
                        orderId,
                        transactionReference: kokoPaymentId || `KOKO-FAIL-${orderId}`,
                        paymentGateway: "KOKO",
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

            console.log(`[Koko Webhook] ❌ Order #${orderId} payment ${failedStatus.toUpperCase()}.`);
        }

        res.status(200).send("OK");

    } catch (error) {
        console.error("[Koko Webhook] Error:", error);
        res.status(200).send("OK");
    }
};

// ─────────────────────────────────────────────
// 7. ONEPAY WEBHOOK (Server Notification)
//    POST /api/v1/payments/webhook/onepay
//    Auth: NONE — OnePay servers call this directly
// ─────────────────────────────────────────────
export const handleOnePayWebhook = async (req, res) => {
    try {
        const paymentData = req.body;
        console.log("[OnePay Webhook] Received:", paymentData);

        const appSecret = process.env.ONEPAY_APP_SECRET;
        const isVerified = verifyOnePayWebhookHash(paymentData, appSecret);

        if (!isVerified) {
            console.error("[OnePay Webhook] Hash verification FAILED. Possible tampered request.");
            return res.status(400).send("Hash verification failed.");
        }

        const orderId = Number(paymentData.order_id || paymentData.reference_order_id);
        const status = paymentData.status || paymentData.transaction_status;
        const onePayPaymentId = paymentData.onepay_transaction_id || paymentData.transaction_id;

        if (status === "SUCCESS" || status === "COMPLETED" || status === 1) {
            const [updatedOrder] = await prisma.$transaction([
                prisma.order.update({
                    where: { id: orderId },
                    data: {
                        paymentStatus: "paid",
                        orderStatus: "confirmed",
                    },
                    include: { user: true },
                }),
                prisma.transaction.upsert({
                    where: { orderId },
                    create: {
                        orderId,
                        transactionReference: onePayPaymentId || `ONEPAY-${orderId}`,
                        paymentGateway: "ONEPAY",
                        amount: parseFloat(paymentData.amount),
                        currency: paymentData.currency || "LKR",
                        status: "success",
                        gatewayResponse: paymentData,
                        paidAt: new Date(),
                    },
                    update: {
                        transactionReference: onePayPaymentId || `ONEPAY-${orderId}`,
                        status: "success",
                        gatewayResponse: paymentData,
                        paidAt: new Date(),
                    },
                }),
            ]);

            emailService.sendOrderConfirmation(updatedOrder.user, {
                id: updatedOrder.orderNumber,
                total: updatedOrder.totalAmount,
            }).catch((err) => console.error("Error sending OnePay order confirmation email:", err));

            console.log(`[OnePay Webhook] ✅ Order #${orderId} marked as PAID.`);
        } else {
            const failedStatus = status === "CANCELLED" ? "cancelled" : "failed";

            await prisma.$transaction([
                prisma.order.update({
                    where: { id: orderId },
                    data: { paymentStatus: failedStatus },
                }),
                prisma.transaction.upsert({
                    where: { orderId },
                    create: {
                        orderId,
                        transactionReference: onePayPaymentId || `ONEPAY-FAIL-${orderId}`,
                        paymentGateway: "ONEPAY",
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

            console.log(`[OnePay Webhook] ❌ Order #${orderId} payment ${failedStatus.toUpperCase()}.`);
        }

        res.status(200).send("OK");

    } catch (error) {
        console.error("[OnePay Webhook] Error:", error);
        res.status(200).send("OK");
    }
};

export const completeMockPayment = async (req, res) => {
  try {
    if (!isKokoOnePayMockEnabled) {
      return res.status(404).json({ success: false })
    }

    const { orderId, outcome } = req.body

    if (!['success', 'failed'].includes(outcome)) {
        return res.status(400).json({
            success: false,
            message: 'Outcome must be success or failed.',
        })
    }

    const order = await prisma.order.findUnique({
      where: { id: Number(orderId) },
    })

    if (!order || order.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      })
    }

    if (!["KOKO", "ONEPAY"].includes(order.paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "This is not a mock KOKO or OnePay payment.",
      })
    }

    const successful = outcome === "success"

    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: successful ? "paid" : "failed",
          orderStatus: successful ? "confirmed" : "payment_failed",
        },
      }),
      prisma.transaction.update({
        where: { orderId: order.id },
        data: {
          status: successful ? "success" : "failed",
          ...(successful ? { paidAt: new Date() } : {}),
        },
      }),
    ])

    return res.json({
      success: true,
      paymentStatus: successful ? "paid" : "failed",
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Mock payment failed.",
    })
  }
}
