import prisma from '../config/prisma.js'
import notificationService from '../services/notification.service.js'

/* ------------------------------------------------------------------ *
 * Vocabulary (matches values already used by orderControllers.js,
 * deliveryControllers.js and deliveryHelpers.js)
 * ------------------------------------------------------------------ */

export const ORDER_STATUSES = [
  'placed',
  'confirmed',
  'processing',
  'ready_for_pickup',
  'dispatched',
  'shipped',
  'delivered',
  'cancelled',
  'rejected',
  'refunded',
]

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded', 'partially_refunded']

// Statuses that need a written reason because they undo or void an order.
const REASON_REQUIRED_ORDER_STATUSES = ['cancelled', 'rejected', 'refunded']
const REASON_REQUIRED_PAYMENT_STATUSES = ['failed', 'refunded', 'partially_refunded']

// Terminal states: stock was already returned (or never held) for these.
const STOCK_RELEASED_STATUSES = ['cancelled', 'rejected', 'refunded']

// OrderItem.itemStatus values the seller module understands.
const ITEM_STATUS_FOR_ORDER_STATUS = {
  shipped: 'dispatched',
  refunded: 'cancelled',
}

const MAX_NOTE_LENGTH = 1000
const MAX_PAGE_SIZE = 100

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

export const parseId = (value) => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

const cleanText = (value, max = MAX_NOTE_LENGTH) => {
  if (value === undefined || value === null) return ''
  return String(value).trim().slice(0, max)
}

/** 'YYYY-MM-DD' -> Date at UTC start/end of day; returns null when invalid. */
const parseDate = (value, endOfDay = false) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

const appendHistory = (existing, status, note) => {
  const history = Array.isArray(existing) ? [...existing] : []
  history.push({
    id: `h-${Date.now()}`,
    status,
    note,
    createdAt: new Date().toISOString(),
  })
  return history
}

export const logOrderAction = (tx, { orderId, adminId, action, details = {} }) =>
  tx.orderAdminLog.create({ data: { orderId, adminId: adminId ?? null, action, details } })

/** Notifications must never break the admin action that triggered them. */
export const safeNotify = async (payload) => {
  try {
    await notificationService.create(payload)
  } catch (error) {
    console.error('Admin notification failed:', error.message)
  }
}

const distinctSellers = (orderItems = []) => {
  const map = new Map()
  orderItems.forEach((item) => {
    if (item.seller && !map.has(item.seller.id)) {
      map.set(item.seller.id, { id: item.seller.id, shopName: item.seller.shopName })
    }
  })
  return [...map.values()]
}

const formatDeliverySummary = (delivery) =>
  delivery
    ? {
        id: delivery.id,
        status: delivery.deliveryStatus,
        trackingNumber: delivery.trackingNumber,
        provider: delivery.deliveryProvider
          ? { id: delivery.deliveryProvider.id, name: delivery.deliveryProvider.providerName }
          : null,
        driver: delivery.assignedDriver
          ? { id: delivery.assignedDriver.id, name: delivery.assignedDriver.fullName }
          : null,
      }
    : null

const formatPaymentSummary = (order) => ({
  method: order.paymentMethod,
  status: order.paymentStatus,
  amount: order.totalAmount,
  gateway: order.transactions?.paymentGateway ?? null,
  transactionStatus: order.transactions?.status ?? null,
  paidAt: order.transactions?.paidAt ?? null,
})

const formatOrderSummary = (order) => {
  const disputes = order.disputes || []
  const openDisputes = disputes.filter((d) => ['open', 'under_review'].includes(d.status))
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.orderStatus,
    totalAmount: order.totalAmount,
    deliveryFee: order.deliveryFee,
    itemCount: (order.orderItems || []).reduce((sum, item) => sum + item.quantity, 0),
    buyer: order.user
      ? { id: order.user.id, name: order.user.name, email: order.user.email, phone: order.user.phone }
      : null,
    sellers: distinctSellers(order.orderItems),
    payment: formatPaymentSummary(order),
    delivery: formatDeliverySummary(order.delivery),
    dispute: {
      total: disputes.length,
      open: openDisputes.length,
      latestStatus: disputes[0]?.status ?? null,
    },
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }
}

