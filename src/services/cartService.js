import { randomUUID } from 'crypto'
import prisma from '../config/prisma.js'
import redisClient from '../config/redis.js'

const CART_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days
const DEFAULT_DELIVERY_FEE = 350
const FREE_DELIVERY_THRESHOLD = 15000

function cartKey(userId) {
  return `cart:user:${userId}`
}

function attrText(attributes) {
  if (!attributes || typeof attributes !== 'object') return {}
  const entries = Object.entries(attributes).reduce((acc, [key, value]) => {
    acc[String(key).toLowerCase()] = String(value)
    return acc
  }, {})
  return entries
}

function pickMainImage(variant) {
  const images = variant?.images || []
  const main = images.find((img) => img.isMain) || images[0]
  return main?.url || ''
}

function variantMatchesOptions(variant, { color = '', size = '' } = {}) {
  const attrs = attrText(variant.attributes)
  const colorOk = !color || Object.values(attrs).some((v) => v.toLowerCase() === color.toLowerCase())
  const sizeOk = !size || Object.values(attrs).some((v) => v.toLowerCase() === size.toLowerCase())
  return colorOk && sizeOk
}

export async function readCartItems(userId) {
  const raw = await redisClient.get(cartKey(userId))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeCartItems(userId, items) {
  await redisClient.setEx(cartKey(userId), CART_TTL_SECONDS, JSON.stringify(items))
}

export async function resolveVariant({ variantId, productId, listingId, color = '', size = '' }) {
  const resolvedVariantId = Number(variantId)
  if (Number.isInteger(resolvedVariantId) && resolvedVariantId > 0) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: resolvedVariantId },
      include: {
        images: true,
        listing: {
          include: {
            seller: { select: { id: true, shopName: true, shopUrl: true } },
            category: { select: { id: true, name: true } },
          },
        },
      },
    })
    return variant
  }

  const resolvedListingId = Number(productId ?? listingId)
  if (!Number.isInteger(resolvedListingId) || resolvedListingId <= 0) {
    return null
  }

  const listing = await prisma.listing.findUnique({
    where: { id: resolvedListingId },
    include: {
      seller: { select: { id: true, shopName: true, shopUrl: true } },
      category: { select: { id: true, name: true } },
      variants: {
        where: { status: 'active' },
        include: { images: true },
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!listing || listing.status !== 'active' || !listing.variants?.length) {
    return null
  }

  const matched =
    listing.variants.find((v) => variantMatchesOptions(v, { color, size }) && v.stock > 0) ||
    listing.variants.find((v) => variantMatchesOptions(v, { color, size })) ||
    listing.variants.find((v) => v.stock > 0) ||
    listing.variants[0]

  if (!matched) return null

  return {
    ...matched,
    listing: {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      status: listing.status,
      seller: listing.seller,
      category: listing.category,
    },
  }
}

export async function hydrateCart(userId) {
  const stored = await readCartItems(userId)
  if (!stored.length) {
    return {
      items: [],
      summary: {
        itemCount: 0,
        uniqueItems: 0,
        subtotal: 0,
        deliveryFee: 0,
        discount: 0,
        total: 0,
        currency: 'LKR',
      },
    }
  }

  const variantIds = [...new Set(stored.map((line) => Number(line.variantId)).filter(Boolean))]
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: {
      images: true,
      listing: {
        include: {
          seller: { select: { id: true, shopName: true, shopUrl: true } },
          category: { select: { id: true, name: true } },
        },
      },
    },
  })
  const byId = new Map(variants.map((v) => [v.id, v]))

  const validLines = []
  const items = []

  for (const line of stored) {
    const variant = byId.get(Number(line.variantId))
    if (!variant || variant.status !== 'active' || variant.listing?.status !== 'active') {
      continue
    }

    const quantity = Math.max(1, Math.min(Number(line.quantity) || 1, variant.stock || 1))
    const unitPrice = Number(variant.price) || 0
    const lineSubtotal = unitPrice * quantity
    const attrs = attrText(variant.attributes)

    validLines.push({
      id: line.id,
      variantId: variant.id,
      quantity,
      addedAt: line.addedAt || new Date().toISOString(),
    })

    items.push({
      id: line.id,
      lineId: line.id,
      variantId: variant.id,
      productId: variant.listingId,
      listingId: variant.listingId,
      name: variant.listing?.title || 'Product',
      brand: variant.listing?.category?.name || '',
      seller: variant.listing?.seller?.shopName || 'Marketplace Seller',
      sellerId: variant.listing?.seller?.id || null,
      image: pickMainImage(variant),
      attributes: variant.attributes || {},
      color: attrs.color || '',
      size: attrs.size || '',
      unitPrice,
      price: unitPrice,
      quantity,
      lineTotal: lineSubtotal,
      subtotal: lineSubtotal,
      stock: variant.stock,
      sku: variant.sku,
      status: variant.status,
    })
  }

  // Persist cleaned / stock-clamped cart if it drifted
  if (JSON.stringify(validLines) !== JSON.stringify(stored)) {
    await writeCartItems(userId, validLines)
  }

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const deliveryFee =
    itemCount === 0 ? 0 : subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DEFAULT_DELIVERY_FEE

  return {
    items,
    summary: {
      itemCount,
      uniqueItems: items.length,
      subtotal,
      deliveryFee,
      discount: 0,
      total: subtotal + deliveryFee,
      currency: 'LKR',
      freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
    },
  }
}

