import crypto from "crypto";

/**
 * Generates checkout parameters/payload for OnePay payment gateway.
 * 
 * @param {Object} order - Prisma order object with id, orderNumber, totalAmount, etc.
 * @param {Object} user - User object with name, email, phone.
 * @return {Object} Checkout parameters needed by the frontend to redirect/submit to OnePay.
 */
export const getOnePayCheckoutParams = (order, user) => {
    const appId = process.env.ONEPAY_APP_ID || "MOCK_ONEPAY_APP_ID";
    const appSecret = process.env.ONEPAY_APP_SECRET || "MOCK_ONEPAY_APP_SECRET";
    const hashSalt = process.env.ONEPAY_HASH_SALT || "MOCK_ONEPAY_HASH_SALT";

    const returnUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/checkout/success?orderId=${order.id}`;
    const callbackUrl = `${process.env.BACKEND_URL || "http://localhost:5000"}/api/v1/payments/webhook/onepay`;

    // Generate SHA-256 hash according to standard OnePay parameter structure
    const rawHash = `${appId}${order.id}${order.totalAmount}${currencyFormatted(order.totalAmount)}${hashSalt}`;
    const hash = crypto.createHash("sha256").update(rawHash).digest("hex");

    return {
        app_id: appId,
        order_id: String(order.id),
        reference_order_id: order.orderNumber,
        amount: order.totalAmount,
        currency: "LKR",
        customer_first_name: user?.name ? user.name.split(" ")[0] : "Customer",
        customer_last_name: user?.name ? user.name.split(" ").slice(1).join(" ") || "User" : "User",
        customer_email: user?.email || "customer@example.com",
        customer_phone: user?.phone || "0770000000",
        redirect_url: returnUrl,
        callback_url: callbackUrl,
        hash: hash,
        // OnePay payment URL endpoint
        action_url: process.env.ONEPAY_PAYMENT_URL || "https://ipg.onepay.lk/api/v1/checkout",
    };
};

/**
 * Helper function to format amount to 2 decimal places if needed by gateway.
 */
const currencyFormatted = (amount) => {
    return Number(amount).toFixed(2);
};

/**
 * Verifies the incoming OnePay webhook payload signature to prevent tampering.
 * 
 * @param {Object} paymentData - req.body sent by OnePay webhook.
 * @param {string} appSecret - OnePay application secret.
 * @return {boolean} True if signature is valid, false otherwise.
 */
export const verifyOnePayWebhookHash = (paymentData, appSecret) => {
    try {
        // If testing without secret set in .env, permit verification in mock mode
        if (!appSecret || appSecret === "MOCK_ONEPAY_APP_SECRET") {
            console.log("[OnePay Service] Running in mock/development mode. Skipping strict hash check.");
            return true;
        }

        const { order_id, amount, status, hash } = paymentData;

        // Verify SHA-256 or HMAC verification hash
        const expectedHash = crypto
            .createHash("sha256")
            .update(`${order_id}${amount}${status}${appSecret}`)
            .digest("hex");

        return hash === expectedHash;
    } catch (error) {
        console.error("verifyOnePayWebhookHash error:", error);
        return false;
    }
};