const SUMMARY_INCLUDE = {
  user: { select: { id: true, name: true, email: true, phone: true } },
  orderItems: {
    select: {
      quantity: true,
      seller: { select: { id: true, shopName: true } },
    },
  },
  delivery: {
    select: {
      id: true,
      deliveryStatus: true,
      trackingNumber: true,
      deliveryProvider: { select: { id: true, providerName: true } },
      assignedDriver: { select: { id: true, fullName: true } },
    },
  },
  transactions: { select: { paymentGateway: true, status: true, paidAt: true } },
  disputes: { select: { id: true, status: true }, orderBy: { createdAt: 'desc' } },
}

/* ------------------------------------------------------------------ *
 * GET /api/v1/admin/orders
 * query: page, limit, search, status, paymentStatus, dateFrom, dateTo,
 *        sellerId, buyerId, seller, buyer, dispute (all|open|resolved|none), sort
 * ------------------------------------------------------------------ */
export const listAdminOrders = async (req, res) => {
  try {
    const q = req.query
    const page = Math.max(1, parseInt(q.page, 10) || 1)
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(q.limit, 10) || 20))

    const status = String(q.status || 'all').toLowerCase()
    if (status !== 'all' && !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status filter.' })
    }

    const paymentStatus = String(q.paymentStatus || 'all').toLowerCase()
    if (paymentStatus !== 'all' && !PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid payment status filter.' })
    }

    const dateFrom = q.dateFrom ? parseDate(q.dateFrom) : null
    const dateTo = q.dateTo ? parseDate(q.dateTo, true) : null
    if ((q.dateFrom && !dateFrom) || (q.dateTo && !dateTo)) {
      return res.status(400).json({ success: false, message: 'Dates must use the YYYY-MM-DD format.' })
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      return res.status(400).json({ success: false, message: 'The start date must be before the end date.' })
    }

    const dispute = String(q.dispute || 'all').toLowerCase()
    if (!['all', 'open', 'resolved', 'none'].includes(dispute)) {
      return res.status(400).json({ success: false, message: 'Invalid dispute filter.' })
    }

    // Filters shared by the table AND the status counters
    const baseAnd = []

    if (paymentStatus !== 'all') baseAnd.push({ paymentStatus })
    if (dateFrom || dateTo) {
      baseAnd.push({
        createdAt: { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) },
      })
    }

    const sellerId = q.sellerId ? parseId(q.sellerId) : null
    if (q.sellerId && !sellerId) {
      return res.status(400).json({ success: false, message: 'Invalid seller filter.' })
    }
    if (sellerId) baseAnd.push({ orderItems: { some: { sellerId } } })

    const buyerId = q.buyerId ? parseId(q.buyerId) : null
    if (q.buyerId && !buyerId) {
      return res.status(400).json({ success: false, message: 'Invalid buyer filter.' })
    }
    if (buyerId) baseAnd.push({ userId: buyerId })

    const sellerText = cleanText(q.seller, 100)
    if (sellerText) {
      baseAnd.push({
        orderItems: {
          some: { seller: { shopName: { contains: sellerText, mode: 'insensitive' } } },
        },
      })
    }

    const buyerText = cleanText(q.buyer, 100)
    if (buyerText) {
      baseAnd.push({
        user: {
          OR: [
            { name: { contains: buyerText, mode: 'insensitive' } },
            { email: { contains: buyerText, mode: 'insensitive' } },
          ],
        },
      })
    }

    if (dispute === 'open') {
      baseAnd.push({ disputes: { some: { status: { in: ['open', 'under_review'] } } } })
    } else if (dispute === 'resolved') {
      baseAnd.push({ disputes: { some: { status: { in: ['resolved', 'rejected'] } } } })
    } else if (dispute === 'none') {
      baseAnd.push({ disputes: { none: {} } })
    }

    const search = cleanText(q.search, 100)
    if (search) {
      const asNumber = parseId(search)
      baseAnd.push({
        OR: [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { orderItems: { some: { seller: { shopName: { contains: search, mode: 'insensitive' } } } } },
          { delivery: { trackingNumber: { contains: search, mode: 'insensitive' } } },
          ...(asNumber ? [{ id: asNumber }] : []),
        ],
      })
    }

    const where = {
      AND: [...baseAnd, ...(status !== 'all' ? [{ orderStatus: status }] : [])],
    }

    const orderBy =
      {
        oldest: { createdAt: 'asc' },
        amount_high: { totalAmount: 'desc' },
        amount_low: { totalAmount: 'asc' },
      }[String(q.sort || '')] || { createdAt: 'desc' }

    const [total, orders, statusGroups, openDisputes] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: SUMMARY_INCLUDE,
      }),
      prisma.order.groupBy({
        by: ['orderStatus'],
        where: { AND: baseAnd },
        _count: { _all: true },
      }),
      prisma.dispute.count({ where: { status: { in: ['open', 'under_review'] } } }),
    ])

    const statusCounts = Object.fromEntries(
      statusGroups.map((g) => [g.orderStatus, g._count._all]),
    )

    return res.status(200).json({
      success: true,
      data: orders.map(formatOrderSummary),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      stats: {
        statusCounts,
        totalMatching: statusGroups.reduce((sum, g) => sum + g._count._all, 0),
        openDisputes,
      },
    })
  } catch (error) {
    console.error('listAdminOrders error:', error)
    return res.status(500).json({ success: false, message: 'Failed to load orders.' })
  }
}

