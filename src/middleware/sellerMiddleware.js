import prisma from '../config/prisma.js'

/**
 * Allows only users with SELLER role.
 */
export const requireSeller = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
    })
  }

  if (String(req.user.role).toUpperCase() !== 'SELLER') {
    return res.status(403).json({
      success: false,
      message: 'Seller access required.',
    })
  }

  next()
}

/**
 * Allows only APPROVED sellers.
 *
 * Important:
 * User role alone is NOT enough.
 * Seller approval is stored in Seller.status.
 */
export const requireApprovedSeller = async (
  req,
  res,
  next
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
    }

    if (
      String(req.user.role).toUpperCase() !==
      'SELLER'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Seller access required.',
      })
    }

    const seller =
      await prisma.seller.findUnique({
        where: {
          userId: req.user.id,
        },
        select: {
          id: true,
          userId: true,
          shopName: true,
          shopUrl: true,
          status: true,
          commissionRate: true,
          rating: true,
          reviewCount: true,
          productCount: true,
        },
      })

    if (!seller) {
      return res.status(403).json({
        success: false,
        message:
          'Seller profile not found.',
      })
    }

    const status =
      String(seller.status).toLowerCase()

    if (status !== 'approved') {
      return res.status(403).json({
        success: false,
        code: 'SELLER_NOT_APPROVED',
        status: seller.status,
        message:
          status === 'pending'
            ? 'Your seller account is waiting for admin approval.'
            : status === 'rejected'
              ? 'Your seller account has been rejected.'
              : 'Your seller account is not active.',
      })
    }

    req.seller = seller

    next()
  } catch (error) {
    console.error(
      'requireApprovedSeller error:',
      error
    )

    return res.status(500).json({
      success: false,
      message:
        'Failed to verify seller account.',
    })
  }
}