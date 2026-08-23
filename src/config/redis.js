import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      // Stop retrying after 3 attempts if Redis is not running locally
      if (retries >= 3) {
        return false;
      }
      return 1000;
    }
  }
});

let isConnected = false;

redisClient.on('error', (err) => {
  if (isConnected) {
    console.error('Redis error:', err.message);
  }
});

redisClient.on('connect', () => {
  isConnected = true;
  console.log('✅ Redis connected');
});

export const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.warn('⚠️ Redis not running locally. Proceeding without Redis caching.');
  }
};

export const disconnectRedis = async () => {
  if (redisClient.isOpen) {
    await redisClient.disconnect();
  }
};

export default redisClient;