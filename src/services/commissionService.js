import prisma from '../config/prisma.js'

export const getCommissionRate = async (categoryId) => {
  const categoryCommission =
    await prisma.categoryCommission.findUnique({
      where: { categoryId },
    })

  if (categoryCommission) {
    return categoryCommission.commissionRate
  }

  const defaultSetting =
    await prisma.platformSetting.findUnique({
      where: {
        key: 'defaultCommissionRate',
      },
    })

  return defaultSetting
    ? Number(defaultSetting.value)
    : 10
}

export const calculateCommission = async (
  categoryId,
  amount
) => {
  const rate = await getCommissionRate(categoryId)

  const commission = Number(amount) * rate / 100

  return {
    rate,
    commission,
    sellerAmount: Number(amount) - commission,
  }
}