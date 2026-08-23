import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../config/prisma.js'
import {
  buildTimeline,
  formatDelivery,
  formatDeliveryLive,
  formatDriver,
  formatNotification,
  paginate,
  toDbStatus,
  toFrontendStatus,
  toProviderStatus,
} from '../utils/deliveryHelpers.js'

const deliveryInclude = {
  order: true,
  assignedDriver: true,
}

function nowIso() {
  return new Date().toISOString()
}

function generateToken(userId, role) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

async function getProviderForUser(userId) {
  return prisma.deliveryProvider.findUnique({ where: { userId } })
}

async function getDriverForUser(userId) {
  return prisma.deliveryDriver.findUnique({
    where: { userId },
    include: { provider: true },
  })
}

async function createNotification(userId, title, body) {
  return prisma.deliveryNotification.create({
    data: { userId, title, body },
  })
}

function appendStatusHistory(existing, status, note) {
  const history = Array.isArray(existing) ? [...existing] : []
  history.push({
    id: `h-${Date.now()}`,
    status: toFrontendStatus(status),
    note,
    createdAt: nowIso(),
  })
  return history
}

function filterByStatus(items, status) {
  if (!status) return items
  const canonical = toFrontendStatus(status)
  return items.filter((d) => toFrontendStatus(d.deliveryStatus) === canonical)
}

function isPoolDelivery(delivery) {
  const status = toFrontendStatus(delivery.deliveryStatus)
  return status === 'CONFIRMED' && !delivery.assignedDriverId
}

async function fetchDeliveriesForUser(user) {
  if (user.role === 'DELIVERY_DRIVER') {
    const driver = await getDriverForUser(user.id)
    if (!driver) return []
    return prisma.delivery.findMany({
      where: { assignedDriverId: driver.id },
      include: deliveryInclude,
      orderBy: { createdAt: 'desc' },
    })
  }

  const provider = await getProviderForUser(user.id)
  if (provider) {
    return prisma.delivery.findMany({
      where: {
        OR: [
          { deliveryProviderId: provider.id },
          { deliveryProviderId: null },
        ],
      },
      include: deliveryInclude,
      orderBy: { createdAt: 'desc' },
    })
  }

  return prisma.delivery.findMany({
    include: deliveryInclude,
    orderBy: { createdAt: 'desc' },
  })
}

