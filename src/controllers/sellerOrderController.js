const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. Get Seller Specific Orders with Filters (Points 4, 5, 6)
exports.getSellerOrders = async (req, res) => {
    try {
        const sellerId = req.seller.id; // Assume auth middleware sets this
        const { status, search } = req.query;

        const whereClause = { sellerId };

        // Filter by status
        if (status && status !== 'ALL') {
            whereClause.status = status;
        }

        // Search by Order ID (Need to join with Order table)
        if (search) {
            whereClause.order = { id: parseInt(search) };
        }

        const orderItems = await prisma.orderItem.findMany({
            where: whereClause,
            include: {
                order: {
                    include: { buyer: { select: { name: true, phone: true } } } // Point 8
                },
                listing: { select: { title: true, image: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json(orderItems);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch orders" });
    }
};

// 2. Update Order Status with Validation (Points 12-17)
exports.updateItemStatus = async (req, res) => {
    try {
        const sellerId = req.seller.id;
        const { itemId } = req.params;
        const { newStatus } = req.body;

        // POINT 18: Ensure this item ACTUALLY belongs to this seller
        const item = await prisma.orderItem.findFirst({
            where: { id: parseInt(itemId), sellerId }
        });

        if (!item) return res.status(403).json({ message: "Unauthorized: Not your order item" });

        // POINT 17: Validate allowed status changes (State Machine)
        const allowedTransitions = {
            'PENDING': ['CONFIRMED', 'REJECTED'],
            'CONFIRMED': ['PROCESSING'],
            'PROCESSING': ['READY_FOR_PICKUP'],
            'READY_FOR_PICKUP': ['DISPATCHED'],
            'DISPATCHED': [], // Cannot change once dispatched
            'REJECTED': []   // Cannot change once rejected
        };

        const allowed = allowedTransitions[item.status];
        if (!allowed.includes(newStatus)) {
            return res.status(400).json({ message: `Cannot change status from ${item.status} to ${newStatus}` });
        }

        // Update DB
        const updatedItem = await prisma.orderItem.update({
            where: { id: parseInt(itemId) },
            data: { status: newStatus }
        });

        res.status(200).json(updatedItem);
    } catch (error) {
        res.status(500).json({ message: "Failed to update status" });
    }
};