
import prisma from '../config/prisma.js'
import crypto from 'crypto'

const VALID_PROVIDER_STATUSES = [
  'pending',
  'active',
  'rejected',
  'suspended',
]

const ASSIGNABLE_ORDER_STATUSES = [
  'placed',
  'confirmed',
  'processing',
  'ready_for_pickup',
]

const parseId = (value) => {
  const id = Number(value)

  return Number.isInteger(id) && id > 0 ? id : null
}

const normalizeStatus = (status) => {
  const value = String(status || '').toLowerCase()

  if (value === 'approved') return 'active'
  if (value === 'disabled') return 'suspended'

  return value
}

const formatProvider = (provider) => ({
  id: provider.id,
  name: provider.providerName,
  providerName: provider.providerName,
  contactPerson: provider.contactPerson,
  email: provider.email,
  phone: provider.phone,
  serviceArea: provider.serviceArea,
  serviceAreas: String(provider.serviceArea || '')
    .split(',')
    .map((area) => area.trim())
    .filter(Boolean),
  district: provider.district,
  baseFee: provider.baseFee,
  businessRegNo: provider.businessRegNo,
  status: normalizeStatus(provider.status),
  rejectionReason: provider.rejectionReason,
  submittedAt: provider.createdAt,
  createdAt: provider.createdAt,
  updatedAt: provider.updatedAt,
})

// ------------------------------------------------------
// GET /api/v1/admin/delivery-providers
// List delivery provider applications
// ------------------------------------------------------

export const getDeliveryProviders = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))

    const search = String(req.query.search || req.query.q || '').trim()
    const status = normalizeStatus(req.query.status || 'all')

    if (
      status !== 'all' &&
      !VALID_PROVIDER_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid provider status.',
      })
    }

    const where = {
      ...(status !== 'all' ? { status } : {}),
      ...(search
        ? {
            OR: [
              {
                providerName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                contactPerson: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                phone: {
                  contains: search,
                },
              },
            ],
          }
        : {}),
    }

    const [total, providers, grouped] = await Promise.all([
      prisma.deliveryProvider.count({ where }),

      prisma.deliveryProvider.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),

      prisma.deliveryProvider.groupBy({
        by: ['status'],
        _count: {
          id: true,
        },
      }),
    ])

    const stats = {
      total: grouped.reduce((sum, item) => sum + item._count.id, 0),
      pending: 0,
      active: 0,
      rejected: 0,
      suspended: 0,
    }

    grouped.forEach((item) => {
      const key = normalizeStatus(item.status)

      if (Object.hasOwn(stats, key)) {
        stats[key] += item._count.id
      }
    })

    return res.status(200).json({
      success: true,
      data: providers.map(formatProvider),
      stats,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    })
  } catch (error) {
    console.error('Get delivery providers error:', error)

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve delivery providers.',
    })
  }
}

// ------------------------------------------------------
// PATCH /api/v1/admin/delivery-providers/:id
// Approve, reject, suspend or reactivate provider
// ------------------------------------------------------

export const updateDeliveryProvider = async (req, res) => {
  try {
    const id = parseId(req.params.id)

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid delivery provider ID.',
      })
    }

    const status = normalizeStatus(req.body.status)

    if (!VALID_PROVIDER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid provider status.',
      })
    }

    const reason = String(req.body.reason || '').trim()

    if (status === 'rejected' && !reason) {
      return res.status(400).json({
        success: false,
        message: 'A rejection reason is required.',
      })
    }

    const provider = await prisma.deliveryProvider.findUnique({
      where: { id },
    })

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Delivery provider not found.',
      })
    }

    // A provider with ongoing deliveries should not be disabled
    // while those deliveries are still in progress.
    if (status === 'suspended') {
      const activeDeliveries = await prisma.delivery.count({
        where: {
          deliveryProviderId: id,
          deliveryStatus: {
            notIn: ['DELIVERED', 'CANCELLED'],
          },
        },
      })

      if (activeDeliveries > 0) {
        return res.status(409).json({
          success: false,
          message:
            'This provider has ongoing deliveries. Complete or cancel them before suspending the provider.',
        })
      }
    }

    const updated = await prisma.deliveryProvider.update({
      where: { id },
      data: {
        status,
        rejectionReason:
          status === 'rejected'
            ? reason
            : null,
      },
    })

    // Notify the provider without making notification failure
    // block the administrator's status update.
    if (updated.userId) {
      try {
        const messages = {
          active:
            'Your delivery provider account has been approved or reactivated.',
          rejected:
            `Your delivery provider application was rejected. Reason: ${reason}`,
          suspended:
            'Your delivery provider account has been suspended.',
          pending:
            'Your delivery provider application is pending review.',
        }

        await prisma.deliveryNotification.create({
          data: {
            userId: updated.userId,
            title: 'Delivery provider status updated',
            body: messages[status],
          },
        })
      } catch (notificationError) {
        console.error(
          'Provider notification error:',
          notificationError
        )
      }
    }

    return res.status(200).json({
      success: true,
      message: `Delivery provider ${status} successfully.`,
      data: formatProvider(updated),
    })
  } catch (error) {
    console.error('Update delivery provider error:', error)

    return res.status(500).json({
      success: false,
      message: 'Failed to update delivery provider.',
    })
  }
}

