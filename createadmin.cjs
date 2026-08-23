const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('Admin@1234', 12);
  const admin = await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: 'admin@digitalcity.com',
      password: hashedPassword,
      role: 'ADMIN',
      verified: true
    }
  });
  console.log('Admin created:', admin.email);
  await prisma.$disconnect();
}

main().catch(console.error);