/* ------------------------------------------------------------------ *
 * Full order payload (shared by details + after-mutation responses)
 * ------------------------------------------------------------------ */
export async function loadOrderDetails(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
      orderItems: {
        orderBy: { id: 'asc' },
        include: {
          seller: {
            select: {
              id: true,
              shopName: true,
              location: true,
              address: true,
              user: { select: { id: true, name: true, email: true, phone: true } },
            },
          },
          variant: {
            select: {
              id: true,
              sku: true,
              attributes: true,
              listing: {
                select: { id: true, title: true, type: true, category: { select: { id: true, name: true } } },
              },
              images: { select: { url: true, isMain: true }, orderBy: { isMain: 'desc' }, take: 1 },
            },
          },
        },
      },
      delivery: {
        include: {
          deliveryProvider: {
            select: { id: true, providerName: true, contactPerson: true, phone: true, email: true },
          },
          assignedDriver: {
            select: { id: true, fullName: true, phone: true, vehicleType: true, vehiclePlate: true },
          },
        },
      },
      transactions: true,
      disputes: {
        orderBy: { createdAt: 'desc' },
        include: {
          openedBy: { select: { id: true, name: true, email: true } },
          resolvedBy: { select: { id: true, name: true } },
          seller: { select: { id: true, shopName: true } },
        },
      },
      adminLogs: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { admin: { select: { id: true, name: true } } },
      },
    },
  })
  if (!order) return null

  const itemsSubtotal = order.orderItems.reduce((sum, item) => sum + item.subtotal, 0)

  // Group items per seller so multi-seller orders are easy to read.
  const sellerMap = new Map()
  order.orderItems.forEach((item) => {
    const key = item.sellerId
    if (!sellerMap.has(key)) {
      sellerMap.set(key, {
        id: item.seller.id,
        shopName: item.seller.shopName,
        contact: item.seller.user,
        pickupAddress: item.seller.address || item.seller.location || null,
        subtotal: 0,
        itemStatuses: new Set(),
      })
    }
    const group = sellerMap.get(key)
    group.subtotal += item.subtotal
    group.itemStatuses.add(item.itemStatus)
  })

  const tx = order.transactions
  const delivery = order.delivery

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.orderStatus,
    notes: order.notes,
    deliveryAddress: order.deliveryAddress,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    buyer: order.user,
    sellers: [...sellerMap.values()].map((s) => ({ ...s, itemStatuses: [...s.itemStatuses] })),
    items: order.orderItems.map((item) => ({
      id: item.id,
      title: item.variant?.listing?.title ?? 'Removed listing',
      type: item.variant?.listing?.type ?? null,
      category: item.variant?.listing?.category?.name ?? null,
      sku: item.variant?.sku ?? null,
      attributes: item.variant?.attributes ?? {},
      image: item.variant?.images?.[0]?.url ?? null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      status: item.itemStatus,
      seller: { id: item.seller.id, shopName: item.seller.shopName },
    })),
    totals: {
      itemsSubtotal,
      deliveryFee: order.deliveryFee,
      totalAmount: order.totalAmount,
    },
    payment: {
      method: order.paymentMethod,
      status: order.paymentStatus,
      amount: order.totalAmount,
      transaction: tx
        ? {
            reference: tx.transactionReference,
            gateway: tx.paymentGateway,
            amount: tx.amount,
            currency: tx.currency,
            status: tx.status,
            paidAt: tx.paidAt,
            createdAt: tx.createdAt,
          }
        : null,
    },
    delivery: delivery
      ? {
          id: delivery.id,
          status: delivery.deliveryStatus,
          trackingNumber: delivery.trackingNumber,
          pickupAddress: delivery.pickupAddress,
          deliveryAddress: delivery.deliveryAddress,
          failureReason: delivery.failureReason,
          assignedAt: delivery.assignedAt,
          pickedUpAt: delivery.pickedUpAt,
          deliveredAt: delivery.deliveredAt,
          provider: delivery.deliveryProvider,
          driver: delivery.assignedDriver,
          history: Array.isArray(delivery.statusHistory) ? delivery.statusHistory : [],
        }
      : null,
    disputes: order.disputes.map((d) => ({
      id: d.id,
      disputeNumber: d.disputeNumber,
      status: d.status,
      reason: d.reason,
      description: d.description,
      resolution: d.resolution,
      refundAmount: d.refundAmount,
      resolutionNote: d.resolutionNote,
      resolvedAt: d.resolvedAt,
      openedBy: d.openedBy,
      resolvedBy: d.resolvedBy,
      seller: d.seller,
      history: Array.isArray(d.history) ? d.history : [],
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
    activity: order.adminLogs.map((log) => ({
      id: log.id,
      action: log.action,
      details: log.details,
      admin: log.admin,
      createdAt: log.createdAt,
    })),
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/v1/admin/orders/:id
 * ------------------------------------------------------------------ */
export const getAdminOrderById = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ success: false, message: 'Invalid order id.' })

    const data = await loadOrderDetails(id)
    if (!data) return res.status(404).json({ success: false, message: 'Order not found.' })

    return res.status(200).json({ success: true, data })
  } catch (error) {
    console.error('getAdminOrderById error:', error)
    return res.status(500).json({ success: false, message: 'Failed to load order.' })
  }
}

