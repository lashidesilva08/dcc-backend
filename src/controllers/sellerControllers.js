import prisma from '../config/prisma.js'

function startOfToday() {
  const date = new Date()

  date.setHours(
    0,
    0,
    0,
    0
  )

  return date
}

function startOfTomorrow() {
  const date = startOfToday()

  date.setDate(
    date.getDate() + 1
  )

  return date
}

function isCancelledStatus(status) {
  return [
    'cancelled',
    'rejected',
  ].includes(
    String(status).toLowerCase()
  )
}

function isPaidOrder(order) {
  return (
    String(order.paymentStatus).toLowerCase() ===
    'paid'
  )
}

function formatMoney(value) {
  return Number(
    Number(value || 0).toFixed(2)
  )
}

/**
 * GET /api/v1/sellers/me
 *
 * Returns the logged-in seller profile.
 */
export const getMySellerProfile = async (
  req,
  res
) => {
  try {
    const seller =
      await prisma.seller.findUnique({
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
        message:
          'Seller profile not found.',
      })
    }

    return res.status(200).json({
      success: true,

      seller: {
        id: seller.id,
        userId: seller.userId,
        shopName: seller.shopName,
        shopUrl: seller.shopUrl,
        businessType:
          seller.businessType,
        image: seller.image,
        bannerImage:
          seller.bannerImage,
        status: seller.status,
        commissionRate:
          seller.commissionRate,
        rating: seller.rating,
        reviewCount:
          seller.reviewCount,
        views: seller.views,
        featured: seller.featured,
        location: seller.location,
        memberSince:
          seller.memberSince,
        productCount:
          seller.productCount,
      },

      user: seller.user,
    })
  } catch (error) {
    console.error(
      'getMySellerProfile error:',
      error
    )

    return res.status(500).json({
      success: false,
      message:
        'Failed to fetch seller profile.',
    })
  }
}

/**
 * GET /api/v1/sellers/dashboard
 *
 * Seller dashboard summary.
 */
