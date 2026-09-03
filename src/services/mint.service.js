import crypto from "crypto";

/**
 * Builds the payload required by Mint payment gateway to initiate a checkout.
 * (This is a generic implementation. Replace with actual Mint API parameters).
 */
export function getMintCheckoutParams(order, user) {
    const appId = process.env.MINT_APP_ID;
    const isSandbox = process.env.MINT_SANDBOX === "true";

    return {
        app_id: appId,
        sandbox: isSandbox,
        order_id: String(order.id),
        order_reference: order.orderNumber,
        currency: "LKR",
        amount: parseFloat(order.totalAmount).toFixed(2),
        customer_name: user.name || "Customer",
        customer_email: user.email,
        customer_phone: user.phone || "0000000000",
        billing_address: order.deliveryAddress,
        return_url: `${process.env.FRONTEND_URL}/payment/success?gateway=mint`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel?gateway=mint`,
        notify_url: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/v1/payments/webhook/mint`,
        // Hash or signature could be generated if required by Mint
    };
}

/**
 * Verifies the signature of the Mint webhook request.
 */
export function verifyMintWebhookHash(data, appSecret) {
    // Example signature verification logic for Mint.
    // Assuming Mint sends a signature in the header or payload body.
    const { order_id, amount, status, signature } = data;

    const rawString = `${order_id}${amount}${status}${appSecret}`;
    
    const expectedHash = crypto
        .createHash("sha256")
        .update(rawString)
        .digest("hex");

    return expectedHash === signature;
}