/* ------------------------------------------------------------------ *
 * PATCH /api/v1/admin/orders/:id/status      (override)
 * body: { status, note }
 * ------------------------------------------------------------------ */
export const overrideOrderStatus = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ success: false, message: 'Invalid order id.' })

    const status = String(req.body?.status || '').toLowerCase()
    const note = cleanText(req.body?.note)

    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid order status.' })
    }
    if (REASON_REQUIRED_ORDER_STATUSES.includes(status) && !note) {
      return res.status(400).json({ success: false, message: 'A reason is required for this status.' })
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { orderItems: true, delivery: true },
    })
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' })

    if (order.orderStatus === status) {
      return res.status(409).json({ success: false, message: `Order is already "${status}".` })
    }

    const itemStatus = ITEM_STATUS_FOR_ORDER_STATUS[status] ?? status
    const releasesStock =
      STOCK_RELEASED_STATUSES.includes(status) &&
      !STOCK_RELEASED_STATUSES.includes(order.orderStatus) &&
      order.orderStatus !== 'delivered'
    const reacquiresStock =
      !STOCK_RELEASED_STATUSES.includes(status) && STOCK_RELEASED_STATUSES.includes(order.orderStatus)

    if (reacquiresStock) {
      // Re-opening a cancelled order would need stock re-checks; keep that a deliberate manual step.
      return res.status(409).json({
        success: false,
        message: 'A cancelled, rejected or refunded order cannot be re-opened. Ask the buyer to place a new order.',
      })
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: { orderStatus: status } })
      await tx.orderItem.updateMany({ where: { orderId: id }, data: { itemStatus } })

      if (releasesStock) {
        for (const item of order.orderItems) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          })
        }
      }

      if (order.delivery) {
        if (status === 'cancelled' || status === 'rejected' || status === 'refunded') {
          await tx.delivery.update({
            where: { id: order.delivery.id },
            data: {
              deliveryStatus: 'CANCELLED',
              statusHistory: appendHistory(order.delivery.statusHistory, 'CANCELLED', `Order ${status} by admin`),
            },
          })
        } else if (status === 'delivered' && order.delivery.deliveryStatus !== 'DELIVERED') {
          await tx.delivery.update({
            where: { id: order.delivery.id },
            data: {
              deliveryStatus: 'DELIVERED',
              deliveredAt: new Date(),
              statusHistory: appendHistory(order.delivery.statusHistory, 'DELIVERED', 'Marked delivered by admin'),
            },
          })
        }
      }

      await logOrderAction(tx, {
        orderId: id,
        adminId: req.user.id,
        action: 'status_override',
        details: { from: order.orderStatus, to: status, note, stockReleased: releasesStock },
      })
    })

    try {
      await notificationService.orderStatus(order.userId, order.orderNumber, status)
    } catch (error) {
      console.error('Order status notification failed:', error.message)
    }

    const data = await loadOrderDetails(id)
    return res.status(200).json({ success: true, message: 'Order status updated.', data })
  } catch (error) {
    console.error('overrideOrderStatus error:', error)
    return res.status(500).json({ success: false, message: 'Failed to update order status.' })
  }
}

