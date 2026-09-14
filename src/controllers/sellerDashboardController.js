import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function getStartOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function getEndOfToday() {
  const date = new Date()
  date.setHours(23, 59, 59, 999)
  return date
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

export const getSellerDashboard = async (req, res) => {
  try {
    const userId = req.user.id

    
    // 1. Find seller

    const seller = await prisma.seller.findUnique({
      where: {
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    })

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      })
    }

    
    // 2. Check seller approval

    if (String(seller.status).toLowerCase() !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Your seller account has not been approved yet.',
        status: seller.status,
      })
    }

    const todayStart = getStartOfToday()
    const todayEnd = getEndOfToday()

    
    // 3. Listings

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


    // 4. Low stock listings
    // Product stock is stored inside ProductVariant.

    const lowStockVariants = await prisma.productVariant.findMany({
      where: {
        listing: {
          sellerId: seller.id,
        },
        stock: {
          gt: 0,
          lte: 5,
        },
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
      orderBy: {
        stock: 'asc',
      },
      take: 10,
    })

    const lowStockProducts = lowStockVariants.map((variant) => ({
      variantId: variant.id,
      listingId: variant.listingId,
      title: variant.listing?.title || 'Unknown listing',
      stock: variant.stock,
      status: variant.listing?.status,
    }))


    // 5. Today's seller orders

    const todayOrderItems = await prisma.orderItem.findMany({
      where: {
        sellerId: seller.id,
        order: {
          createdAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            createdAt: true,
            orderStatus: true,
            paymentStatus: true,
            totalAmount: true,
            deliveryAddress: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        variant: {
          include: {
            listing: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: {
        order: {
          createdAt: 'desc',
        },
      },
    })


    // 6. Group today's order items by order

    const todayOrdersMap = new Map()

    for (const item of todayOrderItems) {
      const order = item.order

      if (!todayOrdersMap.has(order.id)) {
        todayOrdersMap.set(order.id, {
          id: order.id,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          customer: order.user
            ? {
                id: order.user.id,
                name: order.user.name,
                email: order.user.email,
              }
            : null,
          items: [],
          sellerTotal: 0,
        })
      }

      const currentOrder = todayOrdersMap.get(order.id)

      const subtotal = Number(item.subtotal || 0)

      currentOrder.items.push({
        id: item.id,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice || 0),
        subtotal,
        itemStatus: item.itemStatus,
        product: item.variant?.listing
          ? {
              id: item.variant.listing.id,
              title: item.variant.listing.title,
            }
          : null,
      })

      currentOrder.sellerTotal += subtotal
    }

    const todayOrders = Array.from(todayOrdersMap.values()).map((order) => ({
      ...order,
      sellerTotal: roundMoney(order.sellerTotal),
    }))

    // 7. Total seller orders

    const allSellerOrderItems = await prisma.orderItem.findMany({
      where: {
        sellerId: seller.id,
      },
      select: {
        id: true,
        subtotal: true,
        quantity: true,
        orderId: true,
        itemStatus: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            createdAt: true,
            orderStatus: true,
            paymentStatus: true,
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
        order: {
          createdAt: 'desc',
        },
      },
    })

    const orderMap = new Map()

    for (const item of allSellerOrderItems) {
      if (!orderMap.has(item.orderId)) {
        orderMap.set(item.orderId, {
          id: item.order.id,
          orderNumber: item.order.orderNumber,
          createdAt: item.order.createdAt,
          orderStatus: item.order.orderStatus,
          paymentStatus: item.order.paymentStatus,
          customer: item.order.user
            ? {
                id: item.order.user.id,
                name: item.order.user.name,
                email: item.order.user.email,
              }
            : null,
          sellerTotal: 0,
        })
      }

      const order = orderMap.get(item.orderId)

      order.sellerTotal += Number(item.subtotal || 0)
    }

    const allSellerOrders = Array.from(orderMap.values())

    
    // 8. Earnings

    const completedItems = allSellerOrderItems.filter((item) => {
      const status = String(item.order.orderStatus || '').toLowerCase()

      return (
        status === 'delivered' ||
        status === 'completed'
      )
    })

    const grossEarnings = completedItems.reduce(
      (total, item) => total + Number(item.subtotal || 0),
      0
    )

    const commissionRate = Number(seller.commissionRate || 10)

    const commission =
      grossEarnings * (commissionRate / 100)

    const netEarnings = grossEarnings - commission

    
    // 9. Pending payout

    const pendingItems = allSellerOrderItems.filter((item) => {
      const status = String(item.order.orderStatus || '').toLowerCase()

      return (
        status === 'confirmed' ||
        status === 'processing' ||
        status === 'ready' ||
        status === 'dispatched' ||
        status === 'shipped'
      )
    })

    const pendingGross = pendingItems.reduce(
      (total, item) => total + Number(item.subtotal || 0),
      0
    )

    const pendingCommission =
      pendingGross * (commissionRate / 100)

    const pendingPayout =
      pendingGross - pendingCommission

    
    // 10. Recent orders

    const recentOrders = allSellerOrders
      .sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      )
      .slice(0, 5)
      .map((order) => ({
        ...order,
        sellerTotal: roundMoney(order.sellerTotal),
      }))

    
    // 11. Response

    return res.status(200).json({
      success: true,

      seller: {
        id: seller.id,
        userId: seller.userId,
        shopName: seller.shopName,
        shopUrl: seller.shopUrl,
        businessType: seller.businessType,
        status: seller.status,
        image: seller.image,
        bannerImage: seller.bannerImage,
        location: seller.location,
        rating: Number(seller.rating || 0),
        reviewCount: seller.reviewCount || 0,
        commissionRate,
        owner: seller.user,
      },

      summary: {
        totalListings,
        activeListings,
        todayOrders: todayOrders.length,
        totalOrders: allSellerOrders.length,
        grossEarnings: roundMoney(grossEarnings),
        commission: roundMoney(commission),
        netEarnings: roundMoney(netEarnings),
        pendingPayout: roundMoney(pendingPayout),
      },

      todayOrders,

      recentOrders,

      lowStockProducts,
    })
  } catch (error) {
    console.error(
      'Get seller dashboard error:',
      error
    )

    return res.status(500).json({
      success: false,
      message: 'Failed to load seller dashboard.',
    })
  }
}