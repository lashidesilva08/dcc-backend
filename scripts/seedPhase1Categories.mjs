// Seeds the four Phase 1 launch categories (and a few starter subcategories).
// Safe to run repeatedly: existing categories (matched by name) are left untouched.
//
//   node scripts/seedPhase1Categories.mjs
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PHASE_1 = [
  {
    name: 'Fashion & Goods',
    icon: 'Shirt',
    description: 'Clothing, accessories and everyday goods from local sellers.',
    sortOrder: 1,
    children: ['Men', 'Women', 'Kids', 'Accessories'],
  },
  {
    name: 'Groceries',
    icon: 'ShoppingBag',
    description: 'Fresh produce, pantry items and household essentials.',
    sortOrder: 2,
    children: ['Fresh Produce', 'Pantry', 'Beverages'],
  },
  {
    name: 'Small Businesses',
    icon: 'Store',
    description: 'Handmade and independent local businesses.',
    sortOrder: 3,
    children: ['Handmade', 'Home-based Food'],
  },
  {
    name: 'Services',
    icon: 'Wrench',
    description: 'Book local services.',
    sortOrder: 4,
    children: ['Home Services', 'Beauty & Wellness', 'Tutoring'],
  },
]

async function findOrCreate({ name, icon, description, sortOrder = 0, parentId = null }) {
  const existing = await prisma.category.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  })
  if (existing) return { category: existing, created: false }

  const category = await prisma.category.create({
    data: { name, icon, description, sortOrder, parentId, status: 'active' },
  })
  return { category, created: true }
}

try {
  let created = 0
  for (const top of PHASE_1) {
    const { category, created: isNew } = await findOrCreate(top)
    if (isNew) created += 1

    let order = 1
    for (const childName of top.children) {
      const child = await findOrCreate({
        name: childName,
        icon: null,
        description: null,
        sortOrder: order++,
        parentId: category.id,
      })
      if (child.created) created += 1
    }
  }
  console.log(`Phase 1 categories ready (${created} created).`)
} catch (error) {
  console.error('Seeding failed:', error.message)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
