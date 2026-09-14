import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const getSellerProfile = async (req, res) => {
  try {
    const userId = req.user.id

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
            role: true,
            verified: true,
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
        image: seller.image,
        bannerImage: seller.bannerImage,
        location: seller.location,
        status: seller.status,
        commissionRate: seller.commissionRate,
        rating: seller.rating,
        reviewCount: seller.reviewCount,
        memberSince: seller.memberSince,
        createdAt: seller.createdAt,
        updatedAt: seller.updatedAt,
      },
      user: seller.user,
    })
  } catch (error) {
    console.error('Get seller profile error:', error)

    return res.status(500).json({
      success: false,
      message: 'Failed to load seller profile.',
    })
  }
}