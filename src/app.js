import express from "express";
import passport from './config/passport.js';
import cors from "cors";
import path from "path";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import cartRoutes from "./routes/cartRoutes.js"
import emailRoutes from "./routes/email.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import sellerRoutes from './routes/sellerRoutes.js';
import sellerNotificationRoutes from './routes/sellerNotificationRoutes.js'
import sellerDashboardRoutes from './routes/sellerDashboardRoutes.js';
import sellerSettingsRoutes from './routes/sellerSettingsRoutes.js';
import sellerImageRoutes from './routes/sellerImageRoutes.js';


import wishlistRoutes from "./routes/wishlistRoutes.js"
import paymentRoutes from "./routes/paymentRoutes.js"
import adminRoutes from "./routes/adminRoutes.js";
import deliveryRoutes from "./routes/deliveryRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import shopRoutes from "./routes/shopRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import HomeRoute from "./routes/homepageRoutes.js";
import sellerEarningsRoutes from "./routes/sellerEarningsRoutes.js"
import uploadRoutes from "./routes/uploadRoutes.js";

const app = express();

app.use(express.json());
app.use(passport.initialize());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman) or any localhost origin
    if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.urlencoded({ extended: true }))

app.use("/api/v1/seller", sellerRoutes);
app.use("/api/v1/seller/settings", sellerSettingsRoutes);
app.use("/api/v1/seller/images", sellerImageRoutes);
app.use("/api/v1/seller/settings/images", sellerImageRoutes);


app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use('/api/v1/seller/settings', sellerSettingsRoutes);
app.use("/api/v1/seller", sellerRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Digital City Center Backend is running!", status: "active" });
});

app.use("/api/v1/email", emailRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/wishlist", wishlistRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/delivery", deliveryRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/shops", shopRoutes);
app.use("/api/v1/services", serviceRoutes);
app.use("/api/v1/search", searchRoutes);
app.use("/api/v1/seller", sellerRoutes);
app.use('/api/v1/seller/notifications', sellerNotificationRoutes
)
app.use("/api/v1/upload", uploadRoutes);
//app.use("/api/v1/seller-dashboard", sellerDashboardRoutes);
app.use("/api/v1/home", HomeRoute);
app.use("/api/v1/seller", sellerEarningsRoutes);


export default app;