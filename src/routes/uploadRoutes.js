import express from 'express';
import { uploadImage } from '../controllers/uploadControllers.js';

const router = express.Router();

router.post("/image", uploadImage);

export default router;