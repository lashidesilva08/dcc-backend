import crypto from "crypto";

/**
 * Generates the MD5 hash required by PayHere for the checkout form.
 *
 * Formula (PayHere docs):
 *   MD5( merchantId + orderId + amount(2dp) + currency + MD5(merchantSecret).toUpperCase() ).toUpperCase()
 */
export function generatePayHereHash(merchantId, orderId, amount, currency, merchantSecret) {
    const hashedSecret = crypto
        .createHash("md5")
        .update(merchantSecret)
        .digest("hex")
        .toUpperCase();

    const amountFormatted = parseFloat(amount).toFixed(2);

    const rawString = `${merchantId}${orderId}${amountFormatted}${currency}${hashedSecret}`;

    const hash = crypto
        .createHash("md5")
        .update(rawString)
        .digest("hex")
        .toUpperCase();

    return hash;
}

/**
 * Verifies the MD5 hash that PayHere sends in the webhook notification.
 *
 * Formula (PayHere docs):
 *   MD5( merchantId + orderId + amount(2dp) + currency + statusCode + MD5(merchantSecret).toUpperCase() ).toUpperCase()
 */
export function verifyWebhookHash(data, merchantId, merchantSecret) {
    const { merchant_order_id, payhere_amount, payhere_currency, status_code, md5sig } = data;

    const hashedSecret = crypto
        .createHash("md5")
        .update(merchantSecret)
        .digest("hex")
        .toUpperCase();

    const amountFormatted = parseFloat(payhere_amount).toFixed(2);

    const rawString = `${merchantId}${merchant_order_id}${amountFormatted}${payhere_currency}${status_code}${hashedSecret}`;

    const expectedHash = crypto
        .createHash("md5")
        .update(rawString)
        .digest("hex")
        .toUpperCase();

    return expectedHash === md5sig?.toUpperCase();
}

/**
 * Builds the full params object to return to the frontend so it can
 * submit the checkout form directly to PayHere.
 */
export function getPayHereCheckoutParams(order, user, hash) {
    const isSandbox = process.env.PAYHERE_SANDBOX === "true";
    const merchantId = process.env.PAYHERE_MERCHANT_ID;

    return {
        sandbox: isSandbox,
        gatewayUrl: isSandbox
            ? "https://sandbox.payhere.lk/pay/checkout"
            : "https://www.payhere.lk/pay/checkout",
        merchant_id: merchantId,
        return_url: `${process.env.FRONTEND_URL}/payment/success`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
        notify_url: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/v1/payments/webhook/payhere`,
        order_id: String(order.id),
        items: `Order #${order.orderNumber}`,
        currency: "LKR",
        amount: parseFloat(order.totalAmount).toFixed(2),
        first_name: user.name?.split(" ")[0] || "Customer",
        last_name: user.name?.split(" ").slice(1).join(" ") || "",
        email: user.email,
        phone: user.phone || "0000000000",
        address: order.deliveryAddress,
        city: "Colombo",
        country: "Sri Lanka",
        hash,
    };
}
