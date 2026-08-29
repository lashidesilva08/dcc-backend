import crypto from "crypto";

/**
 * Generates checkout parameters/payload for Koko payment gateway.
 * 
 * @param {Object} order - Prisma order object with id, orderNumber, totalAmount, etc.
 * @param {Object} user - User object with name, email, phone.
 * @return {Object} Checkout parameters needed by the frontend to redirect/submit to Koko.
 */
export const getKokoCheckoutParams = (order, user) => {
    const merchantId = process.env.KOKO_MERCHANT_ID || "MOCK_KOKO_MERCHANT_ID";
    const merchantSecret = process.env.KOKO_MERCHANT_SECRET || "MOCK_KOKO_SECRET";

    const returnUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/checkout/success?orderId=${order.id}`;
    const cancelUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/checkout/cancel?orderId=${order.id}`;
    const webhookUrl = `${process.env.BACKEND_URL || "http://localhost:5000"}/api/v1/payments/webhook/koko`;

    // Calculate a standard mock hash signature for request validation
    const rawSignature = `${merchantId}|${order.id}|${order.totalAmount}|LKR|${merchantSecret}`;
    const signature = crypto.createHash("sha256").update(rawSignature).digest("hex");

    return {
        merchant_id: merchantId,
        order_id: String(order.id),
        order_number: order.orderNumber,
        amount: order.totalAmount,
        currency: "LKR",
        customer_name: user?.name || "Customer",
        customer_email: user?.email || "customer@example.com",
        customer_phone: user?.phone || "0770000000",
        return_url: returnUrl,
        cancel_url: cancelUrl,
        notify_url: webhookUrl,
        signature: signature,
        // Gateway endpoint to submit/redirect to
        action_url: process.env.KOKO_PAYMENT_URL || "https://gateway.koko.lk/checkout",
    };
};

/**
 * Verifies the incoming Koko webhook payload signature to prevent tampering.
 * 
 * @param {Object} paymentData - req.body sent by Koko webhook.
 * @param {string} merchantSecret - Koko merchant secret key.
 * @return {boolean} True if signature is valid, false otherwise.
 */
export const verifyKokoWebhookHash = (paymentData, merchantSecret) => {
    try {
        // If testing without secret set in .env, permit verification in mock mode
        if (!merchantSecret || merchantSecret === "MOCK_KOKO_SECRET") {
            console.log("[Koko Service] Running in mock/development mode. Skipping strict hash check.");
            return true;
        }

        const { order_id, amount, status, signature } = paymentData;

        // Standard HMAC-SHA256 signature verification logic
        const expectedSignature = crypto
            .createHmac("sha256", merchantSecret)
            .update(`${order_id}|${amount}|${status}`)
            .digest("hex");

        return signature === expectedSignature;
    } catch (error) {
        console.error("verifyKokoWebhookHash error:", error);
        return false;
    }
};