import { PrismaClient } from "@prisma/client";
import notificationService from "../services/notification.service.js";

const prisma = new PrismaClient();

/**
 * 1. Initiate Payment
 *
 * POST /api/v1/payments/initiate
 */
export const initiatePayment = async (req, res) => {
  try {
    const { orderId, method } = req.body;

    if (!orderId || !method) {
      return res.status(400).json({
        success: false,
        message: "Order ID and payment method are required.",
      });
    }

    const numericOrderId = Number(orderId);

    if (!Number.isInteger(numericOrderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID.",
      });
    }

    const order = await prisma.order.findFirst({
      where: {
        id: numericOrderId,
        userId: req.user.id,
      },
      include: {
        orderItems: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    /**
     * Cash on Delivery
     */
    if (method.toLowerCase() === "cod") {
      const updatedOrder = await prisma.order.update({
        where: {
          id: order.id,
        },
        data: {
          orderStatus: "PLACED",
          paymentStatus: "PENDING",
        },
      });

      try {
        await notificationService.create({
          userId: req.user.id,
          title: "Order Placed 📦",
          message: `Your order #${order.orderNumber} has been placed successfully.`,
          type: "ORDER",
          link: `/orders/${order.orderNumber}`,
        });

        await notificationService.create({
          userId: req.user.id,
          title: "Cash on Delivery Selected 💵",
          message: `Your order #${order.orderNumber} will be paid on delivery.`,
          type: "PAYMENT",
          link: `/orders/${order.orderNumber}`,
        });

        console.log(
          "✅ COD order notifications created",
        );
      } catch (notificationError) {
        console.error(
          "❌ COD notification failed:",
          notificationError,
        );
      }

      return res.status(200).json({
        success: true,
        message: "Order placed successfully via COD.",
        order: updatedOrder,
      });
    }

    /**
     * Online Payment
     *
     * Current project uses a simulated gateway page.
     */
    return res.status(200).json({
      success: true,
      gatewayUrl: "https://sandbox.payhere.lk/pay/checkout",
      merchantId:
        process.env.PAYHERE_MERCHANT_ID ||
        "MOCK_MERCHANT_ID",
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.totalAmount || 0,
      currency: "LKR",
    });
  } catch (error) {
    console.error(
      "Initiate Payment Error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to initiate payment.",
    });
  }
};

/**
 * 2. Handle Payment Webhook
 *
 * POST /api/v1/payments/webhook
 *
 * This endpoint supports the CURRENT simulated frontend payment flow.
 *
 * Success:
 * status_code === 2
 *
 * Failed:
 * anything other than 2
 */
export const handlePaymentWebhook = async (req, res) => {
  const {
    gateway,
    order_id,
    status_code,
    amount,
    payment_method,
  } = req.body;

  try {
    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: "order_id is required.",
      });
    }

    const paymentSuccessful =
      Number(status_code) === 2;

    /**
     * The current frontend generates IDs such as:
     *
     * DCC-579266
     *
     * while the Prisma Order model uses an Int ID.
     *
     * Therefore we first try the numeric database ID.
     * If the current order is still frontend-only, we
     * fall back to the frontend order number.
     */
    let order = null;

    const numericOrderId = Number(order_id);

    if (Number.isInteger(numericOrderId)) {
      order = await prisma.order.findUnique({
        where: {
          id: numericOrderId,
        },
      });
    }

    /**
     * If order_id is something like DCC-579266,
     * try orderNumber.
     */
    if (!order) {
      order = await prisma.order.findUnique({
        where: {
          orderNumber: String(order_id),
        },
      });
    }

    /**
     * --------------------------------------------------
     * PAYMENT SUCCESS
     * --------------------------------------------------
     */
    if (paymentSuccessful) {
      console.log(
        `✅ Payment successful for order ${order_id}`,
      );

      /**
       * If the order already exists in Prisma,
       * update the real order.
       */
      if (order) {
        await prisma.order.update({
          where: {
            id: order.id,
          },
          data: {
            paymentStatus: "PAID",
            orderStatus: "CONFIRMED",
          },
        });

        /**
         * Create / update transaction record.
         */
        try {
          const transactionReference =
            `TXN-${Date.now()}-${order.id}`;

          const existingTransaction =
            await prisma.transaction.findUnique({
              where: {
                orderId: order.id,
              },
            });

          if (existingTransaction) {
            await prisma.transaction.update({
              where: {
                orderId: order.id,
              },
              data: {
                status: "SUCCESS",
                amount:
                  Number(amount) ||
                  order.totalAmount ||
                  0,
                paymentGateway:
                  gateway || payment_method || "UNKNOWN",
                paidAt: new Date(),
                gatewayResponse: req.body,
              },
            });
          } else {
            await prisma.transaction.create({
              data: {
                orderId: order.id,
                transactionReference,
                paymentGateway:
                  gateway || payment_method || "UNKNOWN",
                amount:
                  Number(amount) ||
                  order.totalAmount ||
                  0,
                currency: "LKR",
                status: "SUCCESS",
                paidAt: new Date(),
                gatewayResponse: req.body,
              },
            });
          }
        } catch (transactionError) {
          console.error(
            "⚠️ Transaction update failed:",
            transactionError,
          );
        }
      }

      /**
       * Create PAYMENT notification.
       *
       * Use req.user because the current frontend
       * calls this endpoint while the buyer is logged in.
       */
      if (req.user?.id) {
        await notificationService.create({
          userId: req.user.id,
          title: "Payment Successful 💳",
          message: `Payment of LKR ${Number(
            amount || 0,
          ).toLocaleString()} for order #${order_id} was successful.`,
          type: "PAYMENT",
          link: `/order/${order_id}/success`,
        });

        /**
         * Order confirmation notification.
         */
        await notificationService.create({
          userId: req.user.id,
          title: "Order Confirmed ✅",
          message: `Your order #${order_id} has been confirmed.`,
          type: "ORDER",
          link: `/order/${order_id}/success`,
        });

        console.log(
          "✅ Payment and order confirmation notifications created.",
        );
      }

      return res.status(200).json({
        success: true,
        paymentStatus: "PAID",
        orderStatus: "CONFIRMED",
        message: "Payment successful and notification created.",
      });
    }

    /**
     * --------------------------------------------------
     * PAYMENT FAILED
     * --------------------------------------------------
     */

    console.log(
      `❌ Payment failed for order ${order_id}`,
    );

    if (order) {
      await prisma.order.update({
        where: {
          id: order.id,
        },
        data: {
          paymentStatus: "FAILED",
        },
      });

      /**
       * Update transaction if one exists.
       */
      try {
        const existingTransaction =
          await prisma.transaction.findUnique({
            where: {
              orderId: order.id,
            },
          });

        if (existingTransaction) {
          await prisma.transaction.update({
            where: {
              orderId: order.id,
            },
            data: {
              status: "FAILED",
              gatewayResponse: req.body,
            },
          });
        }
      } catch (transactionError) {
        console.error(
          "⚠️ Failed to update transaction:",
          transactionError,
        );
      }
    }

    /**
     * Create payment failure notification.
     */
    if (req.user?.id) {
      await notificationService.create({
        userId: req.user.id,
        title: "Payment Failed ❌",
        message: `Payment for order #${order_id} could not be completed. Please try again.`,
        type: "PAYMENT",
        link: `/order/${order_id}/failed`,
      });

      console.log(
        "✅ Payment failure notification created.",
      );
    }

    return res.status(200).json({
      success: true,
      paymentStatus: "FAILED",
      message: "Payment failure processed and notification created.",
    });
  } catch (error) {
    console.error(
      "Payment Webhook Error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Webhook processing failed.",
    });
  }
};

