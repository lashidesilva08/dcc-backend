import express from "express";
import { getAssignedDeliveries, updateTracking, registerProvider, acceptJob, pickupOrder, markDelivered} from "../controllers/deliveryControllers.js";

const router = express.Router();

router.get("/assigned", getAssignedDeliveries);
router.patch("/:id/track", updateTracking);
router.post("/register", registerProvider);
router.post("/:id/accept", acceptJob);
router.post("/:id/pickup", pickupOrder);
router.post("/:id/deliver", markDelivered);

export default router;