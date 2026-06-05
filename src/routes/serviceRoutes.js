
import express from "express";
import { getAllServices, bookService, getMyBookings, updateBooking, getServiceById,createServiceBooking,getProviderServices,updateBookingStatus} from "../controllers/serviceControllers.js";

const router = express.Router();


router.post("/book", bookService);
router.get("/my-bookings", getMyBookings);
router.patch("/booking/:id", updateBooking);


// Public routes
router.get('/', getAllServices);
router.get('/:id', getServiceById);

// Protected routes (Requires Authentication)
// router.use(protect);

router.post('/book',  createServiceBooking);
router.get('/provider/my-services', getProviderServices);
router.patch('/booking/:id/status',  updateBookingStatus);

export default router;