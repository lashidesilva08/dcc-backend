import express from 'express';
import {getSellerEarnings,requestPayout,exportEarningsCSV,} from '../controllers/sellerEarningsController.js';
import { protect } from "../middleware/auth.js"; 

const router = express.Router();

router.use(protect);

router.get('/earnings', getSellerEarnings);
router.post('/payouts/request', requestPayout);
router.get('/earnings/export-csv', exportEarningsCSV);

export default router;