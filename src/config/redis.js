import { createClient } from 'redis';

// Initialize the client
const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Event listeners for health monitoring
client.on('error', (err) => console.error('❌ Redis Client Error:', err));
client.on('connect', () => console.log('✅ Redis Client Connected'));

/**
 * Ensures the Redis connection is established.
 * You'll call this in your main entry file.
 */
export const connectRedis = async () => {
    try {
        if (!client.isOpen) {
            await client.connect();
        }
    } catch (error) {
        console.error('Could not connect to Redis:', error);
    }
};

export const disconnectRedis = async () => {
    try {
        if (client.isOpen) {
            await client.disconnect();
            console.log('🛑 Redis Client Disconnected');
        }
    } catch (error) {
        console.error('Error during Redis disconnection:', error);
    }
};

// Export the client instance as a named export
export { client };