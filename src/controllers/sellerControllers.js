import prisma from '../config/prisma.js'

/**
 * GET /api/v1/seller/me
 *
 * Returns the currently logged-in seller
 * including approval status.
 */
export const getSellerMe = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      })
    }

    const seller = await prisma.seller.findUnique({
      where: {
        userId: req.user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            verified: true,
          },
        },
      },
    })

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found',
      })
    }

    return res.status(200).json({
      success: true,
      seller: {
        id: seller.id,
        userId: seller.userId,
        shopName: seller.shopName,
        shopUrl: seller.shopUrl,
        businessType: seller.businessType,
        image: seller.image,
        bannerImage: seller.bannerImage,

        // IMPORTANT
        status: seller.status,

        commissionRate: seller.commissionRate,
        rating: seller.rating,
        reviewCount: seller.reviewCount,
        views: seller.views,
        featured: seller.featured,
        location: seller.location,
        memberSince: seller.memberSince,
        productCount: seller.productCount,

        user: seller.user,
      },
    })
  } catch (error) {
    console.error('getSellerMe error:', error)

    return res.status(500).json({
      success: false,
      message: 'Failed to load seller information',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : undefined,
    })
  }
}


/**
 * GET /api/v1/seller/dashboard
 *
 * Seller dashboard summary.
 */
export const getSellerDashboard = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      })
    }

    const seller = await prisma.seller.findUnique({
      where: {
        userId: req.user.id,
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
    })

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found',
      })
    }

    // Do not allow unapproved sellers into dashboard data.
    if (String(seller.status).toLowerCase() !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Seller account is not approved',
        status: seller.status,
      })
    }

    // --------------------------------------------------
    // LISTINGS
    // --------------------------------------------------

    const totalListings = await prisma.listing.count({
      where: {
        sellerId: seller.id,
      },
    })

    const activeListings = await prisma.listing.count({
      where: {
        sellerId: seller.id,
        status: 'active',
      },
    })

    // --------------------------------------------------
    // LOW STOCK
    // --------------------------------------------------

    const lowStockVariants = await prisma.productVariant.findMany({
      where: {
        listing: {
          sellerId: seller.id,
        },
        stock: {
          lte: 5,
        },
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        stock: 'asc',
      },
      take: 10,
    })

    // --------------------------------------------------
    // SELLER ORDER ITEMS
    // --------------------------------------------------

    const orderItems = await prisma.orderItem.findMany({
      where: {
        sellerId: seller.id,
      },
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // --------------------------------------------------
    // UNIQUE SELLER ORDERS
    // --------------------------------------------------

    const uniqueOrdersMap = new Map()

    for (const item of orderItems) {
      if (!item.order) continue

      if (!uniqueOrdersMap.has(item.order.id)) {
        uniqueOrdersMap.set(item.order.id, {
          ...item.order,
          sellerItems: [],
        })
      }

      uniqueOrdersMap
        .get(item.order.id)
        .sellerItems
        .push(item)
    }

    const sellerOrders = Array.from(uniqueOrdersMap.values())

    // --------------------------------------------------
    // TODAY'S ORDERS
    // --------------------------------------------------

    const now = new Date()

    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)

    const endOfToday = new Date(now)
    endOfToday.setHours(23, 59, 59, 999)

    const todayOrders = sellerOrders.filter((order) => {
      const createdAt = new Date(order.createdAt)

      return (
        createdAt >= startOfToday &&
        createdAt <= endOfToday
      )
    })

    // --------------------------------------------------
    // PENDING ORDERS
    // --------------------------------------------------

    const pendingOrders = sellerOrders.filter((order) => {
      const status = String(order.orderStatus || '').toLowerCase()

      return [
        'pending',
        'processing',
        'confirmed',
      ].includes(status)
    })

    // --------------------------------------------------
    // SALES
    // --------------------------------------------------

    let grossSales = 0

    for (const item of orderItems) {
      grossSales += Number(item.subtotal || 0)
    }

    const commissionRate = Number(seller.commissionRate || 0)

    const commission =
      grossSales * (commissionRate / 100)

    const netEarnings =
      grossSales - commission

    // Until the Earnings/Payout module is integrated,
    // this is a provisional pending payout.
    const pendingPayout = netEarnings

    // --------------------------------------------------
    // RECENT ORDERS
    // --------------------------------------------------

    const recentOrders = sellerOrders
      .slice(0, 10)
      .map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        totalAmount: Number(order.totalAmount || 0),
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        customer: order.user
          ? {
              id: order.user.id,
              name: order.user.name,
              email: order.user.email,
            }
          : null,
        itemCount: order.sellerItems.reduce(
          (total, item) =>
            total + Number(item.quantity || 0),
          0
        ),
      }))

    // --------------------------------------------------
    // LOW STOCK RESPONSE
    // --------------------------------------------------

    const lowStockProducts = lowStockVariants.map(
      (variant) => ({
        variantId: variant.id,
        listingId: variant.listing?.id,
        title: variant.listing?.title,
        stock: variant.stock,
        price: Number(variant.price || 0),
      })
    )

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      seller: {
        id: seller.id,
        userId: seller.userId,
        shopName: seller.shopName,
        shopUrl: seller.shopUrl,
        status: seller.status,
        rating: seller.rating,
        reviewCount: seller.reviewCount,
        commissionRate: seller.commissionRate,
        user: seller.user,
      },

      stats: {
        totalListings,
        activeListings,
        todayOrders: todayOrders.length,
        pendingOrders: pendingOrders.length,
        grossSales,
        commission,
        netEarnings,
        pendingPayout,
      },

      // Keep a summary object as well so the frontend
      // can use either structure.
      summary: {
        totalListings,
        activeListings,
        todayOrders: todayOrders.length,
        pendingOrders: pendingOrders.length,
        grossSales,
        commission,
        netEarnings,
        pendingPayout,
      },

      todayOrders: todayOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        totalAmount: Number(order.totalAmount || 0),
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        customer: order.user
          ? {
              name: order.user.name,
              email: order.user.email,
            }
          : null,
      })),

      recentOrders,

      lowStockProducts,
    })
  } catch (error) {
    console.error('getSellerDashboard error:', error)

    return res.status(500).json({
      success: false,
      message: 'Failed to load seller dashboard',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : undefined,
    })
  }
}