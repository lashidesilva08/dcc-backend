import prisma from '../config/prisma.js'
import {
  loadOrderDetails,
  logOrderAction,
  parseId,
  safeNotify,
} from './adminOrderController.js'

/* ------------------------------------------------------------------ *
 * Dispute workflow
 *
 *   open  <->  under_review  ->  resolved | rejected   (final)
 *
 * Resolutions
 *   refund_buyer   full refund. If the order is not delivered yet it is also
 *                  cancelled (items cancelled, stock returned, delivery cancelled).
 *   partial_refund refundAmount must be > 0 and < order total.
 *   release_seller decided in the seller's favour. No money moves.
 *   dismissed      the dispute is invalid. Dispute becomes "rejected".
 * ------------------------------------------------------------------ */

export const DISPUTE_STATUSES = ['open', 'under_review', 'resolved', 'rejected']
export const DISPUTE_RESOLUTIONS = ['refund_buyer', 'partial_refund', 'release_seller', 'dismissed']

const ACTIVE_STATUSES = ['open', 'under_review']
const REASON_MIN = 3
const REASON_MAX = 120
const TEXT_MAX = 2000
const MAX_PAGE_SIZE = 100

const cleanText = (value, max = TEXT_MAX) =>
  value === undefined || value === null ? '' : String(value).trim().slice(0, max)

const roundMoney = (value) => Math.round(Number(value) * 100) / 100

