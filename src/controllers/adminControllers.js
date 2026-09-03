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

export const getPendingSellers =
  async (req, res) => {
    try {
      const sellers =
        await prisma.seller.findMany({
          where: {
            status: 'pending',
          },

          orderBy: {
            createdAt: 'desc',
          },

          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                verified: true,
                createdAt: true,
              },
            },
          },
        })

      const formatted =
        sellers.map(
          (seller) => ({
            id: seller.id,

            shopName:
              seller.shopName,

            shopUrl:
              seller.shopUrl,

            businessType:
              seller.businessType,

            status:
              seller.status,

            commissionRate:
              seller.commissionRate,

            rating:
              seller.rating,

            reviewCount:
              seller.reviewCount,

            image:
              seller.image,

            bannerImage:
              seller.bannerImage,

            location:
              seller.location,

            createdAt:
              seller.createdAt,

            memberSince:
              seller.memberSince,

            owner: {
              id:
                seller.user.id,

              name:
                seller.user.name,

              email:
                seller.user.email,

              phone:
                seller.user.phone,

              verified:
                seller.user.verified,

              createdAt:
                seller.user.createdAt,
            },
          })
        )

      return res.status(200).json({
        success: true,
        pending: formatted,
        count: formatted.length,
      })
    } catch (error) {
      console.error(
        'Get pending sellers error:',
        error
      )

      return res.status(500).json({
        success: false,
        message:
          'Failed to load pending seller applications.',
      })
    }
  }

export const approveSeller =
  async (req, res) => {
    try {
      const sellerId =
        Number(req.params.id)

      if (
        !Number.isInteger(
          sellerId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid seller ID.',
        })
      }

      const seller =
        await prisma.seller.findUnique(
          {
            where: {
              id: sellerId,
            },

            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          }
        )

      if (!seller) {
        return res.status(404).json({
          success: false,
          message:
            'Seller not found.',
        })
      }

      if (
        String(
          seller.status
        ).toLowerCase() ===
        'approved'
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Seller is already approved.',
        })
      }

      const updated =
        await prisma.seller.update({
          where: {
            id: sellerId,
          },

          data: {
            status: 'approved',
            memberSince:
              seller.memberSince ||
              new Date(),
          },
        })

      /*
       * Send approval email.
       */
      try {
        await emailService.sendSellerApproved({
          email:
            seller.user.email,

          businessName:
            seller.shopName,
        })
      } catch (mailError) {
        console.error(
          'Seller approval email failed:',
          mailError
        )
      }

      /*
       * Create seller notification.
       */
      try {
        await notificationService.sellerApproved(
          seller.user.id
        )
      } catch (notificationError) {
        console.error(
          'Seller approval notification failed:',
          notificationError
        )
      }

      return res.status(200).json({
        success: true,

        message:
          'Seller approved successfully.',

        seller: {
          id:
            updated.id,

          shopName:
            updated.shopName,

          status:
            updated.status,

          memberSince:
            updated.memberSince,
        },
      })
    } catch (error) {
      console.error(
        'Approve seller error:',
        error
      )

      return res.status(500).json({
        success: false,
        message:
          'Failed to approve seller.',
      })
    }
  }

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



export const rejectSeller =
  async (req, res) => {
    try {
      const sellerId =
        Number(req.params.id)

      const { reason } =
        req.body

      if (
        !Number.isInteger(
          sellerId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid seller ID.',
        })
      }

      if (
        !reason ||
        !reason.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Rejection reason is required.',
        })
      }

      const seller =
        await prisma.seller.findUnique(
          {
            where: {
              id: sellerId,
            },

            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          }
        )

      if (!seller) {
        return res.status(404).json({
          success: false,
          message:
            'Seller not found.',
        })
      }

      const updated =
        await prisma.seller.update({
          where: {
            id: sellerId,
          },

          data: {
            status: 'rejected',
          },
        })

      try {
        await emailService.sendSellerRejected(
          {
            email:
              seller.user.email,

            businessName:
              seller.shopName,
          },

          reason.trim()
        )
      } catch (emailError) {
        console.error(
          'Seller rejection email failed:',
          emailError
        )
      }

      try {
        await notificationService.sellerRejected(
          seller.user.id
        )
      } catch (notificationError) {
        console.error(
          'Seller rejection notification failed:',
          notificationError
        )
      }

      return res.status(200).json({
        success: true,

        message:
          'Seller rejected successfully.',

        seller: {
          id:
            updated.id,

          shopName:
            updated.shopName,

          status:
            updated.status,
        },
      })
    } catch (error) {
      console.error(
        'Reject seller error:',
        error
      )

      return res.status(500).json({
        success: false,
        message:
          'Failed to reject seller.',
      })
    }
  }

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