export async function addCartItem(userId, { variantId, productId, listingId, quantity = 1, color = '', size = '' }) {
  const qty = Math.max(1, Number(quantity) || 1)
  const variant = await resolveVariant({ variantId, productId, listingId, color, size })

  if (!variant) {
    const error = new Error('Product variant not found or unavailable.')
    error.status = 404
    throw error
  }

  if (variant.listing?.status && variant.listing.status !== 'active') {
    const error = new Error('This product is not available.')
    error.status = 400
    throw error
  }

  if (variant.status !== 'active') {
    const error = new Error('Selected variant is not available.')
    error.status = 400
    throw error
  }

  if ((variant.stock || 0) < 1) {
    const error = new Error('This item is out of stock.')
    error.status = 400
    throw error
  }

  const cart = await readCartItems(userId)
  const existingIndex = cart.findIndex((line) => Number(line.variantId) === variant.id)

  if (existingIndex >= 0) {
    const nextQty = cart[existingIndex].quantity + qty
    if (nextQty > variant.stock) {
      const error = new Error(`Only ${variant.stock} units available in stock.`)
      error.status = 400
      throw error
    }
    cart[existingIndex] = {
      ...cart[existingIndex],
      quantity: nextQty,
    }
  } else {
    if (qty > variant.stock) {
      const error = new Error(`Only ${variant.stock} units available in stock.`)
      error.status = 400
      throw error
    }
    cart.push({
      id: randomUUID(),
      variantId: variant.id,
      quantity: qty,
      addedAt: new Date().toISOString(),
    })
  }

  await writeCartItems(userId, cart)
  return hydrateCart(userId)
}

export async function updateCartItemQuantity(userId, lineId, quantity) {
  const qty = Math.floor(Number(quantity))
  if (!Number.isInteger(qty) || qty < 1) {
    const error = new Error('Quantity must be a positive integer.')
    error.status = 400
    throw error
  }

  const cart = await readCartItems(userId)
  const index = cart.findIndex((line) => line.id === lineId)
  if (index < 0) {
    const error = new Error('Cart item not found.')
    error.status = 404
    throw error
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: Number(cart[index].variantId) },
    select: { id: true, stock: true, status: true },
  })

  if (!variant || variant.status !== 'active') {
    const error = new Error('Product variant is no longer available.')
    error.status = 400
    throw error
  }

  if (qty > variant.stock) {
    const error = new Error(`Only ${variant.stock} units available in stock.`)
    error.status = 400
    throw error
  }

  cart[index] = { ...cart[index], quantity: qty }
  await writeCartItems(userId, cart)
  return hydrateCart(userId)
}

export async function removeCartItem(userId, lineId) {
  const cart = await readCartItems(userId)
  const next = cart.filter((line) => line.id !== lineId)
  if (next.length === cart.length) {
    const error = new Error('Cart item not found.')
    error.status = 404
    throw error
  }
  await writeCartItems(userId, next)
  return hydrateCart(userId)
}

export async function clearCartItems(userId) {
  await redisClient.del(cartKey(userId))
  return hydrateCart(userId)
}
