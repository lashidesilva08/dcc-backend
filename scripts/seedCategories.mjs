import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const cats = [
  { name: 'Electronics', icon: 'Laptop',       slug: 'electronics' },
  { name: 'Fashion',     icon: 'Shirt',         slug: 'fashion' },
  { name: 'Groceries',   icon: 'ShoppingBag',   slug: 'groceries' },
  { name: 'Home',        icon: 'Home',           slug: 'home' },
  { name: 'Beauty',      icon: 'Sparkles',       slug: 'beauty' },
  { name: 'Sports',      icon: 'Activity',       slug: 'sports' },
  { name: 'Kids',        icon: 'Smile',          slug: 'kids' },
];

try {
  const result = await prisma.category.createMany({ data: cats, skipDuplicates: true });
  console.log('Categories seeded successfully:', result);
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await prisma.$disconnect();
}
