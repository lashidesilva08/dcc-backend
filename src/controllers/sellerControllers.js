import prisma from '../config/prisma.js'

// GET /api/v1/seller/products
export const getProducts = async (req, res) => {
  try {
const rawSellerId = req.query.sellerId;
let whereClause = {};
if (rawSellerId) {
      const inputId = Number(rawSellerId);

      // 1. Look up the Seller profile associated with either the User ID (11) OR Seller ID (10)
      const sellerProfile = await prisma.seller.findFirst({
        where: {
          OR: [
            { userId: inputId }, // Matches User ID = 11
            { id: inputId },     // Matches Seller ID = 10
          ],
        },
      });

      // If a seller profile exists, filter strictly by its ID (10)
      if (sellerProfile) {
        whereClause.sellerId = sellerProfile.id;
      } else {
        // If no seller profile is found for ID 11, return empty results immediately
        return res.status(200).json({
          success: true,
          data: [],
        });
      }
    }  

// 2. Fetch listings strictly filtered by the resolved sellerId
    const listings = await prisma.listing.findMany({
      where: whereClause,
      include: {
        variants: {
          include: {
            images: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Format Prisma schema fields to fit frontend expectations
    const formattedProducts = listings.map((listing) => {
      const mainVariant = listing.variants[0] || {};
      const totalStock = listing.variants.reduce((acc, v) => acc + (v.stock || 0), 0);
      const mainImage = mainVariant.images?.find((img) => img.isMain)?.url || mainVariant.images?.[0]?.url || "";

      return {
        _id: String(listing.id),
        productId: mainVariant.sku || `PRD-${listing.id}`,
        name: listing.title,
        price: mainVariant.price || 0,
        labelPrice: listing.discountPrice || mainVariant.price || 0,
        stock: listing.type === "SERVICE" ? 999 : totalStock,
        isAvailable: listing.status === "active" && (listing.type === "SERVICE" || totalStock > 0),
        image: mainImage ? [mainImage] : [],
        description: listing.description,
        type: listing.type,
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedProducts,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/v1/seller/products/:id
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.listing.delete({
      where: { id: Number(id) },
    });

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
/**
 * GET /api/v1/seller/bank-details
 *
 * Returns the logged-in seller's payout bank details.
 */
export const getSellerBankDetails = async (req, res) => {
  try {
    const seller = await prisma.seller.findUnique({
      where: { userId: req.user.id },
      select: {
        id: true,
        bankName: true,
        bankAccountName: true,
        bankAccountNumber: true,
        bankBranch: true,
      },
    })

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      })
    }

    return res.status(200).json({
      success: true,
      bankDetails: {
        bankName: seller.bankName || '',
        bankAccountName: seller.bankAccountName || '',
        bankAccountNumber: seller.bankAccountNumber || '',
        bankBranch: seller.bankBranch || '',
      },
    })
  } catch (error) {
    console.error('Get seller bank details error:', error)

    return res.status(500).json({
      success: false,
      message: 'Failed to load bank details.',
    })
  }
}

/**
 * PUT /api/v1/seller/bank-details
 *
 * Creates or updates the logged-in seller's payout bank details.
 * Body: { bankName, bankAccountName, bankAccountNumber, bankBranch }
 */
export const updateSellerBankDetails = async (req, res) => {
  try {
    const { bankName, bankAccountName, bankAccountNumber, bankBranch } = req.body

    const errors = []

    if (!bankName || !String(bankName).trim()) {
      errors.push('Bank name is required.')
    }

    if (!bankAccountName || !String(bankAccountName).trim()) {
      errors.push('Account holder name is required.')
    }

    if (!bankAccountNumber || !String(bankAccountNumber).trim()) {
      errors.push('Account number is required.')
    } else if (!/^[0-9A-Za-z-]{4,34}$/.test(String(bankAccountNumber).trim())) {
      errors.push('Account number format looks invalid.')
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(' '),
        errors,
      })
    }

    const seller = await prisma.seller.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    })

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      })
    }

    const updated = await prisma.seller.update({
      where: { id: seller.id },
      data: {
        bankName: String(bankName).trim(),
        bankAccountName: String(bankAccountName).trim(),
        bankAccountNumber: String(bankAccountNumber).trim(),
        bankBranch: bankBranch ? String(bankBranch).trim() : null,
      },
      select: {
        bankName: true,
        bankAccountName: true,
        bankAccountNumber: true,
        bankBranch: true,
      },
    })

    return res.status(200).json({
      success: true,
      message: 'Bank details updated successfully.',
      bankDetails: updated,
    })
  } catch (error) {
    console.error('Update seller bank details error:', error)

    return res.status(500).json({
      success: false,
      message: 'Failed to update bank details.',
    })
  }
}

export const getSellerProfileStatus = async (req, res) => {
  try {
    const seller = await prisma.seller.findUnique({
      where: {
        userId: req.user.id,
      },
      select: {
        id: true,
        userId: true,
        shopName: true,
        shopUrl: true,
        businessType: true,
        status: true,
        image: true,
        bannerImage: true,
        location: true,
        rating: true,
        reviewCount: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found.',
      })
    }

    return res.status(200).json({
      success: true,
      seller: {
        ...seller,
        status: String(seller.status || '').toLowerCase(),
      },
    })
  } catch (error) {
    console.error('Get seller profile status error:', error)

    return res.status(500).json({
      success: false,
      message: 'Failed to load seller status.',
    })
  }
}

/**
 * GET /api/v1/seller/me
 *
 * Returns the currently logged-in seller
 * including approval status.
 */
export const getSellerMe = async (req, res) => {
  try {
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
        commissionRate: Number(seller.commissionRate || 0),
        owner: seller.user,
      },
    })
  } catch (error) {
    console.error('Get seller profile error:', error)

    return res.status(500).json({
      success: false,
      message: 'Failed to load seller profile.',
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