export const getSellerDashboard =
  async (req, res) => {
    try {
      const seller = req.seller

      const todayStart =
        startOfToday()

      const tomorrowStart =
        startOfTomorrow()

      /*
       * -------------------------------------------------
       * LISTINGS
       * -------------------------------------------------
       */

      const totalListings =
        await prisma.listing.count({
          where: {
            sellerId: seller.id,
          },
        })

      const activeListings =
        await prisma.listing.count({
          where: {
            sellerId: seller.id,
            status: 'active',
          },
        })

      /*
       * -------------------------------------------------
       * SELLER ORDER ITEMS
       * -------------------------------------------------
       *
       * IMPORTANT:
       * We use OrderItem.sellerId.
       *
       * This prevents Seller A from seeing
       * Seller B's items in a multi-seller order.
       */

      const sellerOrderItems =
        await prisma.orderItem.findMany({
          where: {
            sellerId: seller.id,
          },

          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                userId: true,
                paymentStatus: true,
                orderStatus: true,
                paymentMethod: true,
                deliveryAddress: true,
                createdAt: true,
                updatedAt: true,

                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },

            variant: {
              select: {
                id: true,
                price: true,
                stock: true,
                attributes: true,

                listing: {
                  select: {
                    id: true,
                    title: true,
                  },
                },

                images: {
                  where: {
                    isMain: true,
                  },
                  take: 1,
                  select: {
                    url: true,
                  },
                },
              },
            },
          },

          orderBy: {
            createdAt: 'desc',
          },
        })

      /*
       * -------------------------------------------------
       * UNIQUE ORDERS
       * -------------------------------------------------
       */

      const orderMap =
        new Map()

      for (
        const item of sellerOrderItems
      ) {
        if (
          !orderMap.has(
            item.order.id
          )
        ) {
          orderMap.set(
            item.order.id,
            {
              ...item.order,
              sellerItems: [],
              sellerSubtotal: 0,
            }
          )
        }

        const order =
          orderMap.get(
            item.order.id
          )

        order.sellerItems.push(
          item
        )

        order.sellerSubtotal +=
          Number(item.subtotal || 0)
      }

      const sellerOrders =
        Array.from(
          orderMap.values()
        )

      /*
       * -------------------------------------------------
       * TODAY'S ORDERS
       * -------------------------------------------------
       */

      const todaysOrders =
        sellerOrders.filter(
          (order) => {
            const created =
              new Date(
                order.createdAt
              )

            return (
              created >=
                todayStart &&
              created <
                tomorrowStart
            )
          }
        )

      /*
       * -------------------------------------------------
       * PENDING ORDERS
       * -------------------------------------------------
       */

      const pendingStatuses = [
        'placed',
        'confirmed',
        'processing',
        'ready_for_pickup',
        'dispatched',
      ]

      const pendingOrders =
        sellerOrders.filter(
          (order) =>
            pendingStatuses.includes(
              String(
                order.orderStatus
              ).toLowerCase()
            )
        )

      /*
       * -------------------------------------------------
       * EARNINGS
       * -------------------------------------------------
       *
       * Only paid orders are counted.
       */

      const earningItems =
        sellerOrderItems.filter(
          (item) =>
            isPaidOrder(
              item.order
            ) &&
            !isCancelledStatus(
              item.itemStatus
            ) &&
            !isCancelledStatus(
              item.order.orderStatus
            )
        )

      const grossSales =
        earningItems.reduce(
          (sum, item) =>
            sum +
            Number(
              item.subtotal || 0
            ),
          0
        )

      const commissionRate =
        Number(
          seller.commissionRate ||
            0
        )

      const platformCommission =
        grossSales *
        (commissionRate / 100)

      const netEarnings =
        grossSales -
        platformCommission

      /*
       * NOTE:
       * There is currently no Payout model in the
       * Prisma schema.
       *
       * Therefore this is a provisional pending
       * payout calculation.
       *
       * Dev4 should replace this with actual payout
       * records when the payout module is merged.
       */

      const pendingPayout =
        Math.max(
          0,
          netEarnings
        )

      /*
       * -------------------------------------------------
       * RECENT ORDERS
       * -------------------------------------------------
       */

      const recentOrders =
        sellerOrders
          .slice(0, 5)
          .map(
            (order) => ({
              id: order.id,
              orderNumber:
                order.orderNumber,
              customer: {
                id:
                  order.user?.id,
                name:
                  order.user?.name ||
                  'Customer',
                email:
                  order.user?.email ||
                  null,
                phone:
                  order.user?.phone ||
                  null,
              },
              sellerSubtotal:
                formatMoney(
                  order.sellerSubtotal
                ),
              paymentStatus:
                order.paymentStatus,
              orderStatus:
                order.orderStatus,
              paymentMethod:
                order.paymentMethod,
              createdAt:
                order.createdAt,
              items:
                order.sellerItems.map(
                  (item) => ({
                    id: item.id,
                    quantity:
                      item.quantity,
                    unitPrice:
                      item.unitPrice,
                    subtotal:
                      item.subtotal,
                    itemStatus:
                      item.itemStatus,
                    product:
                      item.variant
                        ?.listing
                        ?.title ||
                      'Product',
                    image:
                      item.variant
                        ?.images?.[0]
                        ?.url ||
                      null,
                  })
                ),
            })
          )

      /*
       * -------------------------------------------------
       * RESPONSE
       * -------------------------------------------------
       */

      return res.status(200).json({
        success: true,

        seller: {
          id: seller.id,
          shopName:
            seller.shopName,
          shopUrl:
            seller.shopUrl,
          status:
            seller.status,
          rating:
            seller.rating,
          reviewCount:
            seller.reviewCount,
          commissionRate:
            seller.commissionRate,
        },

        stats: {
          totalListings,
          activeListings,

          totalOrders:
            sellerOrders.length,

          todaysOrders:
            todaysOrders.length,

          pendingOrders:
            pendingOrders.length,

          grossSales:
            formatMoney(
              grossSales
            ),

          platformCommission:
            formatMoney(
              platformCommission
            ),

          netEarnings:
            formatMoney(
              netEarnings
            ),

          pendingPayout:
            formatMoney(
              pendingPayout
            ),
        },

        recentOrders,
      })
    } catch (error) {
      console.error(
        'getSellerDashboard error:',
        error
      )

      return res.status(500).json({
        success: false,
        message:
          'Failed to load seller dashboard.',
      })
    }
  }