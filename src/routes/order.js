import express from 'express';
import { PrismaClient } from '@prisma/client';
import { protect as authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/orders - Get all orders for the logged-in buyer (My Orders Page ekata)
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        const orders = await prisma.order.findMany({
            where: { buyerId: userId },
            include: {
                items: {
                    include: {
                        listing: {
                            select: {
                                title: true,
                                images: true // First image eka pennana one
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' } // Latest orders eka top eka
        });

        res.status(200).json(orders);
    } catch (error) {
        console.error("Fetch Orders Error:", error);
        res.status(500).json({ message: "Failed to fetch orders" });
    }
});

// GET /api/orders/:id - Get single order details (OrderSuccess.jsx eken call wenawa)
router.get('/:id', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const orderId = parseInt(req.params.id);

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: {
                    include: {
                        listing: true
                    }
                }
            }
        });

        // SECURITY CHECK: Order eka thiyenawa kiyala balanna, athi unoth 
        // eka me user ge order eka da kiyala check karanna. (Otherwise anyone can guess IDs)
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        if (order.buyerId !== userId) {
            return res.status(403).json({ message: "Unauthorized to view this order" });
        }

        res.status(200).json(order);
    } catch (error) {
        console.error("Fetch Single Order Error:", error);
        res.status(500).json({ message: "Failed to fetch order details" });
    }
});

export default router;