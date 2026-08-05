import express from "express";

import {
  getNotifications,
  getUnreadNotifications,
  unreadCount,
  markAsRead,
  markAllRead,
  deleteNotification,
} from "../controllers/notification.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getNotifications);

router.get("/unread", getUnreadNotifications);

router.get("/count", unreadCount);

router.patch("/:id/read", markAsRead);

router.patch("/read-all", markAllRead);

router.delete("/:id", deleteNotification);

export default router;