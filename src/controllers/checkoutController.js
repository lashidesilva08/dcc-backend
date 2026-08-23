import { PrismaClient } from '@prisma/client';
import { generatePaymentUrl } from '../helpers/paymentHelper.js';

const prisma = new PrismaClient();

// GET /api/checkout/details
export const getCheckoutDetails = async (req, res) => {
    try {
        const userId = req.user.id; // JWT token eken enawa meka (auth middleware ekak thiyenawa kiyala assume karala)

        // Cart items with product and seller details
        const cartItems = await prisma.cartItem.findMany({
            where: { userId },
            include: {
                listing: {
                    include: {
                        seller: { select: { id: true, shopName: true } }
                    }
                }
            }
        });

        // Saved addresses
        const addresses = await prisma.address.findMany({
            where: { userId },
            orderBy: { isDefault: 'desc' }
        });

        res.status(200).json({ cartItems, addresses });
    } catch (error) {
        res.status(500).json({ message: "Failed to load checkout data" });
    }
};

// POST /api/checkout/create
export const createOrder = async (req, res) => {
    const { addressId, deliveryMethod, paymentMethod } = req.body;
    const userId = req.user.id;

    try {
        // 1. Fetch Cart Items
        const cartItems = await prisma.cartItem.findMany({
            where: { userId },
            include: { listing: true }
        });

        if (cartItems.length === 0) {
            return res.status(400).json({ message: "Your cart is empty" });
        }

        // 2. Fetch Selected Address
        const address = await prisma.address.findFirst({
            where: { id: parseInt(addressId), userId }
        });
        if (!address) return res.status(404).json({ message: "Address not found" });

        // 3. Calculate Totals
        let subtotal = 0;
        cartItems.forEach(item => {
            subtotal += parseFloat(item.listing.price) * item.quantity;
        });

        // Delivery fee logic (Example)
        let deliveryFee = 0;
        if (deliveryMethod === 'PLATFORM') deliveryFee = 350;
        else if (deliveryMethod === 'THIRD_PARTY') deliveryFee = 500;
        // SELLER_PICKUP = 0

        const totalAmount = subtotal + deliveryFee;

        // 4. Database Transaction (All or nothing)
        const order = await prisma.$transaction(async (tx) => {

            // Create Order
            const newOrder = await tx.order.create({
                data: {
                    buyerId: userId,
                    deliveryAddress: address, // Save as JSON snapshot
                    deliveryMethod: deliveryMethod,
                    paymentMethod: paymentMethod,
                    total: totalAmount,
                    status: paymentMethod === 'COD' ? 'PLACED' : 'PENDING', // COD unoth plcae wenawa, online unoth pending
                    items: {
                        create: cartItems.map(item => ({
                            listingId: item.listingId,
                            sellerId: item.listing.sellerId,
                            quantity: item.quantity,
                            price: item.listing.price
                        }))
                    }
                }
            });

            // Clear the Cart
            await tx.cartItem.deleteMany({ where: { userId } });

            return newOrder;
        });

        // 5. Handle Payment Redirection
        if (paymentMethod !== 'COD') {
            // Example: PayHere Integration (Step 4 eke danna)
            const paymentUrl = await generatePaymentUrl(order, paymentMethod);

            return res.status(200).json({
                orderId: order.id,
                redirectUrl: paymentUrl // Frontend eka me url ekata redirect wenna one
            });
        } else {
            // COD ekin nam directly success page ekata yawanawa
            // TODO: Trigger SendGrid Email here for COD
            return res.status(200).json({
                orderId: order.id,
                redirectUrl: null
            });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Order creation failed" });
    }
};