import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

const deleteFileIfExists = (fileUrl) => {
    if (!fileUrl) return

    const relativePath = fileUrl.replace(/^\/+/, '')
    const filePath = path.join(process.cwd(), relativePath)

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
    }
}

const getFileUrl = (file) => {
    return `/uploads/${file.path
        .replace(/\\/g, '/')
        .split('uploads/')[1]}`
}

export const uploadShopLogo = async (req, res) => {
    try {
        const userId = req.user.id

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Shop logo is required.',
            })
        }

        const seller = await prisma.seller.findUnique({
            where: { userId },
            select: {
                id: true,
                image: true,
            },
        })

        if (!seller) {
            deleteFileIfExists(getFileUrl(req.file))

            return res.status(404).json({
                success: false,
                message: 'Seller profile not found.',
            })
        }

        // Remove previous logo
        deleteFileIfExists(seller.image)

        const imageUrl = getFileUrl(req.file)

        const updatedSeller = await prisma.seller.update({
            where: { id: seller.id },
            data: {
                image: imageUrl,
            },
            select: {
                id: true,
                image: true,
            },
        })

        return res.status(200).json({
            success: true,
            message: 'Shop logo uploaded successfully.',
            image: updatedSeller.image,
        })
    } catch (error) {
        console.error('Upload shop logo error:', error)

        if (req.file) {
            deleteFileIfExists(getFileUrl(req.file))
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to upload shop logo.',
        })
    }
}

export const uploadShopBanner = async (req, res) => {
    try {
        const userId = req.user.id

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Shop banner is required.',
            })
        }

        const seller = await prisma.seller.findUnique({
            where: { userId },
            select: {
                id: true,
                bannerImage: true,
            },
        })

        if (!seller) {
            deleteFileIfExists(getFileUrl(req.file))

            return res.status(404).json({
                success: false,
                message: 'Seller profile not found.',
            })
        }

        // Remove previous banner
        deleteFileIfExists(seller.bannerImage)

        const imageUrl = getFileUrl(req.file)

        const updatedSeller = await prisma.seller.update({
            where: { id: seller.id },
            data: {
                bannerImage: imageUrl,
            },
            select: {
                id: true,
                bannerImage: true,
            },
        })

        return res.status(200).json({
            success: true,
            message: 'Shop banner uploaded successfully.',
            image: updatedSeller.bannerImage,
        })
    } catch (error) {
        console.error('Upload shop banner error:', error)

        if (req.file) {
            deleteFileIfExists(getFileUrl(req.file))
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to upload shop banner.',
        })
    }
}


export const removeShopLogo = async (req, res) => {
    try {
        const userId = req.user.id

        const seller = await prisma.seller.findUnique({
            where: { userId },
            select: {
                id: true,
                image: true,
            },
        })

        if (!seller) {
            return res.status(404).json({
                success: false,
                message: 'Seller profile not found.',
            })
        }

        if (!seller.image) {
            return res.status(404).json({
                success: false,
                message: 'No shop logo found.',
            })
        }

        // Delete physical image file
        deleteFileIfExists(seller.image)

        // Remove image URL from database
        await prisma.seller.update({
            where: { id: seller.id },
            data: {
                image: null,
            },
        })

        return res.status(200).json({
            success: true,
            message: 'Shop logo removed successfully.',
        })
    } catch (error) {
        console.error('Remove shop logo error:', error)

        return res.status(500).json({
            success: false,
            message: 'Failed to remove shop logo.',
        })
    }
}

export const removeShopBanner = async (req, res) => {
    try {
        const userId = req.user.id

        const seller = await prisma.seller.findUnique({
            where: { userId },
            select: {
                id: true,
                bannerImage: true,
            },
        })

        if (!seller) {
            return res.status(404).json({
                success: false,
                message: 'Seller profile not found.',
            })
        }

        if (!seller.bannerImage) {
            return res.status(404).json({
                success: false,
                message: 'No shop banner found.',
            })
        }

        // Delete physical image file
        deleteFileIfExists(seller.bannerImage)

        // Remove image URL from database
        await prisma.seller.update({
            where: { id: seller.id },
            data: {
                bannerImage: null,
            },
        })

        return res.status(200).json({
            success: true,
            message: 'Shop banner removed successfully.',
        })
    } catch (error) {
        console.error('Remove shop banner error:', error)

        return res.status(500).json({
            success: false,
            message: 'Failed to remove shop banner.',
        })
    }
}