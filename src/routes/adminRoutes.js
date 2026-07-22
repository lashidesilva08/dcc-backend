import express from "express";
import { getPendingSellers, approveSeller, getSalesReport, getDisputes, getDashboard, rejectSeller, suspendSeller, getAllOrders, getDeliveryProviders, approveDeliveryProvider, rejectDeliveryProvider } from "../controllers/adminControllers.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.use(requireRole('SUPER_ADMIN', 'ADMIN'));

router.get("/sellers/pending", getPendingSellers);
router.patch("/sellers/:id/approve", approveSeller);
router.get("/reports/sales", getSalesReport);
router.get("/disputes", getDisputes);
router.get("/getdashboarddata", getDashboard);
router.patch("/sellers/:id/reject", rejectSeller);
router.patch("/sellers/:id/suspend", suspendSeller);
router.get("/orders", getAllOrders);

router.get("/delivery-providers", getDeliveryProviders);
router.put("/delivery-providers/:id/approve", approveDeliveryProvider);
router.put("/delivery-providers/:id/reject", rejectDeliveryProvider);

export default router;