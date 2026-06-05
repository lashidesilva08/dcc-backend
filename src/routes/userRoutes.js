import express from "express";
import { getProfile, updateProfile, changePassword, deleteAccount } from "../controllers/userControllers.js";

const router = express.Router();


router.get("/profile", getProfile);
router.put("/profile", updateProfile);


// Profile Management
router.get("/profile", getProfile);
// Security and Account
router.put("/change-password", changePassword);

router.delete("/account", deleteAccount);

export default router;