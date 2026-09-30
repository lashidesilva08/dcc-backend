import prisma from '../config/prisma.js'
import emailService from '../services/email.service.js'
import notificationService from '../services/notification.service.js'

/* ------------------------------------------------------------------ *
 * Status rules
 * ------------------------------------------------------------------ */

export const SELLER_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'suspended',
  'removed',
]

/**
 * Allowed transitions:
 *   pending   -> approved | rejected | removed
 *   approved  -> suspended | removed
 *   suspended -> approved (reinstate) | removed
 *   rejected  -> approved (reconsider) | removed
 *   removed   -> (final)
 */
const ALLOWED_TRANSITIONS = {
  pending: ['approved', 'rejected', 'removed'],
  approved: ['suspended', 'removed'],
  suspended: ['approved', 'removed'],
  rejected: ['approved', 'removed'],
  removed: [],
}

const REASON_REQUIRED = ['rejected', 'suspended']

const normalizeStatus = (status) => {
  const value = String(status || '').trim().toLowerCase()
  return SELLER_STATUSES.includes(value) ? value : 'pending'
}

const parseId = (value) => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

const maskAccountNumber = (value) => {
  if (!value) return null
  const text = String(value)
  return text.length <= 4 ? text : `${'*'.repeat(text.length - 4)}${text.slice(-4)}`
}

const formatSeller = (seller) => ({
  id: seller.id,
  shopName: seller.shopName,
  shopUrl: seller.shopUrl,
  businessType: seller.businessType,
  status: normalizeStatus(seller.status),
  commissionRate: seller.commissionRate,
  rating: seller.rating,
  reviewCount: seller.reviewCount,
  productCount: seller.productCount,
  image: seller.image,
  bannerImage: seller.bannerImage,
  location: seller.location,
  address: seller.address,
  description: seller.description,
  memberSince: seller.memberSince,
  createdAt: seller.createdAt,
  updatedAt: seller.updatedAt,
  owner: seller.user
    ? {
        id: seller.user.id,
        name: seller.user.name,
        email: seller.user.email,
        phone: seller.user.phone,
        verified: seller.user.verified,
        createdAt: seller.user.createdAt,
      }
    : null,
})

const ownerSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  verified: true,
  createdAt: true,
}

