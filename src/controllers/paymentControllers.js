import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// 1. Initiate Payment
export const initiatePayment = async (req, res) => {
    try {
        const { orderId, method } = req.body; // methods: 'PAYHERE', 'KOKO', 'COD', etc.
        const userId = req.user.id;

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true }
        });

        if (!order || order.buyerId !== userId) {
            return res.status(404).json({ error: "Order not found" });
        }

        if (method === 'COD') {
            // Cash on Delivery skips online gateway logic 
            await prisma.order.update({
                where: { id: orderId },
                data: { status: 'PLACED', paymentStatus: 'PENDING' }
            });
            return res.status(200).json({ message: "Order placed successfully via COD" });
        }

        // Logic to generate hash/signature for PayHere or other gateways
        // Returning necessary data for frontend to redirect to gateway
        res.status(200).json({
            gatewayUrl: "https://sandbox.payhere.lk/pay/checkout",
            merchantId: process.env.PAYHERE_MERCHANT_ID,
            orderId: order.id,
            amount: order.totalAmount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Handle Payment Webhook (Verification)
export const handlePaymentWebhook = async (req, res) => {
    const { gateway } = req.params;
    const paymentData = req.body;

    try {
        // The system must verify the payment before confirming the order.
        // Verification logic (MD5/SHA256 hash check) based on gateway
        
        const isVerified = true; // Placeholder for actual hash validation

        if (isVerified && paymentData.status_code === 2) { // 2 = Success in PayHere
            await prisma.order.update({
                where: { id: parseInt(paymentData.order_id) },
                data: { 
                    status: 'CONFIRMED', 
                    paymentStatus: 'PAID' 
                }
            });
            // Trigger notification to seller after confirmation[cite: 787].
        }

        res.status(200).send("Webhook Received");
    } catch (error) {
        res.status(500).json({ error: "Webhook processing failed" });
    }
};

// 3. Initiate Refund
export const initiateRefund = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;

        // Refunds are supported for cancelled or disputed orders[cite: 708, 709].
        const order = await prisma.order.findUnique({ where: { id: parseInt(orderId) } });

        if (order.status !== 'CANCELLED') {
            return res.status(400).json({ error: "Only cancelled orders can be refunded" });
        }

        // Call Gateway Refund API logic here...
        
        await prisma.transaction.update({
            where: { orderId: parseInt(orderId) },
            data: { status: 'REFUNDED' }
        });

        res.status(200).json({ message: "Refund processed successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};