import { client } from "../config/redis.js";

/**
 * @param {number} duration - Time to live (TTL) in seconds
 */
export const cacheMiddleware = (duration = 3600) => {
  return async (req, res, next) => {
    // Generate a unique key based on the URL (e.g., /api/users?id=1)
    const key = `cache:${req.originalUrl || req.url}`;

    try {
      // 1. Check if the data exists in Redis
      const cachedResponse = await client.get(key);

      if (cachedResponse) {
        console.log(`⚡ Cache Hit: ${key}`);
        // Return the cached data and stop the request from hitting the DB
        return res.json(JSON.parse(cachedResponse));
      }

      console.log(`🐢 Cache Miss: ${key}`);

      // 2. If it doesn't exist, we need to capture the response from the DB
      // We "intercept" the res.json method
      const originalJson = res.json;

      res.json = (body) => {
        // Only cache successful responses (Status 200)
        if (res.statusCode === 200) {
          client.setEx(key, duration, JSON.stringify(body));
        }
        
        // Call the original res.json to actually send the response to the user
        return originalJson.call(res, body);
      };

      next();
    } catch (error) {
      console.error("Redis Middleware Error:", error);
      // If Redis fails, we don't want the whole site to crash. 
      // We just call next() so the request goes to the Database as a fallback.
      next();
    }
  };
};