export const registerProvider = async (req, res) => {
  try {
    const {
      companyName,
      fullName,
      email,
      password,
      phone,
      businessRegNo,
      district,
      serviceAreas = [],
    } = req.body

    if (!companyName?.trim() || !fullName?.trim() || !email?.trim() || !password || !phone?.trim()) {
      return res.status(400).json({ message: 'Company name, contact name, email, password, and phone are required.' })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' })
    }

    const existingProvider = await prisma.deliveryProvider.findUnique({ where: { email: normalizedEmail } })
    if (existingProvider) {
      return res.status(400).json({ message: 'A delivery provider with this email already exists.' })
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const serviceArea = Array.isArray(serviceAreas) ? serviceAreas.join(', ') : String(serviceAreas || district || '')

    const user = await prisma.user.create({
      data: {
        name: fullName.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        phone: phone.trim(),
        role: 'DELIVERY_PROVIDER',
      },
    })

    const provider = await prisma.deliveryProvider.create({
      data: {
        userId: user.id,
        providerName: companyName.trim(),
        contactPerson: fullName.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        serviceArea,
        businessRegNo: businessRegNo?.trim() || null,
        district: district?.trim() || null,
        baseFee: 350,
        status: 'pending',
      },
    })

    await createNotification(
      user.id,
      'Application received',
      'Your delivery provider application is under review. We will notify you once approved.'
    )

    const token = generateToken(user.id, user.role)

    res.status(201).json({
      message: 'Delivery provider registered successfully.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        deliveryProvider: {
          id: provider.id,
          companyName: provider.providerName,
          status: toProviderStatus(provider.status),
          district: provider.district,
          serviceAreas: serviceArea.split(',').map((s) => s.trim()).filter(Boolean),
        },
      },
    })
  } catch (error) {
    console.error('Register provider error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const getDashboard = async (req, res) => {
  try {
    const all = await fetchDeliveriesForUser(req.user)
    const formatted = all.map(formatDelivery)
    const today = new Date().toDateString()

    res.status(200).json({
      stats: {
        pending: formatted.filter((d) => d.status === 'CONFIRMED' && !d.assignedDriverId).length,
        active: formatted.filter((d) => ['PROCESSING', 'DISPATCHED', 'OUT_FOR_DELIVERY'].includes(d.status)).length,
        deliveredToday: formatted.filter(
          (d) => d.status === 'DELIVERED' && d.deliveredAt && new Date(d.deliveredAt).toDateString() === today
        ).length,
      },
      recentDeliveries: formatted
        .filter((d) => !(d.status === 'CONFIRMED' && !d.assignedDriverId))
        .slice(0, 5),
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const getAssignedDeliveries = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 10
    const status = req.query.status || null

    const all = await fetchDeliveriesForUser(req.user)
    let items = all.filter((d) => !isPoolDelivery(d))
    items = filterByStatus(items, status)
    const formatted = items.map(formatDelivery)
    const result = paginate(formatted, { page, limit })

    res.status(200).json(result)
  } catch (error) {
    console.error('Assigned deliveries error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const getPoolDeliveries = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 10
    const status = req.query.status || null

    const all = await fetchDeliveriesForUser(req.user)
    let items = all.filter(isPoolDelivery)
    items = filterByStatus(items, status || 'CONFIRMED')
    const formatted = items.map(formatDelivery)
    const result = paginate(formatted, { page, limit })

    res.status(200).json(result)
  } catch (error) {
    console.error('Pool deliveries error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const getDeliveryById = async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid delivery id.' })
    }

    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: deliveryInclude,
    })

    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found.' })
    }

    res.status(200).json(formatDelivery(delivery))
  } catch (error) {
    console.error('Get delivery error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const acceptJob = async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid delivery id.' })
    }

    const delivery = await prisma.delivery.findUnique({ where: { id } })
    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found.' })
    }

    if (!isPoolDelivery(delivery)) {
      return res.status(400).json({ message: 'Job is no longer available.' })
    }

    let assignedDriverId = null
    let providerId = delivery.deliveryProviderId

    if (req.user.role === 'DELIVERY_DRIVER') {
      const driver = await getDriverForUser(req.user.id)
      if (!driver) {
        return res.status(403).json({ message: 'Driver profile not found.' })
      }
      assignedDriverId = driver.id
      providerId = driver.providerId
    }

    const updated = await prisma.delivery.update({
      where: { id },
      data: {
        deliveryStatus: 'PROCESSING',
        assignedDriverId,
        deliveryProviderId: providerId,
        assignedAt: new Date(),
        statusHistory: appendStatusHistory(delivery.statusHistory, 'PROCESSING', 'Assigned to driver'),
      },
      include: deliveryInclude,
    })

    await createNotification(
      req.user.id,
      'Job accepted',
      `${updated.trackingNumber || `Delivery #${updated.id}`} is now assigned to you.`
    )

    res.status(200).json(formatDelivery(updated))
  } catch (error) {
    console.error('Accept job error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const updateDeliveryStatus = async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { status, latitude, longitude, accuracy, failureReason, note } = req.body

    if (Number.isNaN(id) || !status) {
      return res.status(400).json({ message: 'Delivery id and status are required.' })
    }

    const delivery = await prisma.delivery.findUnique({ where: { id } })
    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found.' })
    }

    const nextStatus = toDbStatus(status)
    const trackingPoints = Array.isArray(delivery.trackingPoints) ? [...delivery.trackingPoints] : []

    if (latitude != null && longitude != null) {
      trackingPoints.push({
        latitude,
        longitude,
        accuracy,
        recordedAt: nowIso(),
      })
    }

    const data = {
      deliveryStatus: nextStatus,
      statusHistory: appendStatusHistory(
        delivery.statusHistory,
        nextStatus,
        failureReason || note || `Status → ${toFrontendStatus(nextStatus)}`
      ),
      trackingPoints: trackingPoints.slice(-200),
      failureReason: failureReason || null,
    }

    if (nextStatus === 'DISPATCHED') data.pickedUpAt = new Date()
    if (nextStatus === 'DELIVERED') {
      data.deliveredAt = new Date()
      if (delivery.assignedDriverId) {
        await prisma.deliveryDriver.update({
          where: { id: delivery.assignedDriverId },
          data: { totalDeliveries: { increment: 1 } },
        })
      }
    }

    const updated = await prisma.delivery.update({
      where: { id },
      data,
      include: deliveryInclude,
    })

    res.status(200).json(formatDelivery(updated))
  } catch (error) {
    console.error('Update delivery status error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const updateTracking = async (req, res) => {
  try {
    const id = Number(req.params.id)
    const points = req.body.points ?? (req.body.latitude != null ? [req.body] : [])

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid delivery id.' })
    }

    const delivery = await prisma.delivery.findUnique({ where: { id } })
    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found.' })
    }

    const existing = Array.isArray(delivery.trackingPoints) ? delivery.trackingPoints : []
    const stamped = (Array.isArray(points) ? points : []).map((p) => ({
      ...p,
      recordedAt: p.recordedAt || nowIso(),
    }))
    const merged = [...existing, ...stamped].slice(-200)

    const data = { trackingPoints: merged }
    if (req.body.status) {
      data.deliveryStatus = toDbStatus(req.body.status)
    }

    const updated = await prisma.delivery.update({
      where: { id },
      data,
      include: deliveryInclude,
    })

    res.status(200).json(formatDeliveryLive(updated))
  } catch (error) {
    console.error('Update tracking error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const getDeliveryLive = async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid delivery id.' })
    }

    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: deliveryInclude,
    })

    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found.' })
    }

    res.status(200).json(formatDeliveryLive(delivery))
  } catch (error) {
    console.error('Get delivery live error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const trackPublic = async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase()
    if (!code) {
      return res.status(400).json({ message: 'Tracking code is required.' })
    }

    const delivery = await prisma.delivery.findFirst({
      where: { trackingNumber: { equals: code, mode: 'insensitive' } },
      include: deliveryInclude,
    })

    if (!delivery) {
      return res.status(404).json({ message: 'Tracking not found.' })
    }

    const live = formatDeliveryLive(delivery)
    res.status(200).json({
      ...live,
      timeline: buildTimeline(live.statusHistory, live.status),
      etaMinutes: live.status === 'OUT_FOR_DELIVERY' ? 18 : live.etaMinutes,
      distanceRemainingKm: live.status === 'OUT_FOR_DELIVERY' ? 4.2 : live.distanceRemainingKm,
    })
  } catch (error) {
    console.error('Public track error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const getEarnings = async (req, res) => {
  try {
    const days = Number(req.query.days) || 30
    const cutoff = Date.now() - days * 86400000
    const all = await fetchDeliveriesForUser(req.user)
    const completed = all
      .filter((d) => toFrontendStatus(d.deliveryStatus) === 'DELIVERED')
      .filter((d) => new Date(d.deliveredAt || d.createdAt).getTime() >= cutoff)
      .map(formatDelivery)

    const totalEarnings = completed.reduce((sum, d) => sum + (d.feeAmount || 0), 0)
    const chart = Array.from({ length: Math.min(days, 14) }, (_, i) => {
      const day = new Date()
      day.setDate(day.getDate() - (13 - i))
      const key = day.toISOString().slice(0, 10)
      const dayJobs = completed.filter((d) => (d.deliveredAt || d.createdAt).slice(0, 10) === key)
      return { date: key, earnings: dayJobs.reduce((s, d) => s + (d.feeAmount || 0), 0) }
    })

    res.status(200).json({
      totalEarnings,
      totalDeliveries: completed.length,
      chart,
    })
  } catch (error) {
    console.error('Earnings error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const getAnalytics = async (req, res) => {
  try {
    const all = (await fetchDeliveriesForUser(req.user)).map(formatDelivery)
    const completed = all.filter((d) => d.status === 'DELIVERED').length
    const failed = all.filter((d) => d.status === 'CANCELLED').length
    const total = completed + failed || 1
    const statuses = ['DELIVERED', 'CANCELLED', 'PROCESSING', 'CONFIRMED', 'DISPATCHED', 'OUT_FOR_DELIVERY']

    res.status(200).json({
      completed,
      failed,
      successRate: Math.round((completed / total) * 100),
      avgDeliveryMinutes: 42,
      byStatus: statuses
        .map((status) => ({ status, count: all.filter((d) => d.status === status).length }))
        .filter((r) => r.count > 0),
    })
  } catch (error) {
    console.error('Analytics error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const getDrivers = async (req, res) => {
  try {
    const provider = await getProviderForUser(req.user.id)
    if (!provider) {
      return res.status(403).json({ message: 'Delivery provider profile not found.' })
    }

    const drivers = await prisma.deliveryDriver.findMany({
      where: { providerId: provider.id },
      orderBy: { createdAt: 'desc' },
    })

    res.status(200).json(drivers.map(formatDriver))
  } catch (error) {
    console.error('Get drivers error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const createDriver = async (req, res) => {
  try {
    const provider = await getProviderForUser(req.user.id)
    if (!provider) {
      return res.status(403).json({ message: 'Delivery provider profile not found.' })
    }

    const { fullName, email, password, phone, licenseNo, vehiclePlate, vehicleType } = req.body
    if (!fullName?.trim() || !email?.trim() || !phone?.trim()) {
      return res.status(400).json({ message: 'Full name, email, and phone are required.' })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } })

    let userId = existingUser?.id ?? null
    if (!existingUser && password) {
      const user = await prisma.user.create({
        data: {
          name: fullName.trim(),
          email: normalizedEmail,
          password: await bcrypt.hash(password, 12),
          phone: phone.trim(),
          role: 'DELIVERY_DRIVER',
        },
      })
      userId = user.id
    }

    const driver = await prisma.deliveryDriver.create({
      data: {
        providerId: provider.id,
        userId,
        fullName: fullName.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        licenseNo: licenseNo?.trim() || null,
        vehiclePlate: vehiclePlate?.trim() || null,
        vehicleType: vehicleType?.trim() || 'Motorcycle',
      },
    })

    if (userId) {
      await createNotification(
        userId,
        'Driver account created',
        `You have been added to ${provider.providerName}'s delivery fleet.`
      )
    }

    res.status(201).json(formatDriver(driver))
  } catch (error) {
    console.error('Create driver error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const updateDriver = async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid driver id.' })
    }

    const provider = await getProviderForUser(req.user.id)
    const driverRecord = await getDriverForUser(req.user.id)
    const driver = await prisma.deliveryDriver.findUnique({ where: { id } })

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' })
    }

    const isOwner = provider && driver.providerId === provider.id
    const isSelf = driverRecord && driverRecord.id === driver.id
    if (!isOwner && !isSelf) {
      return res.status(403).json({ message: 'Access denied.' })
    }

    const updated = await prisma.deliveryDriver.update({
      where: { id },
      data: {
        fullName: req.body.fullName?.trim() || undefined,
        phone: req.body.phone?.trim() || undefined,
        isAvailable: req.body.isAvailable ?? undefined,
        vehicleType: req.body.vehicleType?.trim() || undefined,
        vehiclePlate: req.body.vehiclePlate?.trim() || undefined,
      },
    })

    res.status(200).json(formatDriver(updated))
  } catch (error) {
    console.error('Update driver error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const getNotifications = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 20

    const items = await prisma.deliveryNotification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    })

    const formatted = items.map(formatNotification)
    res.status(200).json(paginate(formatted, { page, limit }))
  } catch (error) {
    console.error('Get notifications error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const getUnreadNotificationCount = async (req, res) => {
  try {
    const count = await prisma.deliveryNotification.count({
      where: { userId: req.user.id, read: false },
    })
    res.status(200).json({ count })
  } catch (error) {
    console.error('Unread notifications error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const markNotificationRead = async (req, res) => {
  try {
    const id = Number(req.params.id)
    const notification = await prisma.deliveryNotification.updateMany({
      where: { id, userId: req.user.id },
      data: { read: true },
    })

    if (!notification.count) {
      return res.status(404).json({ message: 'Notification not found.' })
    }

    const updated = await prisma.deliveryNotification.findUnique({ where: { id } })
    res.status(200).json(formatNotification(updated))
  } catch (error) {
    console.error('Mark notification read error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const markAllNotificationsRead = async (req, res) => {
  try {
    await prisma.deliveryNotification.updateMany({
      where: { userId: req.user.id, read: false },
      data: { read: true },
    })
    res.status(200).json({ message: 'All notifications marked as read.' })
  } catch (error) {
    console.error('Mark all notifications read error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const deleteNotification = async (req, res) => {
  try {
    const id = Number(req.params.id)
    const result = await prisma.deliveryNotification.deleteMany({
      where: { id, userId: req.user.id },
    })

    if (!result.count) {
      return res.status(404).json({ message: 'Notification not found.' })
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Delete notification error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const getProviderSettings = async (req, res) => {
  try {
    const provider = await getProviderForUser(req.user.id)
    if (!provider) {
      return res.status(403).json({ message: 'Delivery provider profile not found.' })
    }

    const settings = provider.settings || {}
    res.status(200).json({
      coverageAreas: settings.coverageAreas || provider.serviceArea.split(',').map((s) => s.trim()).filter(Boolean),
      pricingModel: settings.pricingModel || 'distance',
      baseFee: settings.baseFee ?? provider.baseFee ?? 250,
      perKmFee: settings.perKmFee ?? 50,
      freeThreshold: settings.freeThreshold ?? 10000,
      flatFee: settings.flatFee ?? 450,
      status: toProviderStatus(provider.status),
    })
  } catch (error) {
    console.error('Get provider settings error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const updateProviderSettings = async (req, res) => {
  try {
    const provider = await getProviderForUser(req.user.id)
    if (!provider) {
      return res.status(403).json({ message: 'Delivery provider profile not found.' })
    }

    const {
      coverageAreas,
      pricingModel,
      baseFee,
      perKmFee,
      freeThreshold,
      flatFee,
    } = req.body

    const settings = {
      coverageAreas: coverageAreas || [],
      pricingModel: pricingModel || 'distance',
      baseFee: Number(baseFee) || 250,
      perKmFee: Number(perKmFee) || 50,
      freeThreshold: Number(freeThreshold) || 10000,
      flatFee: Number(flatFee) || 450,
    }

    const updated = await prisma.deliveryProvider.update({
      where: { id: provider.id },
      data: {
        settings,
        serviceArea: Array.isArray(coverageAreas) ? coverageAreas.join(', ') : provider.serviceArea,
        baseFee: settings.baseFee,
      },
    })

    res.status(200).json({
      ...settings,
      status: toProviderStatus(updated.status),
    })
  } catch (error) {
    console.error('Update provider settings error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const pickupOrder = async (req, res) => {
  req.body = { ...req.body, status: 'DISPATCHED' }
  return updateDeliveryStatus(req, res)
}

export const markDelivered = async (req, res) => {
  req.body = { ...req.body, status: 'DELIVERED' }
  return updateDeliveryStatus(req, res)
}
