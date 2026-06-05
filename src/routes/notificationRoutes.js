import express from "express";
import { getNotifications, markAsRead, clearAll, markAllRead, deleteNotification } from "../controllers/notificationControllers.js";

const router = express.Router();

router.get("/", getNotifications);
router.patch("/:id/read", markAsRead);
router.delete("/", clearAll);
router.patch("/all/read", markAllRead);
router.delete("/:id", deleteNotification);

export default router;