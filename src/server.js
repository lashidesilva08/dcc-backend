import dotenv from 'dotenv'

dotenv.config()

import app from './app.js'
import {
  connectDB,
  disconnectDB,
} from './config/prisma.js'
import {
  connectRedis,
  disconnectRedis,
} from './config/redis.js'
import { initPayoutCron } from './cron/payoutCron.js';

const startServer = async () => {
  try {
    await connectDB()
    await connectRedis()

    const PORT =
      process.env.PORT || 5000

    const server = app.listen(
      PORT,
      () => {
        console.log(
          `Server running on http://localhost:${PORT}`
        )
        // Initialize cron job after server starts
        // initPayoutCron();
      }
    )

    process.on(
      'unhandledRejection',
      async (error) => {
        console.error(
          'Unhandled Rejection:',
          error
        )

        server.close(async () => {
          await disconnectDB()
          await disconnectRedis()
          process.exit(1)
        })
      }
    )

    process.on(
      'uncaughtException',
      async (error) => {
        console.error(
          'Unhandled Exception:',
          error
        )

        await disconnectDB()
        await disconnectRedis()
        process.exit(1)
      }
    )

    process.on(
      'SIGTERM',
      async () => {
        console.log(
          'SIGTERM received, shutting down gracefully'
        )

        server.close(async () => {
          await disconnectDB()
          await disconnectRedis()
          process.exit(0)
        })
      }
    )
  } catch (error) {
    console.error(
      'Failed to start server:',
      error
    )

    await disconnectDB()
    await disconnectRedis()

    process.exit(1)
  }
}

startServer()