import dotenv from "dotenv";
import app from "./app.js";
import { connectDB, disconnectDB } from "./config/prisma.js";
import { connectRedis, disconnectRedis } from "./config/redis.js";

dotenv.config();

// Initialize both Data Sources
const startDataSources = async () => {
  await connectDB();
  await connectRedis();
};

startDataSources();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

//Handle unhandled promise reactions (db connection errors)
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  server.close(async () => {
    await disconnectDB();
    process.exit(1);
  });
});

process.on("uncaughtException", async (err) => {
  console.error("Unhandled Exception:", err);
  await disconnectDB();
  process.exit(1);
});

process.on("SIGTERM", async () => {
  console.error("SIGTERM received, shutting down gracefully");
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
});