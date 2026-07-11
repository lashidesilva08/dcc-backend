import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TARGET_EMAIL = 'pradeepawanniarachchi2001@gmail.com'

function buildStatusHistory(orderId, status) {
  const list = [
    {
      id: `h-${orderId}-1`,
      status: 'CONFIRMED',
      note: 'Order confirmed',
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    },
  ]

  if (status !== 'CONFIRMED') {
    list.push({
      id: `h-${orderId}-2`,
      status: 'PROCESSING',
      note: 'Accepted by driver',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    })
  }

  if (['DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(status)) {
    list.push({
      id: `h-${orderId}-3`,
      status: 'DISPATCHED',
      note: 'Picked up from seller',
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    })
  }

  if (['OUT_FOR_DELIVERY', 'DELIVERED'].includes(status)) {
    list.push({
      id: `h-${orderId}-4`,
      status: 'OUT_FOR_DELIVERY',
      note: 'Heading to customer',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    })
  }

  if (status === 'DELIVERED') {
    list.push({
      id: `h-${orderId}-5`,
      status: 'DELIVERED',
      note: 'Package delivered',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    })
  }

  return list
}

function buildTrackingPoints(status) {
  if (!['OUT_FOR_DELIVERY', 'DELIVERED'].includes(status)) return []
  return [
    {
      latitude: 6.9271,
      longitude: 79.8612,
      accuracy: 12,
      recordedAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    },
    {
      latitude: 6.9352,
      longitude: 79.8721,
      accuracy: 10,
      recordedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    },
    {
      latitude: 6.943,
      longitude: 79.884,
      accuracy: 8,
      recordedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
  ]
}

async function nomain() {
  const provider = await prisma.deliveryProvider.findFirst({
    where: {
      OR: [
        { email: TARGET_EMAIL },
        { providerName: { contains: 'koobiyo', mode: 'insensitive' } },
      ],
    },
  })

  if (!provider) {
    console.log('No provider found for sample seeding.')
    process.exit(1)
  }

  const buyer =
    (await prisma.user.findFirst({
      where: { role: { in: ['BUYER', 'CUSTOMER'] } },
      orderBy: { id: 'asc' },
    })) ||
    (await prisma.user.findFirst({ orderBy: { id: 'asc' } }))

  if (!buyer) {
    console.log('No user found to attach sample orders.')
    process.exit(1)
  }

  let driver = await prisma.deliveryDriver.findFirst({
    where: { providerId: provider.id },
    orderBy: { id: 'asc' },
  })

  if (!driver) {
    driver = await prisma.deliveryDriver.create({
      data: {
        providerId: provider.id,
        fullName: 'Sample Driver',
        email: `driver.${Date.now()}@example.com`,
        phone: '0771234567',
        vehicleType: 'Motorcycle',
        vehiclePlate: 'WP-DR-1001',
        isAvailable: true,
        status: 'ACTIVE',
      },
    })
  }

  const statuses = ['CONFIRMED', 'PROCESSING', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED']
  let createdNow = 0

  for (let i = 0; i < statuses.length; i += 1) {
    const status = statuses[i]

    const order = await prisma.order.create({
      data: {
        userId: buyer.id,
        orderNumber: `DCC-SAMPLE-${Date.now()}-${i}`,
        totalAmount: 3500 + i * 500,
        deliveryFee: 300 + i * 50,
        paymentMethod: 'COD',
        paymentStatus: status === 'DELIVERED' ? 'paid' : 'pending',
        orderStatus: status === 'DELIVERED' ? 'delivered' : 'confirmed',
        deliveryAddress: `Sample Address ${i + 1}, Colombo`,
        notes: 'Backend seeded sample order for delivery dashboard',
      },
    })

    const assignedDriverId = status === 'CONFIRMED' ? null : driver.id
    const assignedAt = status === 'CONFIRMED' ? null : new Date(Date.now() - (5 - i) * 60 * 60 * 1000)
    const pickedUpAt =
      ['DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(status)
        ? new Date(Date.now() - (5 - i) * 45 * 60 * 1000)
        : null
    const deliveredAt = status === 'DELIVERED' ? new Date(Date.now() - 30 * 60 * 1000) : null

    await prisma.delivery.create({
      data: {
        orderId: order.id,
        deliveryProviderId: provider.id,
        assignedDriverId,
        trackingNumber: `DCC-DLV-SAMPLE-${Date.now()}-${i}`,
        pickupAddress: `Seller pickup ${i + 1}, Colombo`,
        deliveryAddress: order.deliveryAddress,
        deliveryStatus: status,
        trackingPoints: buildTrackingPoints(status),
        statusHistory: buildStatusHistory(order.id, status),
        assignedAt,
        pickedUpAt,
        deliveredAt,
      },
    })

    createdNow += 1
  }

  await prisma.deliveryProvider.update({
    where: { id: provider.id },
    data: { status: 'active' },
  })

  const totalDeliveriesForProvider = await prisma.delivery.count({
    where: { deliveryProviderId: provider.id },
  })

  console.log(
    JSON.stringify(
      {
        ok: true,
        providerId: provider.id,
        providerEmail: provider.email,
        buyerId: buyer.id,
        driverId: driver.id,
        createdNow,
        totalDeliveriesForProvider,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
