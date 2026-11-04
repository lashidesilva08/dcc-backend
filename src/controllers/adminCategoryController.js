import prisma from '../config/prisma.js'
import { cacheClearCategories } from './categoryControllers.js'
import {
  CATEGORY_ICON_URL_PREFIX,
  removeStoredIcon,
} from '../middleware/categoryIconUpload.js'

/* ------------------------------------------------------------------ *
 * Rules
 *  - Two levels only: a top-level category and its subcategories.
 *  - Names must be unique platform-wide (compared by slug), because the
 *    public storefront resolves categories by slug derived from the name.
 *  - Disabling a parent disables its subcategories (cascade).
 *  - A subcategory cannot be enabled while its parent is disabled.
 * ------------------------------------------------------------------ */

export const CATEGORY_STATUSES = ['active', 'disabled']

const NAME_MIN = 2
const NAME_MAX = 60
const DESCRIPTION_MAX = 300
const ICON_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,39}$/ // lucide icon name, e.g. "ShoppingBag"

// Must match the slug logic used by the public category endpoints.
const nameToSlug = (name) =>
  String(name)
    .toLowerCase()
    .replace(/[&]/g, 'and')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const parseId = (value) => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

const isBlank = (value) => value === undefined || value === null || String(value).trim() === ''

const parseBool = (value) => value === true || String(value).toLowerCase() === 'true'

/** Removes the freshly uploaded file when the request ends up rejected. */
const discardUpload = (req) => {
  if (req.file) removeStoredIcon(`${CATEGORY_ICON_URL_PREFIX}${req.file.filename}`)
}

const fail = (req, res, status, message, extra = {}) => {
  discardUpload(req)
  return res.status(status).json({ success: false, message, ...extra })
}

const serialize = (cat, extra = {}) => ({
  id: cat.id,
  name: cat.name,
  slug: nameToSlug(cat.name),
  icon: cat.icon,
  description: cat.description,
  status: cat.status,
  sortOrder: cat.sortOrder,
  parentId: cat.parentId,
  createdAt: cat.createdAt,
  updatedAt: cat.updatedAt,
  ...extra,
})

/** Validates the name and checks slug uniqueness. Returns an error string or null. */
async function validateName(name, excludeId = null) {
  const trimmed = String(name || '').trim()
  if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
    return `Category name must be between ${NAME_MIN} and ${NAME_MAX} characters.`
  }
  const slug = nameToSlug(trimmed)
  if (!slug) return 'Category name must contain letters or numbers.'

  const all = await prisma.category.findMany({ select: { id: true, name: true } })
  const clash = all.find((c) => c.id !== excludeId && nameToSlug(c.name) === slug)
  if (clash) return `A category named "${clash.name}" already exists.`
  return null
}

/** Resolves `parentId` input: '', 'null', null => top level. */
function readParentId(raw) {
  if (raw === undefined) return { provided: false }
  if (raw === null || String(raw).trim() === '' || String(raw) === 'null') {
    return { provided: true, value: null }
  }
  const id = parseId(raw)
  return id ? { provided: true, value: id } : { provided: true, invalid: true }
}

/** Resolves the icon from either an uploaded file or an icon-name string. */
function readIcon(req) {
  if (req.file) return { provided: true, value: `${CATEGORY_ICON_URL_PREFIX}${req.file.filename}` }
  if (parseBool(req.body?.removeIcon)) return { provided: true, value: null }
  if (req.body?.icon === undefined) return { provided: false }

  const icon = String(req.body.icon).trim()
  if (!icon) return { provided: true, value: null }
  if (!ICON_NAME_PATTERN.test(icon)) {
    return { provided: true, invalid: 'Icon must be a valid icon name (letters/numbers only) or an uploaded image.' }
  }
  return { provided: true, value: icon }
}

/* ------------------------------------------------------------------ *
 * GET /api/v1/admin/categories
 * query: status=all|active|disabled, search, parentId
 * Returns { data: tree, flat, stats }
 * ------------------------------------------------------------------ */
