import express from "express";
import {
  forgotPassword,
  googleAuth,
  login,
  logout,
  register,
  registerSeller,
  resetPassword,
  verifyEmail,
  adminLogin,
  verifyOTP,
} from "../controllers/authControllers.js";

import passport from "../config/passport.js";
import jwt from "jsonwebtoken";

const router = express.Router();

router.post("/register", register);

router.post("/login", login);

router.post("/google", googleAuth);

router.post("/admin/login", adminLogin);

router.get("/verify-email", verifyEmail);

// Google OAuth routes
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

// ============================================================
// GOOGLE LOGIN
// ============================================================
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
)

// ============================================================
// GOOGLE CALLBACK
// ============================================================
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect:
      `${process.env.FRONTEND_URL}/login?google=failed`,
  }),

  (req, res) => {
    try {
      const token = jwt.sign(
        {
          userId: req.user.id,
          role: req.user.role,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: '7d',
        }
      )

      const frontendUrl =
        process.env.FRONTEND_URL ||
        'http://localhost:5173'

      res.redirect(
        `${frontendUrl}/auth/google/success?token=${encodeURIComponent(token)}`
      )
    } catch (error) {
      console.error(
        'Google callback error:',
        error
      )

      res.redirect(
        `${process.env.FRONTEND_URL}/login?google=failed`
      )
    }
  }
)

router.post("/forgot-password", forgotPassword);

router.post("/reset-password", resetPassword);

router.post("/logout", logout);

router.post("/register/seller", registerSeller);

router.post("/verify-otp", verifyOTP);

export default router;