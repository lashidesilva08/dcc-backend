import express from "express";
import { getPendingSellers, approveSeller, getSalesReport, getDisputes, getDashboard, rejectSeller, suspendSeller, getAllOrders } from "../controllers/adminControllers.js";

const router = express.Router();

router.get("/sellers/pending", getPendingSellers);
router.patch("/sellers/:id/approve", approveSeller);
router.get("/reports/sales", getSalesReport);
router.get("/disputes", getDisputes);
router.get("/getdashboarddata", getDashboard);
router.patch("/sellers/:id/reject", rejectSeller);
router.patch("/sellers/:id/suspend", suspendSeller);
router.get("/orders", getAllOrders);


export default router;