export const getAdminCategories = async (req, res) => {
  try {
    const status = String(req.query.status || 'all').toLowerCase()
    const search = String(req.query.search || '').trim().toLowerCase()

    if (status !== 'all' && !CATEGORY_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status filter.' })
    }

    const rows = await prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { listings: true, children: true } } },
    })

    const byId = new Map(rows.map((c) => [c.id, c]))

    const flat = rows.map((c) => {
      const parent = c.parentId ? byId.get(c.parentId) : null
      return serialize(c, {
        parentName: parent?.name ?? null,
        listingCount: c._count.listings,
        childCount: c._count.children,
        depth: c.parentId ? 1 : 0,
      })
    })

    const matches = (c) =>
      (status === 'all' || c.status === status) &&
      (!search || c.name.toLowerCase().includes(search))

    const flatById = new Map(flat.map((c) => [c.id, c]))
    const childrenOf = new Map()
    flat.forEach((c) => {
      if (c.parentId) {
        if (!childrenOf.has(c.parentId)) childrenOf.set(c.parentId, [])
        childrenOf.get(c.parentId).push(c)
      }
    })

    const hasFilter = status !== 'all' || Boolean(search)
    const tree = []
    for (const top of flat.filter((c) => !c.parentId)) {
      const kids = childrenOf.get(top.id) || []
      const selfMatch = matches(top)
      const visibleKids = hasFilter ? kids.filter(matches) : kids
      if (!hasFilter || selfMatch || visibleKids.length) {
        tree.push({
          ...top,
          // children shown even when the parent itself only matched through them
          children: hasFilter && selfMatch && !search && status === 'all' ? kids : visibleKids,
          matchedFilter: selfMatch,
          totalListingCount:
            top.listingCount + kids.reduce((sum, k) => sum + k.listingCount, 0),
        })
      }
    }

    const stats = {
      total: rows.length,
      active: rows.filter((c) => c.status === 'active').length,
      disabled: rows.filter((c) => c.status === 'disabled').length,
      topLevel: rows.filter((c) => !c.parentId).length,
      subcategories: rows.filter((c) => c.parentId).length,
    }

    // `flat` is always the unfiltered list so the parent dropdown stays complete.
    return res.status(200).json({ success: true, data: tree, flat: [...flatById.values()], stats })
  } catch (error) {
    console.error('getAdminCategories error:', error)
    return res.status(500).json({ success: false, message: 'Failed to load categories.' })
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/v1/admin/categories   (JSON or multipart/form-data)
 * fields: name*, parentId, description, icon (icon name), iconFile (image),
 *         status, sortOrder
 * ------------------------------------------------------------------ */
export const createAdminCategory = async (req, res) => {
  try {
    const body = req.body || {}

    const nameError = await validateName(body.name)
    if (nameError) return fail(req, res, 400, nameError)

    const description = isBlank(body.description) ? null : String(body.description).trim()
    if (description && description.length > DESCRIPTION_MAX) {
      return fail(req, res, 400, `Description must be ${DESCRIPTION_MAX} characters or fewer.`)
    }

    const status = isBlank(body.status) ? 'active' : String(body.status).toLowerCase()
    if (!CATEGORY_STATUSES.includes(status)) {
      return fail(req, res, 400, 'Status must be "active" or "disabled".')
    }

    let sortOrder = 0
    if (!isBlank(body.sortOrder)) {
      sortOrder = Number(body.sortOrder)
      if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) {
        return fail(req, res, 400, 'Sort order must be a whole number between 0 and 9999.')
      }
    }

    const icon = readIcon(req)
    if (icon.invalid) return fail(req, res, 400, icon.invalid)

    const parentInput = readParentId(body.parentId)
    if (parentInput.invalid) return fail(req, res, 400, 'Invalid parent category.')

    let parentId = null
    if (parentInput.provided && parentInput.value) {
      const parent = await prisma.category.findUnique({ where: { id: parentInput.value } })
      if (!parent) return fail(req, res, 404, 'Parent category not found.')
      if (parent.parentId) {
        return fail(req, res, 400, 'Subcategories can only be added under a top-level category.')
      }
      if (parent.status !== 'active' && status === 'active') {
        return fail(req, res, 409, 'Enable the parent category before adding an active subcategory.')
      }
      parentId = parent.id
    }

    const created = await prisma.category.create({
      data: {
        name: String(body.name).trim(),
        description,
        status,
        sortOrder,
        parentId,
        icon: icon.provided ? icon.value : null,
      },
    })

    await cacheClearCategories()
    return res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      data: serialize(created),
    })
  } catch (error) {
    console.error('createAdminCategory error:', error)
    discardUpload(req)
    return res.status(500).json({ success: false, message: 'Failed to create category.' })
  }
}

/* ------------------------------------------------------------------ *
 * PATCH /api/v1/admin/categories/:id   (JSON or multipart/form-data)
 * Any of: name, parentId (null/'' => top level), description, icon, iconFile,
 *         removeIcon, status, sortOrder, cascade
 * ------------------------------------------------------------------ */
