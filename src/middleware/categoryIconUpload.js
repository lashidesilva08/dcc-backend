import multer from 'multer'
import path from 'path'
import fs from 'fs'

export const CATEGORY_ICON_DIR = path.join(process.cwd(), 'uploads', 'categories')
export const CATEGORY_ICON_URL_PREFIX = '/uploads/categories/'

fs.mkdirSync(CATEGORY_ICON_DIR, { recursive: true })

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])
const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const MAX_ICON_BYTES = 1 * 1024 * 1024 // 1 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CATEGORY_ICON_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `cat-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`)
  },
})

const uploader = multer({
  storage,
  limits: { fileSize: MAX_ICON_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ALLOWED_MIME.has(file.mimetype) && ALLOWED_EXT.has(ext)) return cb(null, true)
    cb(new Error('Icon must be a PNG, JPG or WEBP image.'))
  },
}).single('iconFile')

/**
 * Parses an optional `iconFile` upload. Works for JSON requests too (no-op),
 * and converts multer errors into clean 400 JSON responses.
 */
export const uploadCategoryIcon = (req, res, next) => {
  uploader(req, res, (err) => {
    if (!err) return next()
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Icon image must be 1 MB or smaller.'
        : err.message || 'Icon upload failed.'
    return res.status(400).json({ success: false, message })
  })
}

/** Deletes a previously uploaded icon file (ignores external URLs / icon names). */
export const removeStoredIcon = (iconValue) => {
  if (!iconValue || !String(iconValue).startsWith(CATEGORY_ICON_URL_PREFIX)) return
  const file = path.join(CATEGORY_ICON_DIR, path.basename(iconValue))
  fs.promises.unlink(file).catch(() => {})
}