// ------------------------------------------------------
// GET /api/v1/admin/deliveries
// Retrieve orders waiting for manual assignment
// ------------------------------------------------------

export const getUnassignedDeliveries = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))

    const search = String(req.query.search || '').trim()

    const where = {
      delivery: {
        is: null,
      },
      orderStatus: {
        in: ASSIGNABLE_ORDER_STATUSES,
      },
      ...(search
        ? {
            OR: [
              {
                orderNumber: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                user: {
                  name: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                user: {
                  email: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    }

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),

      prisma.order.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          orderItems: {
            take: 1,
            include: {
              seller: {
                select: {
                  id: true,
                  shopName: true,
                  address: true,
                  location: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    const data = orders.map((order) => ({
      id: order.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      totalAmount: order.totalAmount,
      deliveryFee: order.deliveryFee,
      deliveryAddress: order.deliveryAddress,
      createdAt: order.createdAt,

      buyer: order.user,

      seller:
        order.orderItems[0]?.seller || null,
    }))

    return res.status(200).json({
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    })
  } catch (error) {
    console.error('Get unassigned deliveries error:', error)

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve unassigned orders.',
    })
  }
}

// ------------------------------------------------------
// POST /api/v1/admin/deliveries/assign
// Manually assign an order to an approved provider
// Body: { orderId, providerId }
// ------------------------------------------------------

export const assignDelivery = async (req, res) => {
  try {
    const orderId = parseId(req.body.orderId)
    const providerId = parseId(req.body.providerId)

    if (!orderId || !providerId) {
      return res.status(400).json({
        success: false,
        message: 'Valid order ID and provider ID are required.',
      })
    }

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          delivery: true,
          orderItems: {
            take: 1,
            include: {
              seller: {
                select: {
                  address: true,
                  location: true,
                  shopName: true,
                },
              },
            },
          },
        },
      })

      if (!order) {
        const error = new Error('Order not found.')
        error.statusCode = 404
        throw error
      }

      if (order.delivery) {
        const error = new Error(
          'This order already has a delivery assignment.'
        )
        error.statusCode = 409
        throw error
      }

      if (!ASSIGNABLE_ORDER_STATUSES.includes(order.orderStatus)) {
        const error = new Error(
          'This order is not eligible for delivery assignment.'
        )
        error.statusCode = 409
        throw error
      }

      const provider = await tx.deliveryProvider.findUnique({
        where: { id: providerId },
      })

      if (!provider) {
        const error = new Error('Delivery provider not found.')
        error.statusCode = 404
        throw error
      }

      if (
        !['active', 'approved'].includes(
          String(provider.status).toLowerCase()
        )
      ) {
        const error = new Error(
          'Only approved and active providers can receive deliveries.'
        )
        error.statusCode = 409
        throw error
      }

      const seller = order.orderItems[0]?.seller

      const pickupAddress =
        seller?.address ||
        seller?.location ||
        seller?.shopName ||
        'Seller location'

      const trackingNumber =
        `TRK-${order.orderNumber}-${crypto.randomUUID()
          .slice(0, 8)
          .toUpperCase()}`

      const delivery = await tx.delivery.create({
        data: {
          orderId: order.id,
          deliveryProviderId: provider.id,
          trackingNumber,
          pickupAddress,
          deliveryAddress: order.deliveryAddress,
          deliveryStatus: 'CONFIRMED',
          assignedAt: new Date(),
          statusHistory: [
            {
              id: `h-${Date.now()}`,
              status: 'CONFIRMED',
              note: `Manually assigned to ${provider.providerName} by admin.`,
              createdAt: new Date().toISOString(),
            },
          ],
        },
        include: {
          deliveryProvider: {
            select: {
              id: true,
              providerName: true,
              email: true,
              phone: true,
            },
          },
        },
      })

      await tx.orderAdminLog.create({
        data: {
          orderId: order.id,
          adminId: req.user.id,
          action: 'delivery_assigned',
          details: {
            providerId: provider.id,
            providerName: provider.providerName,
            assignmentType: 'manual',
          },
        },
      })

      if (provider.userId) {
        await tx.deliveryNotification.create({
          data: {
            userId: provider.userId,
            title: 'New delivery assigned',
            body: `Order ${order.orderNumber} has been assigned to your company.`,
          },
        })
      }

      return delivery
    })

    return res.status(201).json({
      success: true,
      message: 'Delivery successfully assigned.',
      data: result,
    })
  } catch (error) {
    console.error('Manual delivery assignment error:', error)

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message || 'Failed to assign delivery.',
    })
  }
}