export const updateAdminCategory = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return fail(req, res, 400, 'Invalid category id.')

    const body = req.body || {}
    const existing = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { children: true } } },
    })
    if (!existing) return fail(req, res, 404, 'Category not found.')

    const data = {}

    // name
    if (body.name !== undefined && String(body.name).trim() !== existing.name) {
      const nameError = await validateName(body.name, id)
      if (nameError) return fail(req, res, 400, nameError)
      data.name = String(body.name).trim()
    }

    // description
    if (body.description !== undefined) {
      const description = isBlank(body.description) ? null : String(body.description).trim()
      if (description && description.length > DESCRIPTION_MAX) {
        return fail(req, res, 400, `Description must be ${DESCRIPTION_MAX} characters or fewer.`)
      }
      data.description = description
    }

    // sort order
    if (!isBlank(body.sortOrder)) {
      const sortOrder = Number(body.sortOrder)
      if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) {
        return fail(req, res, 400, 'Sort order must be a whole number between 0 and 9999.')
      }
      data.sortOrder = sortOrder
    }

    // icon
    const icon = readIcon(req)
    if (icon.invalid) return fail(req, res, 400, icon.invalid)
    if (icon.provided) data.icon = icon.value

    // parent
    const parentInput = readParentId(body.parentId)
    if (parentInput.invalid) return fail(req, res, 400, 'Invalid parent category.')
    if (parentInput.provided && parentInput.value !== existing.parentId) {
      if (parentInput.value === null) {
        data.parentId = null
      } else {
        if (parentInput.value === id) {
          return fail(req, res, 400, 'A category cannot be its own parent.')
        }
        if (existing._count.children > 0) {
          return fail(
            req,
            res,
            400,
            'This category has subcategories, so it cannot be moved under another category.',
          )
        }
        const parent = await prisma.category.findUnique({ where: { id: parentInput.value } })
        if (!parent) return fail(req, res, 404, 'Parent category not found.')
        if (parent.parentId) {
          return fail(req, res, 400, 'Subcategories can only be added under a top-level category.')
        }
        data.parentId = parent.id
      }
    }

    // status (with cascade rules)
    let cascadedIds = []
    if (body.status !== undefined && String(body.status).toLowerCase() !== existing.status) {
      const nextStatus = String(body.status).toLowerCase()
      if (!CATEGORY_STATUSES.includes(nextStatus)) {
        return fail(req, res, 400, 'Status must be "active" or "disabled".')
      }

      const effectiveParentId = 'parentId' in data ? data.parentId : existing.parentId
      if (nextStatus === 'active' && effectiveParentId) {
        const parent = await prisma.category.findUnique({ where: { id: effectiveParentId } })
        if (parent && parent.status !== 'active') {
          return fail(req, res, 409, 'Enable the parent category first.')
        }
      }
      data.status = nextStatus

      const cascade = body.cascade === undefined ? true : parseBool(body.cascade)
      if (nextStatus === 'disabled' && cascade) {
        const kids = await prisma.category.findMany({
          where: { parentId: id, status: 'active' },
          select: { id: true },
        })
        cascadedIds = kids.map((k) => k.id)
      }
    } else if (
      'parentId' in data &&
      data.parentId &&
      (data.status ?? existing.status) === 'active'
    ) {
      const parent = await prisma.category.findUnique({ where: { id: data.parentId } })
      if (parent && parent.status !== 'active') {
        return fail(req, res, 409, 'The selected parent category is disabled.')
      }
    }

    if (Object.keys(data).length === 0) {
      return fail(req, res, 400, 'No changes were provided.')
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.category.update({ where: { id }, data })
      if (cascadedIds.length) {
        await tx.category.updateMany({
          where: { id: { in: cascadedIds } },
          data: { status: 'disabled' },
        })
      }
      return result
    })

    // Old uploaded icon is no longer referenced.
    if (icon.provided && existing.icon !== updated.icon) removeStoredIcon(existing.icon)

    await cacheClearCategories()
    return res.status(200).json({
      success: true,
      message: 'Category updated successfully.',
      data: serialize(updated),
      cascadedDisabled: cascadedIds.length,
    })
  } catch (error) {
    console.error('updateAdminCategory error:', error)
    discardUpload(req)
    return res.status(500).json({ success: false, message: 'Failed to update category.' })
  }
}

/* ------------------------------------------------------------------ *
 * PATCH /api/v1/admin/categories/:id/status
 * body: { status: 'active' | 'disabled', cascade?: boolean (default true) }
 * ------------------------------------------------------------------ */
export const setAdminCategoryStatus = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ success: false, message: 'Invalid category id.' })

    const status = String(req.body?.status || '').toLowerCase()
    if (!CATEGORY_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be "active" or "disabled".' })
    }
    const cascade = req.body?.cascade === undefined ? true : parseBool(req.body.cascade)

    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { listings: { where: { status: 'active' } } } } },
    })
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' })

    if (category.status === status) {
      return res.status(200).json({
        success: true,
        message: `Category is already ${status}.`,
        data: serialize(category),
        cascadedDisabled: 0,
      })
    }

    if (status === 'active' && category.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: category.parentId } })
      if (parent && parent.status !== 'active') {
        return res.status(409).json({
          success: false,
          message: `Enable the parent category "${parent.name}" first.`,
        })
      }
    }

    let cascadedIds = []
    if (status === 'disabled' && cascade) {
      const kids = await prisma.category.findMany({
        where: { parentId: id, status: 'active' },
        select: { id: true },
      })
      cascadedIds = kids.map((k) => k.id)
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.category.update({ where: { id }, data: { status } })
      if (cascadedIds.length) {
        await tx.category.updateMany({
          where: { id: { in: cascadedIds } },
          data: { status: 'disabled' },
        })
      }
      return result
    })

    await cacheClearCategories()
    return res.status(200).json({
      success: true,
      message: status === 'active' ? 'Category enabled.' : 'Category disabled.',
      data: serialize(updated),
      cascadedDisabled: cascadedIds.length,
      activeListings: category._count.listings,
    })
  } catch (error) {
    console.error('setAdminCategoryStatus error:', error)
    return res.status(500).json({ success: false, message: 'Failed to change category status.' })
  }
}