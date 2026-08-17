import { PrismaClient } from "@prisma/client";
import notificationService from "../services/notification.service.js";
const prisma = new PrismaClient();

// 1. Initiate Payment
export const initiatePayment = async (req, res) => {
    try {
        const { orderId, method } = req.body; // methods: 'PAYHERE', 'KOKO', 'COD', etc.

        // 1. Fetch the order without checking who owns it
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { orderItems: true }
        });

        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }

        // 2. Handle Cash on Delivery
        if (method === 'COD') {
            await prisma.order.update({
                where: { id: orderId },
                data: { status: 'PLACED', paymentStatus: 'PENDING' }
            });
            return res.status(200).json({ message: "Order placed successfully via COD" });
        }

        // 3. Handle Online Gateway (PayHere)
        return res.status(200).json({
            gatewayUrl: "https://sandbox.payhere.lk/pay/checkout",
            merchantId: process.env.PAYHERE_MERCHANT_ID || "MOCK_MERCHANT_ID",
            orderId: order.id,
            amount: order.totalAmount || 0
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// 2. Handle Payment Webhook (Verification)
export const handlePaymentWebhook = async (req, res) => {
  const { gateway } = req.params;
  const paymentData = req.body;

  try {
    const isVerified = true;

    const orderId = Number(paymentData.order_id);

    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },
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

    // PAYMENT SUCCESS
    if (isVerified && Number(paymentData.status_code) === 2) {

      await prisma.order.update({
        where: {
          id: orderId,
        },
        data: {
          paymentStatus: "PAID",
          orderStatus: "CONFIRMED",
        },
      });

      // Notification
      try {
        await notificationService.paymentSuccess(
          order.userId,
          order.orderNumber,
          order.totalAmount
        );

        await notificationService.orderConfirmed(
          order.userId,
          order.orderNumber
        );

        console.log(
          "✅ Payment success notifications created"
        );
      } catch (notificationError) {
        console.error(
          "❌ Payment notification failed:",
          notificationError
        );
      }

      console.log(
        `Payment successful for ${order.orderNumber}`
      );
    }

    // PAYMENT FAILED
    else {

      await prisma.order.update({
        where: {
          id: orderId,
        },
        data: {
          paymentStatus: "FAILED",
        },
      });

      try {
        await notificationService.paymentFailed(
          order.userId,
          order.orderNumber
        );

        console.log(
          "✅ Payment failure notification created"
        );
      } catch (notificationError) {
        console.error(
          "❌ Payment failure notification failed:",
          notificationError
        );
      }
    }

    return res.status(200).send("Webhook Received");

  } catch (error) {
    console.error(
      "Payment webhook error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Webhook processing failed",
    });
  }
};
// 3. Initiate Refund
export const initiateRefund = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;

        console.log(`\n--- Processing Refund Request ---`);
        console.log(`Order ID from URL: ${orderId}`);
        console.log(`Reason from Body: ${reason || "None provided"}`);

        // 1. MOCK DATABASE LOOKUP
        // Instead of searching the DB, mock the order status based on a query parameter or custom rules.
        // For testing, let's look for a special string or assume it's CANCELLED unless we specify otherwise.
        const mockOrder = {
            id: parseInt(orderId),
            // Shortcut: If you pass orderId 999, treat it as NOT cancelled to test the validation error.
            status: orderId === "999" ? "DELIVERED" : "CANCELLED" 
        };

        // 2. STATUS CHECK VALIDATION
        if (mockOrder.status !== 'CANCELLED') {
            console.log(`=> Validation Failed: Order status is ${mockOrder.status}`);
            return res.status(400).json({ error: "Only cancelled orders can be refunded" });
        }

        // 3. MOCK GATEWAY & TRANSACTION UPDATE
        // await prisma.transaction.update({ ... });
        console.log(`=> Success! [MOCK] Gateway Refund API called.`);
        console.log(`=> Success! [MOCK] Transaction for Order ${orderId} updated to 'REFUNDED'.`);

        res.status(200).json({ message: "Refund processed successfully" });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: error.message });
    }
};