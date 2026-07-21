import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TARGET_EMAIL = process.env.DELIVERY_DEMO_PROVIDER_EMAIL || 'pradeepawanniarachchi2001@gmail.com'

async function main() {
  const provider = await prisma.deliveryProvider.findFirst({
    where: {
      OR: [
        { email: TARGET_EMAIL },
        { providerName: { contains: 'koobiyo', mode: 'insensitive' } },
      ],
    },
  })

  if (!provider) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          message: 'No matching delivery provider found.',
          providerEmail: TARGET_EMAIL,
        },
        null,
        2,
      ),
    )
    return
  }

  const sampleOrders = await prisma.order.findMany({
    where: {
      OR: [
        { orderNumber: { startsWith: 'DCC-SAMPLE-' } },
        { notes: 'Backend seeded sample order for delivery dashboard' },
      ],
    },
    select: { id: true },
  })

  const sampleOrderIds = sampleOrders.map((o) => o.id)

  const deliveriesDeleted = await prisma.delivery.deleteMany({
    where: {
      OR: [
        { trackingNumber: { startsWith: 'DCC-DLV-SAMPLE-' } },
        sampleOrderIds.length ? { orderId: { in: sampleOrderIds } } : { id: -1 },
      ],
    },
  })

  const orderItemsDeleted = sampleOrderIds.length
    ? await prisma.orderItem.deleteMany({ where: { orderId: { in: sampleOrderIds } } })
    : { count: 0 }

  const transactionsDeleted = sampleOrderIds.length
    ? await prisma.transaction.deleteMany({ where: { orderId: { in: sampleOrderIds } } })
    : { count: 0 }

  const ordersDeleted = sampleOrderIds.length
    ? await prisma.order.deleteMany({ where: { id: { in: sampleOrderIds } } })
    : { count: 0 }

  // Remove demo/test-only driver records created for smoke tests/seeding.
  const driversDeleted = await prisma.deliveryDriver.deleteMany({
    where: {
      providerId: provider.id,
      userId: null,
      OR: [
        { email: { startsWith: 'test.driver.' } },
        { email: { startsWith: 'driver.' } },
        { fullName: { startsWith: 'Test Driver ' } },
        { fullName: 'Sample Driver' },
      ],
    },
  })

  const remainingDeliveries = await prisma.delivery.count({
    where: { deliveryProviderId: provider.id },
  })

  console.log(
    JSON.stringify(
      {
        ok: true,
        providerId: provider.id,
        providerEmail: provider.email,
        deleted: {
          deliveries: deliveriesDeleted.count,
          orderItems: orderItemsDeleted.count,
          transactions: transactionsDeleted.count,
          orders: ordersDeleted.count,
          drivers: driversDeleted.count,
        },
        remainingDeliveries,
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
