import multer from 'multer'
import path from 'path'
import fs from 'fs'

const logoDir = 'uploads/sellers/logos'
const bannerDir = 'uploads/sellers/banners'

fs.mkdirSync(logoDir, { recursive: true })
fs.mkdirSync(bannerDir, { recursive: true })

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'logo') {
            cb(null, logoDir)
        } else if (file.fieldname === 'banner') {
            cb(null, bannerDir)
        } else {
            cb(new Error('Invalid image field'))
        }
    },

    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase()

        const filename =
            `seller-${req.user.id}-${Date.now()}${extension}`

        cb(null, filename)
    },
})

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true)
    } else {
        cb(
            new Error('Only JPG, PNG and WEBP images are allowed.'),
            false
        )
    }
}

export const sellerImageUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024,
    },
})