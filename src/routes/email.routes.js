import express from "express";

import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendResetPasswordEmail,
  sendOrderConfirmationEmail,
  sendSellerApprovedEmail,
  sendSellerRejectedEmail,
} from "../controllers/email.controller.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Account Emails
|--------------------------------------------------------------------------
*/

router.post("/welcome", sendWelcomeEmail);

router.post("/verify", sendVerificationEmail);

router.post("/reset-password", sendResetPasswordEmail);

/*
|--------------------------------------------------------------------------
| Order Emails
|--------------------------------------------------------------------------
*/

router.post(
  "/order-confirmation",
  sendOrderConfirmationEmail
);

/*
|--------------------------------------------------------------------------
| Seller Emails
|--------------------------------------------------------------------------
*/

router.post(
  "/seller-approved",
  sendSellerApprovedEmail
);

router.post(
  "/seller-rejected",
  sendSellerRejectedEmail
);

export default router;