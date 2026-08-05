import prisma from '../config/prisma.js'
import emailService from '../services/email.service.js'
import notificationService from '../services/notification.service.js'

function normalizeProviderStatus(status) {
    const raw = String(status || '').toLowerCase()
    if (raw === 'active' || raw === 'approved') return 'approved'
    if (raw === 'rejected') return 'rejected'
    if (raw === 'suspended') return 'suspended'
    return 'pending'
}

function toProviderWhereStatus(status) {
    const raw = String(status || '').toLowerCase()
    if (raw === 'approved' || raw === 'active') return { in: ['active', 'approved'] }
    if (raw === 'rejected') return 'rejected'
    if (raw === 'suspended') return 'suspended'
    if (raw === 'pending') return 'pending'
    return undefined
}

function formatAdminProvider(provider) {
    return {
        id: String(provider.id),
        name: provider.providerName,
        email: provider.email,
        status: normalizeProviderStatus(provider.status),
        submittedAt: provider.createdAt?.toISOString?.()?.slice(0, 10) ?? null,
        rejectionReason: provider.rejectionReason ?? null,
        district: provider.district ?? null,
        serviceAreas: String(provider.serviceArea || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        contactPerson: provider.contactPerson,
        phone: provider.phone,
    }
}

async function notifyProviderUser(providerUserId, title, body) {
    if (!providerUserId) return
    try {
        await prisma.deliveryNotification.create({
            data: {
                userId: providerUserId,
                title,
                body,
            },
        })
    } catch {
        // Notification failure should not block admin workflow.
    }
}

export const getPendingSellers = async (req, res) => {
    res.status(200).json({ pending: [] });
};

export const approveSeller = async (req, res) => {
    try {
        const sellerId = Number(req.params.id);
        if (!sellerId) {
            return res.status(400).json({ message: 'Invalid seller id.' });
        }

        const seller = await prisma.seller.findUnique({
            where: { id: sellerId },
            include: { user: true },
        });

        if (!seller) {
            return res.status(404).json({ message: 'Seller not found.' });
        }

        const updated = await prisma.seller.update({
            where: { id: sellerId },
            data: { status: 'approved' },
        });

        try {
            await emailService.sendSellerApproved({
                email: seller.user.email,
                businessName: seller.shopName,
            });
        } catch (mailErr) {
            console.error('Seller approval email failed:', mailErr);
        }

        try {
            await notificationService.sellerApproved(seller.user.id);
        } catch (notifErr) {
            console.error('Seller approval notification failed:', notifErr);
        }

        res.status(200).json({ message: 'Seller approved successfully.', seller: updated });
    } catch (error) {
        console.error('Approve seller error:', error);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
};

export const getSalesReport = async (req, res) => {
    res.status(200).json({ analytics: { totalEarnings: 50000, orders: 120 } });
};

export const getDisputes = async (req, res) => {
    res.status(200).json({ disputes: [] });
};

export const getDashboard = async (req, res) => {
    res.status(200).json({
        totalUsers: 100,
        totalOrders: 50,
        totalRevenue: 50000
    });
};



export const rejectSeller = async (req, res) => {
    try {
        const sellerId = Number(req.params.id);
        const { reason } = req.body;

        if (!sellerId) {
            return res.status(400).json({ message: 'Invalid seller id.' });
        }

        const seller = await prisma.seller.findUnique({
            where: { id: sellerId },
            include: { user: true },
        });

        if (!seller) {
            return res.status(404).json({ message: 'Seller not found.' });
        }

        const updated = await prisma.seller.update({
            where: { id: sellerId },
            data: { status: 'rejected' },
        });

        try {
            await emailService.sendSellerRejected(
                { email: seller.user.email, businessName: seller.shopName },
                reason || 'Not specified'
            );
        } catch (mailErr) {
            console.error('Seller rejection email failed:', mailErr);
        }

        try {
            await notificationService.sellerRejected(seller.user.id);
        } catch (notifErr) {
            console.error('Seller rejection notification failed:', notifErr);
        }

        res.status(200).json({ message: 'Seller rejected.', seller: updated });
    } catch (error) {
        console.error('Reject seller error:', error);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
};

export const suspendSeller = async (req, res) => {
    res.status(200).json({
        message: "Seller suspended"
    });
};

// Admin: Get all orders
export const getAllOrders = async (req, res) => {
    res.status(200).json({
        message: "All orders fetched"
    });
};

export const getDeliveryProviders = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1
        const limit = Number(req.query.limit) || 20
        const q = String(req.query.q || '').trim()
        const statusFilter = toProviderWhereStatus(req.query.status)

        const where = {
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(q
                ? {
                    OR: [
                        { providerName: { contains: q, mode: 'insensitive' } },
                        { email: { contains: q, mode: 'insensitive' } },
                        { contactPerson: { contains: q, mode: 'insensitive' } },
                    ],
                }
                : {}),
        }

        const [total, providers] = await Promise.all([
            prisma.deliveryProvider.count({ where }),
            prisma.deliveryProvider.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (Math.max(page, 1) - 1) * Math.max(limit, 1),
                take: Math.max(limit, 1),
            }),
        ])

        const totalPages = Math.max(1, Math.ceil(total / Math.max(limit, 1)))
        res.status(200).json({
            data: providers.map(formatAdminProvider),
            meta: {
                page: Math.max(page, 1),
                limit: Math.max(limit, 1),
                total,
                totalPages,
            },
        })
    } catch (error) {
        console.error('Get delivery providers error:', error)
        res.status(500).json({ message: 'Something went wrong. Please try again.' })
    }
}

export const approveDeliveryProvider = async (req, res) => {
    try {
        const id = Number(req.params.id)
        if (!Number.isFinite(id)) {
            return res.status(400).json({ message: 'Invalid provider id.' })
        }

        const provider = await prisma.deliveryProvider.findUnique({ where: { id } })
        if (!provider) {
            return res.status(404).json({ message: 'Delivery provider not found.' })
        }

        const updated = await prisma.deliveryProvider.update({
            where: { id },
            data: {
                status: 'active',
                rejectionReason: null,
            },
        })

        await notifyProviderUser(
            updated.userId,
            'Application approved',
            'Your delivery provider account has been approved. You can now access the delivery portal.'
        )

        res.status(200).json({
            message: 'Delivery provider approved successfully.',
            data: formatAdminProvider(updated),
        })
    } catch (error) {
        console.error('Approve delivery provider error:', error)
        res.status(500).json({ message: 'Something went wrong. Please try again.' })
    }
}

export const rejectDeliveryProvider = async (req, res) => {
    try {
        const id = Number(req.params.id)
        if (!Number.isFinite(id)) {
            return res.status(400).json({ message: 'Invalid provider id.' })
        }

        const reason = String(req.body?.reason || '').trim()
        if (!reason) {
            return res.status(400).json({ message: 'Rejection reason is required.' })
        }

        const provider = await prisma.deliveryProvider.findUnique({ where: { id } })
        if (!provider) {
            return res.status(404).json({ message: 'Delivery provider not found.' })
        }

        const updated = await prisma.deliveryProvider.update({
            where: { id },
            data: {
                status: 'rejected',
                rejectionReason: reason,
            },
        })

        await notifyProviderUser(
            updated.userId,
            'Application update',
            `Your delivery provider application was not approved. Reason: ${reason}`
        )

        res.status(200).json({
            message: 'Delivery provider rejected successfully.',
            data: formatAdminProvider(updated),
        })
    } catch (error) {
        console.error('Reject delivery provider error:', error)
        res.status(500).json({ message: 'Something went wrong. Please try again.' })
    }
}