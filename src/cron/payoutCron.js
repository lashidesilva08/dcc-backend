import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const initPayoutCron = () => {
  // Runs every Wednesday at midnight (00:00)
  cron.schedule('0 0 * * 3', async () => {
    console.log('[Cron Job] Processing weekly seller payouts...');
    try {
      const updated = await prisma.payout.updateMany({
        where: { status: 'pending' },
        data: { status: 'cleared' },
      });
      console.log(`[Cron Job] Successfully cleared ${updated.count} pending payouts.`);
    } catch (error) {
      console.error('[Cron Job Error]:', error);
    }
  });
};

export default initPayoutCron;