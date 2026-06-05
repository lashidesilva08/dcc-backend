import express from 'express';
import { submitInquiry, getAllTickets } from '../controllers/supportControllers.js';

const router = express.Router();

router.post("/contact", submitInquiry);
router.get("/tickets", getAllTickets); // Admin Only

export default router;