const historyEntry = (adminName, event, note = '') => ({
  id: `d-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
  event,
  note,
  by: adminName || 'Admin',
  createdAt: new Date().toISOString(),
})

const appendHistory = (existing, entry) => [...(Array.isArray(existing) ? existing : []), entry]

const generateDisputeNumber = () =>
  `DSP-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`

const formatDispute = (d) => ({
  id: d.id,
  disputeNumber: d.disputeNumber,
  status: d.status,
  reason: d.reason,
  description: d.description,
  resolution: d.resolution,
  refundAmount: d.refundAmount,
  resolutionNote: d.resolutionNote,
  resolvedAt: d.resolvedAt,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
  order: d.order
    ? {
        id: d.order.id,
        orderNumber: d.order.orderNumber,
        status: d.order.orderStatus,
        paymentStatus: d.order.paymentStatus,
        totalAmount: d.order.totalAmount,
      }
    : null,
  buyer: d.openedBy ?? d.order?.user ?? null,
  seller: d.seller ?? null,
  resolvedBy: d.resolvedBy ?? null,
  history: Array.isArray(d.history) ? d.history : [],
})

const DISPUTE_INCLUDE = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      orderStatus: true,
      paymentStatus: true,
      totalAmount: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
  openedBy: { select: { id: true, name: true, email: true } },
  resolvedBy: { select: { id: true, name: true } },
  seller: { select: { id: true, shopName: true } },
}

/* ------------------------------------------------------------------ *
 * GET /api/v1/admin/disputes
 * query: status (all|open|under_review|resolved|rejected|active), search,
 *        orderId, sellerId, page, limit
 * ------------------------------------------------------------------ */
export const listDisputes = async (req, res) => {
  try {
    const q = req.query
    const page = Math.max(1, parseInt(q.page, 10) || 1)
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(q.limit, 10) || 20))
    const status = String(q.status || 'all').toLowerCase()

    if (!['all', 'active', ...DISPUTE_STATUSES].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status filter.' })
    }

    const and = []
    if (status === 'active') and.push({ status: { in: ACTIVE_STATUSES } })
    else if (status !== 'all') and.push({ status })

    if (q.orderId) {
      const orderId = parseId(q.orderId)
      if (!orderId) return res.status(400).json({ success: false, message: 'Invalid order filter.' })
      and.push({ orderId })
    }
    if (q.sellerId) {
      const sellerId = parseId(q.sellerId)
      if (!sellerId) return res.status(400).json({ success: false, message: 'Invalid seller filter.' })
      and.push({ sellerId })
    }

    const search = cleanText(q.search, 100)
    if (search) {
      and.push({
        OR: [
          { disputeNumber: { contains: search, mode: 'insensitive' } },
          { reason: { contains: search, mode: 'insensitive' } },
          { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
          { order: { user: { name: { contains: search, mode: 'insensitive' } } } },
          { order: { user: { email: { contains: search, mode: 'insensitive' } } } },
        ],
      })
    }

    const where = and.length ? { AND: and } : {}

    const [total, rows, groups] = await Promise.all([
      prisma.dispute.count({ where }),
      prisma.dispute.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: DISPUTE_INCLUDE,
      }),
      prisma.dispute.groupBy({ by: ['status'], _count: { _all: true } }),
    ])

    return res.status(200).json({
      success: true,
      data: rows.map(formatDispute),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      stats: Object.fromEntries(groups.map((g) => [g.status, g._count._all])),
    })
  } catch (error) {
    console.error('listDisputes error:', error)
    return res.status(500).json({ success: false, message: 'Failed to load disputes.' })
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/v1/admin/disputes/:id
 * ------------------------------------------------------------------ */
export const getDisputeById = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ success: false, message: 'Invalid dispute id.' })

    const dispute = await prisma.dispute.findUnique({ where: { id }, include: DISPUTE_INCLUDE })
    if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found.' })

    return res.status(200).json({ success: true, data: formatDispute(dispute) })
  } catch (error) {
    console.error('getDisputeById error:', error)
    return res.status(500).json({ success: false, message: 'Failed to load dispute.' })
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/v1/admin/orders/:id/disputes
 * body: { reason, description?, sellerId? }
 * Admin opens a dispute on behalf of the buyer (phone / email complaints).
 * ------------------------------------------------------------------ */
export const openDispute = async (req, res) => {
  try {
    const orderId = parseId(req.params.id)
    if (!orderId) return res.status(400).json({ success: false, message: 'Invalid order id.' })

    const reason = cleanText(req.body?.reason, REASON_MAX)
    const description = cleanText(req.body?.description)
    if (reason.length < REASON_MIN) {
      return res.status(400).json({ success: false, message: `Reason must be at least ${REASON_MIN} characters.` })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        disputes: { where: { status: { in: ACTIVE_STATUSES } }, select: { id: true } },
        orderItems: { select: { sellerId: true } },
      },
    })
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' })

    if (order.disputes.length) {
      return res.status(409).json({ success: false, message: 'This order already has an unresolved dispute.' })
    }

    let sellerId = null
    if (req.body?.sellerId) {
      sellerId = parseId(req.body.sellerId)
      if (!sellerId || !order.orderItems.some((item) => item.sellerId === sellerId)) {
        return res.status(400).json({ success: false, message: 'That seller is not part of this order.' })
      }
    } else {
      const sellerIds = [...new Set(order.orderItems.map((item) => item.sellerId))]
      if (sellerIds.length === 1) sellerId = sellerIds[0]
    }

    const dispute = await prisma.$transaction(async (tx) => {
      const created = await tx.dispute.create({
        data: {
          disputeNumber: generateDisputeNumber(),
          orderId,
          openedById: order.userId,
          sellerId,
          reason,
          description: description || null,
          history: [historyEntry(req.user.name, 'opened', 'Opened by admin on behalf of the buyer')],
        },
      })
      await logOrderAction(tx, {
        orderId,
        adminId: req.user.id,
        action: 'dispute_opened',
        details: { disputeId: created.id, disputeNumber: created.disputeNumber, reason },
      })
      return created
    })

    const data = await loadOrderDetails(orderId)
    return res.status(201).json({
      success: true,
      message: `Dispute ${dispute.disputeNumber} opened.`,
      data,
    })
  } catch (error) {
    console.error('openDispute error:', error)
    return res.status(500).json({ success: false, message: 'Failed to open dispute.' })
  }
}

/* ------------------------------------------------------------------ *
 * PATCH /api/v1/admin/disputes/:id/status
 * body: { status: 'open' | 'under_review', note? }
 * ------------------------------------------------------------------ */
export const updateDisputeStatus = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ success: false, message: 'Invalid dispute id.' })

    const status = String(req.body?.status || '').toLowerCase()
    const note = cleanText(req.body?.note)
    if (!ACTIVE_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Use the resolve action to close a dispute.',
      })
    }

    const dispute = await prisma.dispute.findUnique({ where: { id } })
    if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found.' })
    if (!ACTIVE_STATUSES.includes(dispute.status)) {
      return res.status(409).json({ success: false, message: 'This dispute is already closed.' })
    }
    if (dispute.status === status) {
      return res.status(409).json({ success: false, message: `Dispute is already "${status}".` })
    }

    await prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id },
        data: {
          status,
          history: appendHistory(
            dispute.history,
            historyEntry(req.user.name, status === 'under_review' ? 'review_started' : 'reopened', note),
          ),
        },
      })
      await logOrderAction(tx, {
        orderId: dispute.orderId,
        adminId: req.user.id,
        action: 'dispute_status',
        details: { disputeId: id, from: dispute.status, to: status, note },
      })
    })

    const data = await loadOrderDetails(dispute.orderId)
    return res.status(200).json({ success: true, message: 'Dispute updated.', data })
  } catch (error) {
    console.error('updateDisputeStatus error:', error)
    return res.status(500).json({ success: false, message: 'Failed to update dispute.' })
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/v1/admin/disputes/:id/resolve
 * body: { resolution, note, refundAmount? }
 * ------------------------------------------------------------------ */
export const resolveDispute = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ success: false, message: 'Invalid dispute id.' })

    const resolution = String(req.body?.resolution || '').toLowerCase()
    const note = cleanText(req.body?.note)

    if (!DISPUTE_RESOLUTIONS.includes(resolution)) {
      return res.status(400).json({ success: false, message: 'Choose a valid resolution.' })
    }
    if (note.length < REASON_MIN) {
      return res.status(400).json({ success: false, message: 'A resolution note is required.' })
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: {
        order: {
          include: { orderItems: true, delivery: true, transactions: true, user: { select: { id: true } } },
        },
      },
    })
    if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found.' })
    if (!ACTIVE_STATUSES.includes(dispute.status)) {
      return res.status(409).json({ success: false, message: 'This dispute is already closed.' })
    }

    const order = dispute.order
    const isRefund = resolution === 'refund_buyer' || resolution === 'partial_refund'
    let refundAmount = null

    if (isRefund) {
      if (!['paid', 'partially_refunded'].includes(order.paymentStatus)) {
        return res.status(400).json({
          success: false,
          message: 'This order has no captured payment to refund. Pick another resolution or fix the payment status first.',
        })
      }

      if (resolution === 'refund_buyer') {
        if (order.paymentStatus === 'partially_refunded') {
          return res.status(400).json({
            success: false,
            message: 'This order was already partially refunded. Use a partial refund for the remaining amount.',
          })
        }
        refundAmount = roundMoney(order.totalAmount)
      } else {
        refundAmount = roundMoney(req.body?.refundAmount)
        if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
          return res.status(400).json({ success: false, message: 'Enter a refund amount greater than zero.' })
        }
        if (refundAmount >= roundMoney(order.totalAmount)) {
          return res.status(400).json({
            success: false,
            message: 'A partial refund must be less than the order total. Use "Refund buyer" for a full refund.',
          })
        }
      }
    }

    const closedStatus = resolution === 'dismissed' ? 'rejected' : 'resolved'
    const cancelOrder =
      resolution === 'refund_buyer' &&
      !['delivered', 'cancelled', 'rejected', 'refunded'].includes(order.orderStatus)

    await prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id },
        data: {
          status: closedStatus,
          resolution,
          refundAmount,
          resolutionNote: note,
          resolvedById: req.user.id,
          resolvedAt: new Date(),
          history: appendHistory(
            dispute.history,
            historyEntry(
              req.user.name,
              closedStatus === 'rejected' ? 'dismissed' : 'resolved',
              `${resolution}${refundAmount ? ` (${refundAmount})` : ''}: ${note}`,
            ),
          ),
        },
      })

      if (isRefund) {
        const paymentStatus = resolution === 'refund_buyer' ? 'refunded' : 'partially_refunded'
        await tx.order.update({ where: { id: order.id }, data: { paymentStatus } })
        if (order.transactions) {
          await tx.transaction.update({ where: { orderId: order.id }, data: { status: paymentStatus } })
        }
      }

      if (cancelOrder) {
        await tx.order.update({ where: { id: order.id }, data: { orderStatus: 'cancelled' } })
        await tx.orderItem.updateMany({ where: { orderId: order.id }, data: { itemStatus: 'cancelled' } })
        for (const item of order.orderItems) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          })
        }
        if (order.delivery && !['DELIVERED', 'CANCELLED'].includes(order.delivery.deliveryStatus)) {
          await tx.delivery.update({
            where: { id: order.delivery.id },
            data: {
              deliveryStatus: 'CANCELLED',
              statusHistory: appendHistory(order.delivery.statusHistory, {
                id: `h-${Date.now()}`,
                status: 'CANCELLED',
                note: 'Order cancelled after dispute refund',
                createdAt: new Date().toISOString(),
              }),
            },
          })
        }
      }

      await logOrderAction(tx, {
        orderId: order.id,
        adminId: req.user.id,
        action: 'dispute_resolved',
        details: {
          disputeId: id,
          disputeNumber: dispute.disputeNumber,
          resolution,
          refundAmount,
          orderCancelled: cancelOrder,
          note,
        },
      })
    })

    // Let the buyer (and the seller, if known) know the outcome.
    const outcomeText = {
      refund_buyer: 'You have been refunded in full.',
      partial_refund: `A partial refund of LKR ${refundAmount?.toLocaleString?.('en-LK')} was approved.`,
      release_seller: 'The review concluded in the seller\u2019s favour.',
      dismissed: 'The dispute was closed without further action.',
    }[resolution]

    await safeNotify({
      userId: order.userId,
      title: `Dispute ${dispute.disputeNumber} resolved`,
      message: `Order ${order.orderNumber}: ${outcomeText}`,
      type: 'DISPUTE',
      link: `/orders/${order.orderNumber}`,
    })

    if (dispute.sellerId) {
      const seller = await prisma.seller.findUnique({
        where: { id: dispute.sellerId },
        select: { userId: true },
      })
      if (seller) {
        await safeNotify({
          userId: seller.userId,
          title: `Dispute ${dispute.disputeNumber} resolved`,
          message: `Order ${order.orderNumber} dispute was closed by an administrator.`,
          type: 'DISPUTE',
        })
      }
    }

    const data = await loadOrderDetails(order.id)
    return res.status(200).json({ success: true, message: 'Dispute resolved.', data })
  } catch (error) {
    console.error('resolveDispute error:', error)
    return res.status(500).json({ success: false, message: 'Failed to resolve dispute.' })
  }
}