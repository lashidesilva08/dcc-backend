import express from "express";
import { forgotPassword, googleAuth, login, logout, register, registerSeller, resetPassword, verifyEmail } from "../controllers/authControllers.js";

const router = express.Router()

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuth);
router.get("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/logout", logout);
router.post("/register/seller", registerSeller);

export default router;