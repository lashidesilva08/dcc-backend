import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const generateSlug = (shopName) => {
    return shopName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
}

export const getShopSettings = async (req, res) => {
    try {
        const userId = req.user.id

        const seller = await prisma.seller.findUnique({
            where: { userId },
            select: {
                id: true,
                shopName: true,
                shopUrl: true,
                businessType: true,
                image: true,
                bannerImage: true,
                location: true,
                description: true,
                address: true,
                operatingHours: true,
                status: true,
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
            settings: seller,
        })
    } catch (error) {
        console.error('Get shop settings error:', error)

        return res.status(500).json({
            success: false,
            message: 'Failed to load shop settings.',
        })
    }
}

export const updateShopSettings = async (req, res) => {
    try {
        const userId = req.user.id

        const seller = await prisma.seller.findUnique({
            where: { userId },
        })

        if (!seller) {
            return res.status(404).json({
                success: false,
                message: 'Seller profile not found.',
            })
        }

        const {
            shopName,
            description,
            operatingHours,
            location,
            address,
        } = req.body

        // D5-15: Validate shop name
        if (!shopName || !shopName.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Shop name is required.',
            })
        }

        const newShopName = shopName.trim()

        // D5-05: Generate shop URL slug
        const newSlug = generateSlug(newShopName)

        if (!newSlug) {
            return res.status(400).json({
                success: false,
                message: 'Invalid shop name for shop URL.',
            })
        }

        // D5-05: Validate unique shop URL
        const existingSeller = await prisma.seller.findFirst({
            where: {
                shopUrl: newSlug,
                NOT: {
                    id: seller.id,
                },
            },
        })

        if (existingSeller) {
            return res.status(409).json({
                success: false,
                message: 'This shop URL is already in use.',
            })
        }

        const updatedSeller = await prisma.seller.update({
            where: {
                id: seller.id,
            },

            data: {
                shopName: newShopName,
                shopUrl: newSlug,
                description: description?.trim() || null,
                location: location?.trim() || null,
                address: address?.trim() || null,
                operatingHours: operatingHours || null,
            },

            select: {
                id: true,
                shopName: true,
                shopUrl: true,
                businessType: true,
                image: true,
                bannerImage: true,
                location: true,
                description: true,
                address: true,
                operatingHours: true,
                status: true,
                updatedAt: true,
            },
        })

        return res.status(200).json({
            success: true,
            message: 'Shop settings updated successfully.',
            settings: updatedSeller,
        })
    } catch (error) {
        console.error('Update shop settings error:', error)

        return res.status(500).json({
            success: false,
            message: 'Failed to update shop settings.',
        })
    }
}