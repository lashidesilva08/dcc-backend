import prisma from '../config/prisma.js'

const DEFAULT_SETTINGS = {
  platformName: 'Digital City Center',
  contactEmail: 'admin@digitalcity.lk',
  defaultCommissionRate: 10,
  currency: 'LKR',
  maintenanceMode: false,
}

const validRate = (rate) =>
  Number.isFinite(Number(rate)) &&
  Number(rate) >= 0 &&
  Number(rate) <= 100

const getSettingsObject = async () => {
  const rows = await prisma.platformSetting.findMany()

  const settings = { ...DEFAULT_SETTINGS }

  rows.forEach((row) => {
    settings[row.key] = row.value
  })

  return settings
}

// GET /api/v1/admin/settings
export const getPlatformSettings = async (req, res) => {
  try {
    const settings = await getSettingsObject()

    return res.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve platform settings.',
    })
  }
}

// PUT /api/v1/admin/settings
export const updatePlatformSettings = async (req, res) => {
  try {
    const {
      platformName,
      contactEmail,
      defaultCommissionRate,
      currency,
      maintenanceMode,
    } = req.body

    if (
      defaultCommissionRate !== undefined &&
      !validRate(defaultCommissionRate)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Commission must be between 0 and 100.',
      })
    }

    if (
      platformName !== undefined &&
      (!String(platformName).trim() ||
        String(platformName).length > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid platform name.',
      })
    }

    if (
      contactEmail !== undefined &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact email.',
      })
    }

    const updates = {
      platformName,
      contactEmail,
      defaultCommissionRate:
        defaultCommissionRate === undefined
          ? undefined
          : Number(defaultCommissionRate),
      currency,
      maintenanceMode,
    }

    await prisma.$transaction(
      Object.entries(updates)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) =>
          prisma.platformSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
          })
        )
    )

    return res.json({
      success: true,
      message: 'Platform settings updated successfully.',
      data: await getSettingsObject(),
    })
  } catch (error) {
    console.error('Update platform settings:', error)

    return res.status(500).json({
      success: false,
      message: 'Unable to update platform settings.',
    })
  }
}

// GET /api/v1/admin/settings/commissions
export const getCategoryCommissions = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        commission: true,
      },
    })

    const settings = await getSettingsObject()

    const data = categories.map((category) => ({
      categoryId: category.id,
      categoryName: category.name,
      commissionRate:
        category.commission?.commissionRate ?? null,
      effectiveRate:
        category.commission?.commissionRate ??
        Number(settings.defaultCommissionRate),
      isCustom: Boolean(category.commission),
    }))

    return res.json({
      success: true,
      data,
      defaultRate: Number(settings.defaultCommissionRate),
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve category commissions.',
    })
  }
}

// PUT /api/v1/admin/settings/commissions/:categoryId
export const updateCategoryCommission = async (req, res) => {
  try {
    const categoryId = Number(req.params.categoryId)
    const { commissionRate } = req.body

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID.',
      })
    }

    if (!validRate(commissionRate)) {
      return res.status(400).json({
        success: false,
        message: 'Commission must be between 0 and 100.',
      })
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    })

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      })
    }

    const data = await prisma.categoryCommission.upsert({
      where: { categoryId },
      update: {
        commissionRate: Number(commissionRate),
      },
      create: {
        categoryId,
        commissionRate: Number(commissionRate),
      },
    })

    return res.json({
      success: true,
      message: 'Category commission updated.',
      data,
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      success: false,
      message: 'Unable to update commission.',
    })
  }
}

// DELETE /api/v1/admin/settings/commissions/:categoryId
export const deleteCategoryCommission = async (req, res) => {
  try {
    const categoryId = Number(req.params.categoryId)

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID.',
      })
    }

    await prisma.categoryCommission.deleteMany({
      where: { categoryId },
    })

    return res.json({
      success: true,
      message: 'Category now uses the default commission rate.',
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      success: false,
      message: 'Unable to reset category commission.',
    })
  }
}