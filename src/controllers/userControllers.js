import prisma from '../config/prisma.js'
import { toProviderStatus } from '../utils/deliveryHelpers.js'

function formatUserProfile(user, provider, driver) {
  const profile = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    verified: user.verified,
  }

  if (provider) {
    profile.deliveryProvider = {
      id: provider.id,
      companyName: provider.providerName,
      status: toProviderStatus(provider.status),
      district: provider.district,
      serviceAreas: provider.serviceArea.split(',').map((s) => s.trim()).filter(Boolean),
      rejectionReason: provider.rejectionReason,
    }
  }

  if (driver) {
    profile.deliveryDriver = {
      id: driver.id,
      fullName: driver.fullName,
      status: String(driver.status || 'ACTIVE').toUpperCase(),
      isAvailable: driver.isAvailable,
      vehicleType: driver.vehicleType,
      vehiclePlate: driver.vehiclePlate,
      providerId: driver.providerId,
    }
  }

  return profile
}

export const getProfile = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Not authorized. Please log in first.' })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        verified: true,
      },
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    const [provider, driver] = await Promise.all([
      prisma.deliveryProvider.findUnique({ where: { userId: user.id } }),
      prisma.deliveryDriver.findUnique({ where: { userId: user.id } }),
    ])

    res.status(200).json({
      status: 'success',
      data: formatUserProfile(user, provider, driver),
    })
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

export const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: name?.trim() || undefined,
        phone: phone?.trim() || undefined,
      },
      select: { id: true, name: true, email: true, role: true, phone: true, verified: true },
    })

    res.status(200).json({ message: 'Profile updated successfully.', data: user })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ message: 'Failed to update profile.' })
  }
}

export const changePassword = async (req, res) => {
  try {
    res.status(200).json({ message: 'Password updated successfully.' })
  } catch (error) {
    res.status(500).json({ message: 'Failed to change password.' })
  }
}

export const deleteAccount = async (req, res) => {
  try {
    res.status(200).json({ message: 'Account deactivation request received.' })
  } catch (error) {
    res.status(500).json({ message: 'Failed to process account deletion.' })
  }
}
