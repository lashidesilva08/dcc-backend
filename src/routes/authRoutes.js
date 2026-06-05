import express from "express";
import { forgotPassword, googleAuth, login, logout, register, resetPassword, verifyEmail } from "../controllers/authControllers.js";

const router = express.Router()

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuth);
router.post("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/logout", logout);

export default router;