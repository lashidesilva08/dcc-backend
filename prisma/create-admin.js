import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ADMIN_EMAIL = 'admin@digitalcity.lk'
const ADMIN_PASSWORD = 'Admin@12345'

async function main() {
  const hashedPassword =
    await bcrypt.hash(
      ADMIN_PASSWORD,
      12
    )

  const existingUser =
    await prisma.user.findUnique({
      where: {
        email: ADMIN_EMAIL,
      },
    })

  if (existingUser) {
    const updated =
      await prisma.user.update({
        where: {
          id: existingUser.id,
        },

        data: {
          name: 'Digital City Admin',
          password: hashedPassword,
          role: 'SUPER_ADMIN',
          verified: true,
        },
      })

    console.log(
      'Existing user converted to SUPER_ADMIN:'
    )

    console.log({
      id: updated.id,
      email: updated.email,
      role: updated.role,
    })

    return
  }

  const admin =
    await prisma.user.create({
      data: {
        name: 'Digital City Admin',
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        verified: true,
      },
    })

  console.log(
    'Admin account created successfully:'
  )

  console.log({
    id: admin.id,
    email: admin.email,
    role: admin.role,
  })
}

main()
  .catch((error) => {
    console.error(
      'Failed to create admin:',
      error
    )

    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })