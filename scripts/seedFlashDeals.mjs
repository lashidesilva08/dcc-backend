import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function slugifyCategory(name = '') {
  return name
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

async function main() {
  const variants = await prisma.productVariant.findMany({
    where: {
      status: 'active',
      listing: { status: 'active' },
    },
    include: {
      listing: {
        include: { category: true },
      },
    },
    orderBy: { id: 'asc' },
  })

  if (!variants.length) {
    throw new Error('No active product variants found. Run prisma db seed first.')
  }

  const byCategory = new Map()
  for (const variant of variants) {
    const key = slugifyCategory(variant.listing?.category?.name || 'marketplace')
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key).push(variant)
  }

  const selected = []
  for (const list of byCategory.values()) {
    selected.push(...list.slice(0, 6))
  }

  await prisma.flashSaleItem.deleteMany({})
  await prisma.flashSale.deleteMany({})

  const startTime = new Date(Date.now() - 60 * 60 * 1000)
  const endTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const sale = await prisma.flashSale.create({
    data: {
      title: 'Unbeatable Flash Deals',
      startTime,
      endTime,
      status: 'active',
      items: {
        create: selected.map((variant, index) => {
          const discount = 0.15 + (index % 4) * 0.05
          const flashPrice = Math.max(1, Math.round(Number(variant.price) * (1 - discount)))
          return {
            variantId: variant.id,
            flashPrice,
            flashStock: Math.min(Number(variant.stock) || 0, 20),
            soldCount: 5 + (index % 25),
          }
        }),
      },
    },
    include: { items: true },
  })

  console.log(
    `Seeded flash sale "${sale.title}" with ${sale.items.length} deals across categories:`,
    [...byCategory.keys()].join(', '),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