/**
 * 3. Initiate Refund
 *
 * POST /api/v1/payments/refund/:orderId
 */
export const initiateRefund = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const numericOrderId = Number(orderId);

    if (!Number.isInteger(numericOrderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID.",
      });
    }

    const order = await prisma.order.findFirst({
      where: {
        id: numericOrderId,
        userId: req.user.id,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    if (
      String(order.orderStatus).toUpperCase() !==
      "CANCELLED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only cancelled orders can be refunded.",
      });
    }

    /**
     * Current project refund is still a mock gateway
     * operation.
     */
    console.log(
      `Refund requested for order ${order.orderNumber}`,
    );

    console.log(
      `Reason: ${reason || "None provided"}`,
    );

    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        paymentStatus: "REFUNDED",
        orderStatus: "REFUNDED",
      },
    });

    /**
     * Create refund notification.
     */
    try {
      await notificationService.create({
        userId: req.user.id,
        title: "Refund Processed 💰",
        message: `Your refund for order #${order.orderNumber} has been processed.`,
        type: "PAYMENT",
        link: `/orders/${order.orderNumber}`,
      });

      console.log(
        "✅ Refund notification created.",
      );
    } catch (notificationError) {
      console.error(
        "❌ Refund notification failed:",
        notificationError,
      );
    }

    return res.status(200).json({
      success: true,
      message: "Refund processed successfully.",
    });
  } catch (error) {
    console.error(
      "Initiate Refund Error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};