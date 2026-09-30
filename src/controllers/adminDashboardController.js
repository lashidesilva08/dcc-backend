import prisma from '../config/prisma.js'

// Transaction.status value written by paymentControllers.js on a successful payment.
const PAID_TRANSACTION_STATUSES = ['success']

/**
 * GET /api/v1/admin/dashboard
 *
 * Returns the KPI numbers for the admin dashboard plus the most recent
 * pending applications so the UI can render alerts without a second call.
 */
export const getAdminDashboard = async (req, res) => {
  try {
    const [
      totalSellers,
      totalBuyers,
      totalOrders,
      revenueAggregate,
      pendingSellerApplications,
      pendingDeliveryProviderApplications,
      sellerStatusGroups,
      recentPendingSellers,
      recentPendingProviders,
    ] = await Promise.all([
      // Removed sellers are soft-deleted, so they are not counted.
      prisma.seller.count({ where: { status: { not: 'removed' } } }),

      prisma.user.count({ where: { role: 'BUYER' } }),

      prisma.order.count(),

      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { status: { in: PAID_TRANSACTION_STATUSES } },
      }),

      prisma.seller.count({ where: { status: 'pending' } }),

      prisma.deliveryProvider.count({ where: { status: 'pending' } }),

      prisma.seller.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),

      prisma.seller.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          shopName: true,
          businessType: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      }),

      prisma.deliveryProvider.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          providerName: true,
          district: true,
          email: true,
          createdAt: true,
        },
      }),
    ])

    const sellersByStatus = {
      pending: 0,
      approved: 0,
      rejected: 0,
      suspended: 0,
      removed: 0,
    }

    for (const group of sellerStatusGroups) {
      const key = String(group.status || '').toLowerCase()
      if (key in sellersByStatus) {
        sellersByStatus[key] = group._count._all
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        currency: 'LKR',
        kpis: {
          totalSellers,
          totalBuyers,
          totalOrders,
          totalRevenue: revenueAggregate._sum.amount ?? 0,
          pendingSellerApplications,
          pendingDeliveryProviderApplications,
        },
        sellersByStatus,
        recentPendingSellers: recentPendingSellers.map((seller) => ({
          id: seller.id,
          shopName: seller.shopName,
          businessType: seller.businessType,
          ownerName: seller.user?.name ?? null,
          ownerEmail: seller.user?.email ?? null,
          createdAt: seller.createdAt,
        })),
        recentPendingDeliveryProviders: recentPendingProviders.map(
          (provider) => ({
            id: provider.id,
            name: provider.providerName,
            district: provider.district,
            email: provider.email,
            createdAt: provider.createdAt,
          })
        ),
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Admin dashboard error:', error)

    return res.status(500).json({
      success: false,
      message: 'Failed to load dashboard data.',
    })
  }
}