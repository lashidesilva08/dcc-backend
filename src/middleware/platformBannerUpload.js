import multer from 'multer'
import path from 'path'
import fs from 'fs'

const uploadDirectory = path.join(
  process.cwd(),
  'uploads',
  'platform-banners'
)

fs.mkdirSync(uploadDirectory, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory)
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase()

    cb(
      null,
      `banner-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`
    )
  },
})

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ]

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('Only JPG, PNG and WEBP images are allowed.'))
  }

  cb(null, true)
}

export const uploadPlatformBanner = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
}).single('banner')