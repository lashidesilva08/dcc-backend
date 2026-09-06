import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get Seller Earnings & Payout Breakdown
 * GET /api/v1/seller/earnings
 */
export const getSellerEarnings = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch Seller record
    const seller = await prisma.seller.findUnique({
      where: { userId: Number(userId) },
    });

    if (!seller) {
      return res.status(404).json({ error: 'Seller profile not found.' });
    }

    const platformCommissionRate = seller.commissionRate / 100; // e.g., 10.0 -> 0.10

    // 2. Fetch delivered order items for this seller
    const orderItems = await prisma.orderItem.findMany({
      where: {
        sellerId: seller.id,
        itemStatus: 'delivered',
      },
      include: {
        order: {
          select: {
            createdAt: true,
            paymentStatus: true,
          },
        },
      },
    });

    // 3. Calculate Earnings
    const grossSales = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const platformCommission = grossSales * platformCommissionRate;
    const netEarnings = grossSales - platformCommission;

    // 4. Fetch Payout history
    const payouts = await prisma.payout.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: 'desc' },
    });

    const totalPaidOut = payouts
      .filter((p) => p.status === 'cleared')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingPayouts = payouts
      .filter((p) => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);

    const availableBalance = Math.max(0, netEarnings - totalPaidOut - pendingPayouts);

    // 5. Aggregate sales by month
    const monthlyMap = {};
    orderItems.forEach((item) => {
      const month = item.order.createdAt.toLocaleString('en-US', { month: 'short' });
      const itemNet = item.subtotal * (1 - platformCommissionRate);
      monthlyMap[month] = (monthlyMap[month] || 0) + itemNet;
    });

    const monthlyData = Object.entries(monthlyMap).map(([month, amount]) => ({
      month,
      amount,
    }));

    return res.status(200).json({
      summary: {
        grossSales,
        platformCommission,
        netEarnings,
        totalPaidOut,
        pendingPayouts,
        availableBalance,
      },
      monthlyData,
      payouts: payouts.map((p) => ({
        id: p.payoutNumber,
        date: p.createdAt.toISOString(),
        account: p.bankAccountInfo,
        amount: p.amount,
        status: p.status,
      })),
    });
  } catch (error) {
    console.error('[Seller Earnings Error]:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Request Express / Manual Payout
 * POST /api/v1/seller/payouts/request
 */
export const requestPayout = async (req, res) => {
  try {
    const userId = req.user.id;

    const seller = await prisma.seller.findUnique({
      where: { userId: Number(userId) },
    });

    if (!seller) {
      return res.status(404).json({ error: 'Seller profile not found.' });
    }

    const platformCommissionRate = seller.commissionRate / 100;

    // Calculate available balance server-side
    const orderItems = await prisma.orderItem.findMany({
      where: { sellerId: seller.id, itemStatus: 'delivered' },
    });

    const grossSales = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const netEarnings = grossSales * (1 - platformCommissionRate);

    const payouts = await prisma.payout.findMany({ where: { sellerId: seller.id } });
    const totalPaidOut = payouts.filter((p) => p.status === 'cleared').reduce((sum, p) => sum + p.amount, 0);
    const pendingPayouts = payouts.filter((p) => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);

    const availableBalance = Math.max(0, netEarnings - totalPaidOut - pendingPayouts);

    if (availableBalance <= 0) {
      return res.status(400).json({ error: 'No available balance to withdraw.' });
    }

    const bankAccountInfo =
      seller.bankName && seller.accountNumber
        ? `${seller.bankName} - *${seller.accountNumber.slice(-4)}`
        : 'HNB Bank - *4829';

    const payoutNumber = `PAY-${Math.floor(100000 + Math.random() * 900000)}`;

    const newPayout = await prisma.payout.create({
      data: {
        payoutNumber,
        sellerId: seller.id,
        amount: availableBalance,
        bankAccountInfo,
        status: 'pending',
      },
    });

    return res.status(201).json({
      message: 'Payout request submitted successfully.',
      payout: {
        id: newPayout.payoutNumber,
        date: newPayout.createdAt.toISOString(),
        account: newPayout.bankAccountInfo,
        amount: newPayout.amount,
        status: newPayout.status,
      },
    });
  } catch (error) {
    console.error('[Request Payout Error]:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Export Earnings History as CSV
 * GET /api/v1/seller/earnings/export-csv
 */
export const exportEarningsCSV = async (req, res) => {
  try {
    const userId = req.user.id;

    const seller = await prisma.seller.findUnique({
      where: { userId: Number(userId) },
    });

    if (!seller) {
      return res.status(404).json({ error: 'Seller not found.' });
    }

    const payouts = await prisma.payout.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: 'desc' },
    });

    let csvContent = 'Transaction ID,Date,Account,Amount (LKR),Status\n';
    payouts.forEach((p) => {
      const dateStr = new Date(p.createdAt).toLocaleDateString();
      csvContent += `${p.payoutNumber},${dateStr},"${p.bankAccountInfo}",${p.amount},${p.status}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=earnings_history_${Date.now()}.csv`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error('[Export CSV Error]:', error);
    return res.status(500).json({ error: error.message });
  }
};