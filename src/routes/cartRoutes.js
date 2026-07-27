import express from 'express'
import {
  getCart,
  addToCart,
  removeFromCart,
  updateCartItem,
  clearCart,
} from '../controllers/cartControllers.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

router.use(protect)

router.get('/', getCart)
router.post('/add', addToCart)
router.put('/update/:id', updateCartItem)
router.delete('/clear', clearCart)
router.delete('/:id', removeFromCart)

export default router
