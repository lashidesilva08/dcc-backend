import express from 'express';
import { PrismaClient } from '@prisma/client';
import { protect as authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/addresses - Get all saved addresses for the logged-in user
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id; // JWT token eken enawa

        const addresses = await prisma.address.findMany({
            where: { userId },
            orderBy: { isDefault: 'desc' } // Default address eka always top eka pennanawa
        });

        res.status(200).json(addresses);
    } catch (error) {
        console.error("Fetch Addresses Error:", error);
        res.status(500).json({ message: "Failed to fetch addresses" });
    }
});

// POST /api/addresses - Add a new address (Checkout Modal eken call wenawa)
router.post('/', authenticate, async (req, res) => {
    const { label, addressLine, city, province, postalCode, phone, isDefault } = req.body;
    const userId = req.user.id;

    try {
        // If user sets this as default, unset other defaults first
        if (isDefault) {
            await prisma.address.updateMany({
                where: { userId },
                data: { isDefault: false }
            });
        }

        const newAddress = await prisma.address.create({
            data: {
                userId,
                label,
                addressLine,
                city,
                province,
                postalCode,
                phone,
                isDefault: isDefault || false
            }
        });

        res.status(201).json(newAddress);
    } catch (error) {
        console.error("Add Address Error:", error);
        res.status(500).json({ message: "Failed to add address" });
    }
});

// DELETE /api/addresses/:id - Delete an address (Bonus: UI eke delete button eka thibbota)
router.delete('/:id', authenticate, async (req, res) => {
    const userId = req.user.id;
    const addressId = parseInt(req.params.id);

    try {
        // Ensure the address belongs to the user before deleting
        const address = await prisma.address.findFirst({
            where: { id: addressId, userId }
        });

        if (!address) {
            return res.status(404).json({ message: "Address not found" });
        }

        await prisma.address.delete({
            where: { id: addressId }
        });

        res.status(200).json({ message: "Address deleted successfully" });
    } catch (error) {
        console.error("Delete Address Error:", error);
        res.status(500).json({ message: "Failed to delete address" });
    }
});

export default router;