/* ------------------------------------------------------------------ *
 * PATCH /api/v1/admin/orders/:id/payment-status      (override)
 * body: { paymentStatus, note }
 * ------------------------------------------------------------------ */
export const overridePaymentStatus = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ success: false, message: 'Invalid order id.' })

    const paymentStatus = String(req.body?.paymentStatus || '').toLowerCase()
    const note = cleanText(req.body?.note)

    if (!PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid payment status.' })
    }
    if (REASON_REQUIRED_PAYMENT_STATUSES.includes(paymentStatus) && !note) {
      return res.status(400).json({ success: false, message: 'A reason is required for this payment status.' })
    }

    const order = await prisma.order.findUnique({ where: { id }, include: { transactions: true } })
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' })

    if (order.paymentStatus === paymentStatus) {
      return res.status(409).json({ success: false, message: `Payment is already "${paymentStatus}".` })
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: { paymentStatus } })

      if (order.transactions) {
        await tx.transaction.update({
          where: { orderId: id },
          data: {
            status: paymentStatus === 'paid' ? 'success' : paymentStatus,
            ...(paymentStatus === 'paid' && !order.transactions.paidAt ? { paidAt: new Date() } : {}),
          },
        })
      }

      await logOrderAction(tx, {
        orderId: id,
        adminId: req.user.id,
        action: 'payment_override',
        details: { from: order.paymentStatus, to: paymentStatus, note },
      })
    })

    const data = await loadOrderDetails(id)
    return res.status(200).json({ success: true, message: 'Payment status updated.', data })
  } catch (error) {
    console.error('overridePaymentStatus error:', error)
    return res.status(500).json({ success: false, message: 'Failed to update payment status.' })
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/v1/admin/orders/:id/delivery
 * body: { providerId, driverId? }
 * Assigns (or re-assigns) the delivery provider / driver for an order.
 * ------------------------------------------------------------------ */
export const assignOrderDelivery = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    const providerId = parseId(req.body?.providerId)
    const driverId = req.body?.driverId ? parseId(req.body.driverId) : null

    if (!id) return res.status(400).json({ success: false, message: 'Invalid order id.' })
    if (!providerId) return res.status(400).json({ success: false, message: 'Select a delivery provider.' })
    if (req.body?.driverId && !driverId) {
      return res.status(400).json({ success: false, message: 'Invalid driver.' })
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        delivery: true,
        orderItems: { include: { seller: { select: { shopName: true, address: true, location: true } } }, take: 1 },
      },
    })
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' })

    if (['cancelled', 'rejected', 'refunded'].includes(order.orderStatus)) {
      return res.status(409).json({ success: false, message: `A ${order.orderStatus} order cannot be delivered.` })
    }
    if (order.delivery && ['DELIVERED', 'CANCELLED'].includes(order.delivery.deliveryStatus)) {
      return res.status(409).json({
        success: false,
        message: `This delivery is already ${order.delivery.deliveryStatus.toLowerCase()}.`,
      })
    }

    const provider = await prisma.deliveryProvider.findUnique({ where: { id: providerId } })
    if (!provider) return res.status(404).json({ success: false, message: 'Delivery provider not found.' })
    if (!['active', 'approved'].includes(String(provider.status).toLowerCase())) {
      return res.status(409).json({ success: false, message: 'Only approved delivery providers can be assigned.' })
    }

    let driver = null
    if (driverId) {
      driver = await prisma.deliveryDriver.findUnique({ where: { id: driverId } })
      if (!driver || driver.providerId !== provider.id) {
        return res.status(400).json({ success: false, message: 'That driver does not belong to the selected provider.' })
      }
      if (String(driver.status).toUpperCase() !== 'ACTIVE') {
        return res.status(409).json({ success: false, message: 'That driver is not active.' })
      }
    }

    const previous = order.delivery
      ? { providerId: order.delivery.deliveryProviderId, driverId: order.delivery.assignedDriverId }
      : null
    const note = driver
      ? `Assigned to ${provider.providerName} / ${driver.fullName} by admin`
      : `Assigned to ${provider.providerName} by admin`

    const firstItem = order.orderItems[0]
    const pickupAddress =
      firstItem?.seller?.address || firstItem?.seller?.location || firstItem?.seller?.shopName || 'Seller location'

    await prisma.$transaction(async (tx) => {
      if (order.delivery) {
        const nextStatus =
          driver && ['CONFIRMED'].includes(order.delivery.deliveryStatus)
            ? 'PROCESSING'
            : order.delivery.deliveryStatus
        await tx.delivery.update({
          where: { id: order.delivery.id },
          data: {
            deliveryProviderId: provider.id,
            assignedDriverId: driver ? driver.id : null,
            assignedAt: new Date(),
            deliveryStatus: nextStatus,
            statusHistory: appendHistory(order.delivery.statusHistory, nextStatus, note),
          },
        })
      } else {
        await tx.delivery.create({
          data: {
            orderId: id,
            deliveryProviderId: provider.id,
            assignedDriverId: driver ? driver.id : null,
            trackingNumber: `TRK-${order.orderNumber}-${Date.now().toString(36).toUpperCase()}`,
            pickupAddress,
            deliveryAddress: order.deliveryAddress,
            deliveryStatus: driver ? 'PROCESSING' : 'CONFIRMED',
            assignedAt: new Date(),
            statusHistory: appendHistory([], driver ? 'PROCESSING' : 'CONFIRMED', note),
          },
        })
      }

      await logOrderAction(tx, {
        orderId: id,
        adminId: req.user.id,
        action: 'delivery_assigned',
        details: {
          previous,
          providerId: provider.id,
          providerName: provider.providerName,
          driverId: driver?.id ?? null,
          driverName: driver?.fullName ?? null,
        },
      })

      if (provider.userId) {
        await tx.deliveryNotification.create({
          data: {
            userId: provider.userId,
            title: 'New delivery assigned',
            body: `Order ${order.orderNumber} was assigned to you by an administrator.`,
          },
        })
      }
    })

    const data = await loadOrderDetails(id)
    return res.status(200).json({ success: true, message: 'Delivery assignment saved.', data })
  } catch (error) {
    console.error('assignOrderDelivery error:', error)
    return res.status(500).json({ success: false, message: 'Failed to assign delivery.' })
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/v1/admin/orders/filters/sellers
 * GET /api/v1/admin/orders/filters/buyers?search=
 * GET /api/v1/admin/orders/filters/delivery-providers
 * Lookup lists that power the filter dropdowns / assignment form.
 * ------------------------------------------------------------------ */
export const getSellerFilterOptions = async (_req, res) => {
  try {
    const sellers = await prisma.seller.findMany({
      where: { orderItems: { some: {} } },
      select: { id: true, shopName: true },
      orderBy: { shopName: 'asc' },
      take: 500,
    })
    return res.status(200).json({ success: true, data: sellers })
  } catch (error) {
    console.error('getSellerFilterOptions error:', error)
    return res.status(500).json({ success: false, message: 'Failed to load sellers.' })
  }
}

export const getBuyerFilterOptions = async (req, res) => {
  try {
    const search = cleanText(req.query.search, 100)
    const buyers = await prisma.user.findMany({
      where: {
        orders: { some: {} },
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
      take: 20,
    })
    return res.status(200).json({ success: true, data: buyers })
  } catch (error) {
    console.error('getBuyerFilterOptions error:', error)
    return res.status(500).json({ success: false, message: 'Failed to load buyers.' })
  }
}

export const getDeliveryProviderOptions = async (_req, res) => {
  try {
    const providers = await prisma.deliveryProvider.findMany({
      where: { status: { in: ['active', 'approved'] } },
      select: {
        id: true,
        providerName: true,
        serviceArea: true,
        drivers: {
          where: { status: 'ACTIVE' },
          select: { id: true, fullName: true, vehicleType: true, isAvailable: true },
          orderBy: { fullName: 'asc' },
        },
      },
      orderBy: { providerName: 'asc' },
    })
    return res.status(200).json({ success: true, data: providers })
  } catch (error) {
    console.error('getDeliveryProviderOptions error:', error)
    return res.status(500).json({ success: false, message: 'Failed to load delivery providers.' })
  }
}