import { protect } from './auth.middleware.js'

export const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN']

/**
 * Allows only admin roles. Must run after `protect`, which loads req.user.
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized. Please log in first.',
    })
  }

  const role = String(req.user.role || '').toUpperCase()

  // Temporary debugging
  console.log('[ADMIN AUTH CHECK]', {
    userId: req.user.id,
    role: req.user.role,
    accepted: ADMIN_ROLES.includes(role),
  })

  if (!ADMIN_ROLES.includes(role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges are required.',
    })
  }

  next()
}

/**
 * Full admin guard: valid JWT + admin role.
 * Usage: router.use(...adminAuth)
 */
export const adminAuth = [protect, requireAdmin]