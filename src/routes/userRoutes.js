import express from 'express'
import { protect } from '../middleware/auth.js'
import { changePassword, deleteAccount, getProfile, updateProfile } from '../controllers/userControllers.js'

const router = express.Router()

router.use(protect)

router.get('/me', getProfile)
router.get('/profile', getProfile)
router.put('/profile', updateProfile)
router.put('/change-password', changePassword)
router.delete('/account', deleteAccount)

export default router
