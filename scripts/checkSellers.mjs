import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const sellers = await prisma.seller.findMany();
console.log('All sellers:', JSON.stringify(sellers.map(s => ({ id: s.id, shopName: s.shopName, status: s.status })), null, 2));
await prisma.$disconnect();