const buildSearchWhere = (search) => {
  if (!search) return {}

  const contains = { contains: search, mode: 'insensitive' }

  return {
    OR: [
      { shopName: contains },
      { shopUrl: contains },
      { businessType: contains },
      { user: { name: contains } },
      { user: { email: contains } },
      { user: { phone: contains } },
    ],
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/v1/admin/sellers?status=&search=&page=&limit=&sort=
 * ------------------------------------------------------------------ */

export const listSellers = async (req, res) => {
  try {
    const status = String(req.query.status || 'all').trim().toLowerCase()

    if (status !== 'all' && !SELLER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status filter. Use one of: all, ${SELLER_STATUSES.join(', ')}.`,
      })
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100)
    const search = String(req.query.search || '').trim()
    const sort = String(req.query.sort || 'newest').toLowerCase()

    const where = {
      ...(status === 'all' ? { status: { not: 'removed' } } : { status }),
      ...buildSearchWhere(search),
    }

    const [total, sellers, statusGroups] = await Promise.all([
      prisma.seller.count({ where }),
      prisma.seller.findMany({
        where,
        orderBy: { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: ownerSelect } },
      }),
      // Tab badges: always the overall counts, independent of search/filter.
      prisma.seller.groupBy({ by: ['status'], _count: { _all: true } }),
    ])

    const counts = { pending: 0, approved: 0, rejected: 0, suspended: 0, removed: 0 }
    for (const group of statusGroups) {
      const key = String(group.status || '').toLowerCase()
      if (key in counts) counts[key] = group._count._all
    }
    counts.all = counts.pending + counts.approved + counts.rejected + counts.suspended

    return res.status(200).json({
      success: true,
      data: sellers.map(formatSeller),
      counts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    })
  } catch (error) {
    console.error('List sellers error:', error)

    return res.status(500).json({
      success: false,
      message: 'Failed to load sellers.',
    })
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/v1/admin/sellers/pending  (kept for backwards compatibility)
 * ------------------------------------------------------------------ */

export const getPendingSellers = async (req, res) => {
  try {
    const sellers = await prisma.seller.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: ownerSelect } },
    })

    const formatted = sellers.map(formatSeller)

    return res.status(200).json({
      success: true,
      pending: formatted,
      count: formatted.length,
    })
  } catch (error) {
    console.error('Get pending sellers error:', error)

    return res.status(500).json({
      success: false,
      message: 'Failed to load pending seller applications.',
    })
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/v1/admin/sellers/:id
 * ------------------------------------------------------------------ */

export const getSellerById = async (req, res) => {
  try {
    const sellerId = parseId(req.params.id)

    if (!sellerId) {
      return res.status(400).json({ success: false, message: 'Invalid seller ID.' })
    }

    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      include: {
        user: { select: ownerSelect },
        _count: { select: { listings: true, orderItems: true } },
      },
    })

    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found.' })
    }

    const sales = await prisma.orderItem.aggregate({
      _sum: { subtotal: true },
      where: { sellerId, order: { paymentStatus: 'paid' } },
    })

    return res.status(200).json({
      success: true,
      data: {
        ...formatSeller(seller),
        operatingHours: seller.operatingHours,
        bank: {
          bankName: seller.bankName,
          accountName: seller.bankAccountName,
          accountNumber: maskAccountNumber(seller.bankAccountNumber),
          branch: seller.bankBranch,
        },
        stats: {
          listings: seller._count.listings,
          orderItems: seller._count.orderItems,
          totalSales: sales._sum.subtotal ?? 0,
        },
      },
    })
  } catch (error) {
    console.error('Get seller error:', error)

    return res.status(500).json({
      success: false,
      message: 'Failed to load seller details.',
    })
  }
}

/* ------------------------------------------------------------------ *
 * Status change (shared by PATCH /:id/status and legacy endpoints)
 * ------------------------------------------------------------------ */

const STATUS_COPY = {
  suspended: {
    subject: 'Your seller account has been suspended',
    heading: 'Seller account suspended',
    message: (shop) =>
      `Your seller account for "${shop}" has been suspended. Your products are hidden from the marketplace until the suspension is lifted.`,
    notificationTitle: 'Seller Account Suspended',
    notificationMessage:
      'Your seller account has been suspended. Contact support for more information.',
  },
  reinstated: {
    subject: 'Your seller account has been reinstated',
    heading: 'Seller account reinstated',
    message: (shop) =>
      `Good news. Your seller account for "${shop}" has been reinstated and your products are visible again.`,
    notificationTitle: 'Seller Account Reinstated',
    notificationMessage: 'Your seller account has been reinstated.',
  },
  removed: {
    subject: 'Your seller account has been removed',
    heading: 'Seller account removed',
    message: (shop) =>
      `Your seller account for "${shop}" has been removed from Digital City Center.`,
    notificationTitle: 'Seller Account Removed',
    notificationMessage: 'Your seller account has been removed from the marketplace.',
  },
}

/**
 * Sends the email + in-app notification for a completed change.
 * Failures are logged and never block the admin action.
 * Returns whether the email was sent.
 */
const notifySeller = async ({ seller, previous, target, reason }) => {
  const owner = seller.user
  let emailSent = false

  try {
    if (target === 'approved' && previous !== 'suspended') {
      await emailService.sendSellerApproved({
        email: owner.email,
        businessName: seller.shopName,
      })
    } else if (target === 'rejected') {
      await emailService.sendSellerRejected(
        { email: owner.email, businessName: seller.shopName },
        reason
      )
    } else {
      const key = target === 'approved' ? 'reinstated' : target
      const copy = STATUS_COPY[key]

      await emailService.sendSellerStatusChange(
        { email: owner.email, businessName: seller.shopName },
        { subject: copy.subject, heading: copy.heading, message: copy.message(seller.shopName), reason }
      )
    }
    emailSent = true
  } catch (error) {
    console.error(`Seller ${target} email failed:`, error)
  }

  try {
    if (target === 'approved' && previous !== 'suspended') {
      await notificationService.sellerApproved(owner.id)
    } else if (target === 'rejected') {
      await notificationService.sellerRejected(owner.id)
    } else {
      const key = target === 'approved' ? 'reinstated' : target
      const copy = STATUS_COPY[key]

      await notificationService.create({
        userId: owner.id,
        title: copy.notificationTitle,
        message: copy.notificationMessage,
        type: 'SELLER',
        link: '/seller',
      })
    }
  } catch (error) {
    console.error(`Seller ${target} notification failed:`, error)
  }

  return emailSent
}

const changeSellerStatus = async (req, res, requestedStatus) => {
  try {
    const sellerId = parseId(req.params.id)

    if (!sellerId) {
      return res.status(400).json({ success: false, message: 'Invalid seller ID.' })
    }

    const target = String(requestedStatus || '').trim().toLowerCase()

    if (!SELLER_STATUSES.includes(target) || target === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Status must be one of: approved, rejected, suspended, removed.',
      })
    }

    const reason = String(req.body?.reason || '').trim()

    if (REASON_REQUIRED.includes(target) && !reason) {
      return res.status(400).json({
        success: false,
        message: `A reason is required to ${target === 'rejected' ? 'reject' : 'suspend'} a seller.`,
      })
    }

    if (reason.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Reason must be 1000 characters or fewer.',
      })
    }

    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      include: { user: { select: { id: true, name: true, email: true } } },
    })

    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found.' })
    }

    const previous = normalizeStatus(seller.status)

    if (previous === target) {
      return res.status(409).json({
        success: false,
        message: `Seller is already ${target}.`,
      })
    }

    if (!ALLOWED_TRANSITIONS[previous].includes(target)) {
      return res.status(409).json({
        success: false,
        message: `A ${previous} seller cannot be changed to ${target}.`,
      })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.seller.update({
        where: { id: sellerId },
        data: {
          status: target,
          ...(target === 'approved' && !seller.memberSince
            ? { memberSince: new Date() }
            : {}),
        },
      })

      // Hide the seller's live listings while suspended or removed.
      if (target === 'suspended' || target === 'removed') {
        await tx.listing.updateMany({
          where: { sellerId, status: 'active' },
          data: { status: 'suspended' },
        })
      }

      // Restore only the listings that the suspension itself hid.
      if (previous === 'suspended' && target === 'approved') {
        await tx.listing.updateMany({
          where: { sellerId, status: 'suspended' },
          data: { status: 'active' },
        })
      }

      return result
    })

    const emailSent = await notifySeller({ seller, previous, target, reason })

    const labels = {
      approved: previous === 'suspended' ? 'reinstated' : 'approved',
      rejected: 'rejected',
      suspended: 'suspended',
      removed: 'removed',
    }

    return res.status(200).json({
      success: true,
      message: `Seller ${labels[target]} successfully.`,
      emailSent,
      seller: {
        id: updated.id,
        shopName: updated.shopName,
        status: updated.status,
        previousStatus: previous,
        memberSince: updated.memberSince,
      },
    })
  } catch (error) {
    console.error('Change seller status error:', error)

    return res.status(500).json({
      success: false,
      message: 'Failed to update seller status.',
    })
  }
}

// PATCH /api/v1/admin/sellers/:id/status   body: { status, reason? }
export const updateSellerStatus = (req, res) =>
  changeSellerStatus(req, res, req.body?.status)

// Legacy endpoints kept so existing clients and Postman collections keep working.
export const approveSeller = (req, res) => changeSellerStatus(req, res, 'approved')
export const rejectSeller = (req, res) => changeSellerStatus(req, res, 'rejected')
export const suspendSeller = (req, res) => changeSellerStatus(req, res, 'suspended')