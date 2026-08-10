import {
  addCartItem,
  clearCartItems,
  hydrateCart,
  removeCartItem,
  updateCartItemQuantity,
} from '../services/cartService.js'

function sendError(res, error) {
  const status = error.status || 500
  return res.status(status).json({
    success: false,
    message: error.message || 'Something went wrong while processing your cart.',
  })
}

export const getCart = async (req, res) => {
  try {
    const cart = await hydrateCart(req.user.id)
    return res.status(200).json({
      success: true,
      message: 'Cart retrieved successfully',
      cart: cart.items,
      items: cart.items,
      summary: cart.summary,
    })
  } catch (error) {
    console.error('getCart error:', error)
    return sendError(res, error)
  }
}

export const addToCart = async (req, res) => {
  try {
    const { variantId, productId, listingId, quantity, color, size } = req.body || {}

    if (!variantId && !productId && !listingId) {
      return res.status(400).json({
        success: false,
        message: 'variantId or productId is required.',
      })
    }

    const cart = await addCartItem(req.user.id, {
      variantId,
      productId,
      listingId,
      quantity,
      color,
      size,
    })

    return res.status(201).json({
      success: true,
      message: 'Product added to cart',
      cart: cart.items,
      items: cart.items,
      summary: cart.summary,
    })
  } catch (error) {
    console.error('addToCart error:', error)
    return sendError(res, error)
  }
}

export const removeFromCart = async (req, res) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(400).json({ success: false, message: 'Cart item id is required.' })
    }

    const cart = await removeCartItem(req.user.id, id)
    return res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      cart: cart.items,
      items: cart.items,
      summary: cart.summary,
    })
  } catch (error) {
    console.error('removeFromCart error:', error)
    return sendError(res, error)
  }
}

export const updateCartItem = async (req, res) => {
  try {
    const { id } = req.params
    const { quantity } = req.body || {}

    if (!id) {
      return res.status(400).json({ success: false, message: 'Cart item id is required.' })
    }

    const cart = await updateCartItemQuantity(req.user.id, id, quantity)
    return res.status(200).json({
      success: true,
      message: 'Cart item updated',
      cart: cart.items,
      items: cart.items,
      summary: cart.summary,
    })
  } catch (error) {
    console.error('updateCartItem error:', error)
    return sendError(res, error)
  }
}

export const clearCart = async (req, res) => {
  try {
    const cart = await clearCartItems(req.user.id)
    return res.status(200).json({
      success: true,
      message: 'Cart cleared',
      cart: cart.items,
      items: cart.items,
      summary: cart.summary,
    })
  } catch (error) {
    console.error('clearCart error:', error)
    return sendError(res, error)
  }
}
