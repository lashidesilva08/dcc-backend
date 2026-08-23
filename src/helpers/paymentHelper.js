import crypto from 'crypto';

export const generatePaymentUrl = async (order, method) => {
    if (method === 'PAYHERE') {
        const orderId = order.id.toString();
        const amount = order.total.toFixed(2);
        const currency = 'LKR';

        // PayHere required MD5 hash
        const hashString = `${process.env.PAYHERE_MERCHANT_ID}${orderId}${amount}${currency}${process.env.PAYHERE_MERCHANT_SECRET}`;
        const hash = crypto.createHash('md5').update(hashString).digest('hex');

        const payload = {
            merchant_id: process.env.PAYHERE_MERCHANT_ID,
            return_url: process.env.FRONTEND_URL + `/order/${orderId}/success`, // e.g. http://localhost:3000
            cancel_url: process.env.FRONTEND_URL + `/checkout`,
            notify_url: process.env.BACKEND_URL + `/api/checkout/webhook/payhere`, // e.g. http://localhost:5000
            order_id: orderId,
            items: `Order ${orderId}`,
            amount: amount,
            currency: currency,
            hash: hash
        };

        return `https://sandbox.payhere.lk/pay/checkout?${new URLSearchParams(payload).toString()}`;
    }

    // TODO: Add KOKO, ONEPAY, MINTPAY logic here similarly
    throw new Error("Payment method not supported yet");
};