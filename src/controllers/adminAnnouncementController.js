import prisma from '../config/prisma.js'
import fs from 'fs'
import path from 'path'

const removeBanner = (imageUrl) => {
  if (!imageUrl?.startsWith('/uploads/platform-banners/')) return

  const filename = path.basename(imageUrl)
  const filepath = path.join(
    process.cwd(),
    'uploads',
    'platform-banners',
    filename
  )

  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath)
  }
}

const parseDate = (value) => {
  if (!value) return null

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? undefined : date
}

const validateAnnouncement = (body) => {
  if (!String(body.title || '').trim()) {
    return 'Announcement title is required.'
  }

  if (String(body.title).length > 150) {
    return 'Title cannot exceed 150 characters.'
  }

  if (
    body.type &&
    !['announcement', 'banner', 'promotion'].includes(body.type)
  ) {
    return 'Invalid announcement type.'
  }

  if (
    body.ctaTo &&
    !String(body.ctaTo).startsWith('/') &&
    !/^https:\/\/[^\s]+$/i.test(body.ctaTo)
  ) {
    return 'CTA must be a relative path or HTTPS URL.'
  }

  const startsAt = parseDate(body.startsAt)
  const expiresAt = parseDate(body.expiresAt)

  if (startsAt === undefined || expiresAt === undefined) {
    return 'Invalid scheduling date.'
  }

  if (startsAt && expiresAt && expiresAt <= startsAt) {
    return 'Expiry must be after the start date.'
  }

  return null
}

const serialize = (item) => ({
  ...item,
  enabled: Boolean(item.enabled),
})

// GET /api/v1/admin/announcements
export const getAdminAnnouncements = async (req, res) => {
  try {
    const data = await prisma.platformAnnouncement.findMany({
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    return res.json({
      success: true,
      data: data.map(serialize),
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve announcements.',
    })
  }
}

// POST /api/v1/admin/announcements
export const createAnnouncement = async (req, res) => {
  try {
    const validationError = validateAnnouncement(req.body)

    if (validationError) {
      if (req.file) removeBanner(`/uploads/platform-banners/${req.file.filename}`)

      return res.status(400).json({
        success: false,
        message: validationError,
      })
    }

    const {
      title,
      subtitle,
      description,
      type,
      ctaLabel,
      ctaTo,
      enabled,
      startsAt,
      expiresAt,
      sortOrder,
    } = req.body

    const data = await prisma.platformAnnouncement.create({
      data: {
        title: title.trim(),
        subtitle: subtitle || null,
        description: description || null,
        type: type || 'announcement',
        ctaLabel: ctaLabel || null,
        ctaTo: ctaTo || null,
        enabled: enabled === undefined
          ? true
          : String(enabled) === 'true',
        startsAt: parseDate(startsAt),
        expiresAt: parseDate(expiresAt),
        sortOrder: Number(sortOrder) || 0,
        imageUrl: req.file
          ? `/uploads/platform-banners/${req.file.filename}`
          : null,
      },
    })

    return res.status(201).json({
      success: true,
      message: 'Announcement created successfully.',
      data,
    })
  } catch (error) {
    if (req.file) removeBanner(`/uploads/platform-banners/${req.file.filename}`)
    console.error(error)

    return res.status(500).json({
      success: false,
      message: 'Unable to create announcement.',
    })
  }
}

// PATCH /api/v1/admin/announcements/:id
export const updateAnnouncement = async (req, res) => {
  try {
    const existing = await prisma.platformAnnouncement.findUnique({
      where: { id: req.params.id },
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found.',
      })
    }

    const validationError = validateAnnouncement({
      ...existing,
      ...req.body,
    })

    if (validationError) {
      if (req.file) removeBanner(`/uploads/platform-banners/${req.file.filename}`)

      return res.status(400).json({
        success: false,
        message: validationError,
      })
    }

    const body = req.body
    const data = {}

    for (const key of [
      'title',
      'subtitle',
      'description',
      'type',
      'ctaLabel',
      'ctaTo',
    ]) {
      if (body[key] !== undefined) {
        data[key] = body[key]
      }
    }

    if (body.enabled !== undefined) {
      data.enabled = String(body.enabled) === 'true'
    }

    if (body.startsAt !== undefined) {
      data.startsAt = parseDate(body.startsAt)
    }

    if (body.expiresAt !== undefined) {
      data.expiresAt = parseDate(body.expiresAt)
    }

    if (body.sortOrder !== undefined) {
      data.sortOrder = Number(body.sortOrder) || 0
    }

    if (req.file) {
      data.imageUrl = `/uploads/platform-banners/${req.file.filename}`
    }

    const updated = await prisma.platformAnnouncement.update({
      where: { id: req.params.id },
      data,
    })

    if (req.file && existing.imageUrl) {
      removeBanner(existing.imageUrl)
    }

    return res.json({
      success: true,
      message: 'Announcement updated successfully.',
      data: updated,
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      success: false,
      message: 'Unable to update announcement.',
    })
  }
}

// DELETE /api/v1/admin/announcements/:id
export const deleteAnnouncement = async (req, res) => {
  try {
    const existing = await prisma.platformAnnouncement.findUnique({
      where: { id: req.params.id },
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found.',
      })
    }

    await prisma.platformAnnouncement.delete({
      where: { id: req.params.id },
    })

    if (existing.imageUrl) {
      removeBanner(existing.imageUrl)
    }

    return res.json({
      success: true,
      message: 'Announcement deleted successfully.',
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      success: false,
      message: 'Unable to delete announcement.',
    })
  }
}

// GET /api/v1/home/announcements
export const getPublicAnnouncements = async (req, res) => {
  try {
    const now = new Date()

    const data = await prisma.platformAnnouncement.findMany({
      where: {
        enabled: true,
        AND: [
          {
            OR: [
              { startsAt: null },
              { startsAt: { lte: now } },
            ],
          },
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: now } },
            ],
          },
        ],
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    return res.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve homepage announcements.',
    })
  }
}