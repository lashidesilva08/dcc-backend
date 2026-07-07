const LEGACY_STATUS_MAP = {
  pending: 'CONFIRMED',
  assigned: 'PROCESSING',
  picked_up: 'DISPATCHED',
  out_for_delivery: 'OUT_FOR_DELIVERY',
  delivered: 'DELIVERED',
  cancelled: 'CANCELLED',
}

export function toFrontendStatus(status) {
  if (!status) return 'CONFIRMED'
  const upper = String(status).toUpperCase()
  return LEGACY_STATUS_MAP[status] ?? upper
}

export function toDbStatus(status) {
  const upper = String(status || '').toUpperCase()
  const reverse = {
    CONFIRMED: 'CONFIRMED',
    PENDING: 'CONFIRMED',
    PROCESSING: 'PROCESSING',
    DISPATCHED: 'DISPATCHED',
    OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED',
    FAILED: 'CANCELLED',
  }
  return reverse[upper] ?? upper
}

export function toProviderStatus(status) {
  const map = {
    pending: 'PENDING',
    active: 'ACTIVE',
    approved: 'ACTIVE',
    rejected: 'REJECTED',
    suspended: 'SUSPENDED',
  }
  return map[String(status || '').toLowerCase()] ?? String(status || 'PENDING').toUpperCase()
}

export function paginate(items, { page = 1, limit = 10 } = {}) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * limit
  return {
    data: items.slice(start, start + limit),
    meta: { page: safePage, limit, total, totalPages },
  }
}

const TIMELINE_LABELS = {
  CONFIRMED: 'Order confirmed',
  PROCESSING: 'Processing',
  DISPATCHED: 'Dispatched',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

export function buildTimeline(statusHistory = [], currentStatus) {
  const order = ['CONFIRMED', 'PROCESSING', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED']
  const current = toFrontendStatus(currentStatus)
  return order.map((status) => {
    const hit = statusHistory.find((h) => toFrontendStatus(h.status) === status)
    const idx = order.indexOf(status)
    const curIdx = order.indexOf(current)
    return {
      status,
      label: TIMELINE_LABELS[status] || status,
      done: curIdx > idx || current === 'DELIVERED',
      current: status === current,
      timestamp: hit?.createdAt,
      note: hit?.note,
    }
  })
}

function mockGeo(delivery) {
  const base = 6.9271
  const lng = 79.8612
  const offset = (delivery.id % 10) * 0.002
  return {
    pickup: { latitude: base + offset, longitude: lng, label: delivery.pickupAddress },
    dropoff: { latitude: base + offset + 0.03, longitude: lng + 0.04, label: delivery.deliveryAddress },
  }
}

export function formatDelivery(delivery) {
  const order = delivery.order
  const status = toFrontendStatus(delivery.deliveryStatus)
  const statusHistory = Array.isArray(delivery.statusHistory) ? delivery.statusHistory : []
  const trackingPoints = Array.isArray(delivery.trackingPoints) ? delivery.trackingPoints : []

  return {
    id: String(delivery.id),
    trackingCode: delivery.trackingNumber,
    status,
    pickupAddress: delivery.pickupAddress,
    deliveryAddress: delivery.deliveryAddress,
    feeAmount: order?.deliveryFee ?? 0,
    order: order
      ? { orderNumber: order.orderNumber, id: String(order.id) }
      : null,
    assignedDriverId: delivery.assignedDriverId ? String(delivery.assignedDriverId) : null,
    createdAt: delivery.createdAt?.toISOString?.() ?? delivery.createdAt,
    deliveredAt: delivery.deliveredAt?.toISOString?.() ?? delivery.deliveredAt ?? null,
    failureReason: delivery.failureReason ?? null,
    statusHistory,
    route: trackingPoints,
    driver: delivery.assignedDriver
      ? {
          id: String(delivery.assignedDriver.id),
          fullName: delivery.assignedDriver.fullName,
          phone: delivery.assignedDriver.phone,
          vehicleType: delivery.assignedDriver.vehicleType,
          vehiclePlate: delivery.assignedDriver.vehiclePlate,
        }
      : null,
  }
}

export function formatDeliveryLive(delivery) {
  const base = formatDelivery(delivery)
  const trackingPoints = Array.isArray(delivery.trackingPoints) ? delivery.trackingPoints : []
  const geo = mockGeo(delivery)
  const last = trackingPoints[trackingPoints.length - 1]
  const status = base.status

  return {
    ...base,
    ...geo,
    timeline: buildTimeline(base.statusHistory, status),
    route: trackingPoints,
    location: last
      ? {
          latitude: last.latitude,
          longitude: last.longitude,
          recordedAt: last.recordedAt,
        }
      : null,
    etaMinutes: ['DISPATCHED', 'OUT_FOR_DELIVERY'].includes(status) ? 22 : null,
    distanceRemainingKm: status === 'OUT_FOR_DELIVERY' ? 5.1 : null,
  }
}

export function formatDriver(driver) {
  return {
    id: String(driver.id),
    fullName: driver.fullName,
    email: driver.email,
    phone: driver.phone,
    licenseNo: driver.licenseNo,
    vehicleType: driver.vehicleType,
    vehiclePlate: driver.vehiclePlate,
    isAvailable: driver.isAvailable,
    totalDeliveries: driver.totalDeliveries ?? 0,
    status: String(driver.status || 'ACTIVE').toUpperCase(),
  }
}

export function formatNotification(notification) {
  return {
    id: String(notification.id),
    title: notification.title,
    body: notification.body,
    read: notification.read,
    createdAt: notification.createdAt?.toISOString?.() ?? notification.createdAt,
  }
}
