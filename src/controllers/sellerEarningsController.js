import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* =========================================================
   SHARED HELPERS
   The dashboard and the payout endpoint MUST agree on the
   numbers, otherwise the UI offers a balance the payout
   endpoint then refuses to pay.
========================================================= */

// An order item only counts as earned once the buyer has it AND the order is paid.
const EARNED_ITEM_STATUSES = ["delivered", "DELIVERED", "completed", "COMPLETED"];
const PAID_ORDER_STATUSES = ["paid", "PAID", "completed", "COMPLETED"];

const MONTHS_ON_CHART = 6;

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const monthKey = (date) => `${date.getFullYear()}-${date.getMonth()}`;

/**
 * Parse ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD into a validated range.
 * Returns null when neither is given or the given values don't parse -
 * callers then fall back to "no filter" behaviour.
 */
const parseDateRange = (startDate, endDate) => {
  if (!startDate && !endDate) return null;

  const start = startDate ? new Date(startDate) : null;
  // Include the entire end day, not just midnight.
  const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;

  if (start && Number.isNaN(start.getTime())) return null;
  if (end && Number.isNaN(end.getTime())) return null;
  if (start && end && start > end) return null;

  return { start, end };
};

/** Resolve the Seller profile of the logged-in user. */
const getSellerForRequest = async (req) => {
  const userId = Number(req.user?.id ?? req.user?.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  return prisma.seller.findUnique({ where: { userId } });
};

/** Human label for the payout destination. */
const getBankLabel = (seller) =>
  seller.bankName || seller.bankAccountName || "Bank account";

/**
 * Single source of truth for a seller's financial position.
 * Used by the dashboard, the payout request and the CSV export.
 *
 * `range`, if given, filters which order items / payouts are counted
 * toward grossSales, commission, net earnings, the monthly chart and
 * the payout history list. It intentionally does NOT change
 * totalPaidOut / pendingPayouts / availableBalance when called for a
 * payout request - the money a seller can withdraw is always the true
 * all-time figure, never a filtered slice of it.
 */
const calculateEarnings = async (seller, range = null) => {
  const commissionRate = (seller.commissionRate ?? 10) / 100;

  const orderDateFilter = range
    ? {
        ...(range.start ? { gte: range.start } : {}),
        ...(range.end ? { lte: range.end } : {}),
      }
    : undefined;

  const orderItems = await prisma.orderItem.findMany({
    where: {
      sellerId: seller.id,
      itemStatus: { in: EARNED_ITEM_STATUSES },
      order: {
        paymentStatus: { in: PAID_ORDER_STATUSES },
        ...(orderDateFilter ? { createdAt: orderDateFilter } : {}),
      },
    },
    include: {
      order: { select: { createdAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // subtotal is the authoritative figure; fall back to unitPrice * quantity.
  const grossSales = orderItems.reduce((sum, item) => {
    const line = item.subtotal ?? (item.unitPrice || 0) * (item.quantity || 1);
    return sum + Number(line || 0);
  }, 0);

  const platformCommission = grossSales * commissionRate;
  const netEarnings = grossSales - platformCommission;

  const allPayouts = await prisma.payout.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
  });

  const sumByStatus = (list, status) =>
    list
      .filter((p) => String(p.status).toLowerCase() === status)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // Balance-related figures always use the FULL history, regardless of `range`.
  const totalPaidOut = sumByStatus(allPayouts, "cleared");
  const pendingPayouts = sumByStatus(allPayouts, "pending");
  // "failed" payouts are deliberately NOT subtracted - that money is released
  // back to the seller and becomes withdrawable again.

  // Net earnings used for the balance calc must also be all-time, even
  // when `range` is set, so a date filter can never inflate what's
  // actually available to withdraw.
  let allTimeNetEarnings = netEarnings;
  if (range) {
    const allTimeItems = await prisma.orderItem.findMany({
      where: {
        sellerId: seller.id,
        itemStatus: { in: EARNED_ITEM_STATUSES },
        order: { paymentStatus: { in: PAID_ORDER_STATUSES } },
      },
      select: { subtotal: true, unitPrice: true, quantity: true },
    });
    const allTimeGross = allTimeItems.reduce((sum, item) => {
      const line = item.subtotal ?? (item.unitPrice || 0) * (item.quantity || 1);
      return sum + Number(line || 0);
    }, 0);
    allTimeNetEarnings = allTimeGross * (1 - commissionRate);
  }

  const availableBalance = Math.max(
    0,
    round2(allTimeNetEarnings - totalPaidOut - pendingPayouts),
  );

  const payouts = range
    ? allPayouts.filter((p) => {
        const d = new Date(p.createdAt);
        if (range.start && d < range.start) return false;
        if (range.end && d > range.end) return false;
        return true;
      })
    : allPayouts;

  /* ---------- Monthly sales trend ----------
     No range: pre-seed the last N months so the chart always renders
     in order. With a range: build one bucket per month spanned by the
     range so the chart matches what the user asked to see.          */
  const buckets = [];

  if (range && (range.start || range.end)) {
    const rangeStart = range.start || (orderItems[0]?.order?.createdAt ?? new Date());
    const rangeEnd = range.end || new Date();
    const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    const last = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);

    // Safety cap so a garbage/huge range can't allocate unbounded buckets.
    let guard = 0;
    while (cursor <= last && guard < 120) {
      buckets.push({
        key: monthKey(cursor),
        month: cursor.toLocaleString("en-US", { month: "short" }),
        year: cursor.getFullYear(),
        amount: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
      guard += 1;
    }
  } else {
    const now = new Date();
    for (let i = MONTHS_ON_CHART - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: monthKey(d),
        month: d.toLocaleString("en-US", { month: "short" }),
        year: d.getFullYear(),
        amount: 0,
      });
    }
  }

  const bucketIndex = new Map(buckets.map((b) => [b.key, b]));

  orderItems.forEach((item) => {
    const soldAt = new Date(item.order?.createdAt ?? item.createdAt);
    const bucket = bucketIndex.get(monthKey(soldAt));

    if (bucket) {
      const line = item.subtotal ?? (item.unitPrice || 0) * (item.quantity || 1);
      bucket.amount += Number(line || 0) * (1 - commissionRate);
    }
  });

  const monthlyData = buckets.map((b) => ({
    month: b.month,
    year: b.year,
    amount: round2(b.amount),
  }));

  return {
    summary: {
      grossSales: round2(grossSales),
      platformCommission: round2(platformCommission),
      netEarnings: round2(netEarnings),
      totalPaidOut: round2(totalPaidOut),
      pendingPayouts: round2(pendingPayouts),
      availableBalance,
      commissionRate: seller.commissionRate ?? 10,
      orderItemCount: orderItems.length,
    },
    monthlyData,
    payouts,
  };
};

/** Shape a Payout row the way the frontend table expects. */
const formatPayout = (p) => ({
  id: p.payoutNumber,
  date: p.createdAt.toISOString(),
  account: p.bankAccountInfo,
  amount: Number(p.amount || 0),
  // Normalised so the UI's pending / cleared / failed check is reliable.
  status: String(p.status || "pending").toLowerCase(),
});

/* =========================================================
   GET /api/v1/seller/earnings
========================================================= */
export const getSellerEarnings = async (req, res) => {
  try {
    const seller = await getSellerForRequest(req);

    if (!seller) {
      return res.status(404).json({
        message: "Seller profile not found.",
        error: "Seller profile not found.",
      });
    }

    const range = parseDateRange(req.query?.startDate, req.query?.endDate);
    const { summary, monthlyData, payouts } = await calculateEarnings(seller, range);

    return res.status(200).json({
      success: true,
      summary,
      monthlyData,
      payouts: payouts.map(formatPayout),
      dateRange: range
        ? { startDate: req.query.startDate || null, endDate: req.query.endDate || null }
        : null,
      bankDetails: {
        bankName: getBankLabel(seller),
        bankAccountNumber: seller.bankAccountNumber || "",
      },
    });
  } catch (error) {
    console.error("[Seller Earnings Error]:", error);
    // `message` is what the axios interceptor in client.js reads.
    return res.status(500).json({ message: error.message, error: error.message });
  }
};

/* =========================================================
   POST /api/v1/seller/payouts/request
========================================================= */
export const requestPayout = async (req, res) => {
  try {
    const seller = await getSellerForRequest(req);

    if (!seller) {
      return res.status(404).json({
        message: "Seller profile not found.",
        error: "Seller profile not found.",
      });
    }

    if (!seller.bankAccountNumber) {
      const msg =
        "Please configure your bank details in settings before requesting a payout.";
      return res.status(400).json({ message: msg, error: msg });
    }

    // Exactly the same maths the dashboard displayed.
    const { summary } = await calculateEarnings(seller);
    const availableBalance = summary.availableBalance;

    if (availableBalance <= 0) {
      const msg = "No available balance to withdraw.";
      return res.status(400).json({ message: msg, error: msg });
    }

    const last4 = String(seller.bankAccountNumber).slice(-4);
    const bankAccountInfo = `${getBankLabel(seller)} - *${last4}`;

    // Timestamp + random keeps this unique under concurrent requests.
    const payoutNumber = `PAY-${Date.now().toString(36).toUpperCase()}${Math.floor(
      1000 + Math.random() * 9000,
    )}`;

    const newPayout = await prisma.payout.create({
      data: {
        payoutNumber,
        sellerId: seller.id,
        amount: availableBalance,
        bankAccountInfo,
        status: "pending",
      },
    });

    return res.status(201).json({
      success: true,
      message: "Payout request submitted successfully.",
      payout: formatPayout(newPayout),
    });
  } catch (error) {
    console.error("[Request Payout Error]:", error);
    return res.status(500).json({ message: error.message, error: error.message });
  }
};

/* =========================================================
   GET /api/v1/seller/earnings/export-csv
========================================================= */
export const exportEarningsCSV = async (req, res) => {
  try {
    const seller = await getSellerForRequest(req);

    if (!seller) {
      return res.status(404).json({
        message: "Seller profile not found.",
        error: "Seller profile not found.",
      });
    }

    const range = parseDateRange(req.query?.startDate, req.query?.endDate);
    const { summary, monthlyData, payouts } = await calculateEarnings(seller, range);

    // Wrap every field in quotes and escape embedded quotes so bank labels
    // containing a comma don't shift the columns.
    const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const row = (...cells) => `${cells.map(cell).join(",")}\n`;

    let csv = "";

    csv += row("Earnings Summary");
    if (range) {
      csv += row(
        "Date Range",
        `${req.query.startDate || "start"} to ${req.query.endDate || "now"}`,
      );
    }
    csv += row("Gross Sales (LKR)", summary.grossSales);
    csv += row(
      `Platform Commission (${summary.commissionRate}%)`,
      summary.platformCommission,
    );
    csv += row("Net Earnings (LKR)", summary.netEarnings);
    csv += row("Total Paid Out (LKR)", summary.totalPaidOut);
    csv += row("Pending Payouts (LKR)", summary.pendingPayouts);
    csv += row("Available Balance (LKR)", summary.availableBalance);
    csv += "\n";

    csv += row("Monthly Earnings");
    csv += row("Month", "Year", "Net Earnings (LKR)");
    monthlyData.forEach((m) => {
      csv += row(m.month, m.year, m.amount);
    });
    csv += "\n";

    csv += row("Payout History");
    csv += row("Transaction ID", "Date", "Account", "Amount (LKR)", "Status");
    payouts.forEach((p) => {
      csv += row(
        p.payoutNumber,
        new Date(p.createdAt).toLocaleDateString("en-LK"),
        p.bankAccountInfo,
        p.amount,
        p.status,
      );
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=earnings_history_${Date.now()}.csv`,
    );
    // BOM so Excel reads UTF-8 correctly.
    return res.status(200).send(`\uFEFF${csv}`);
  } catch (error) {
    console.error("[Export CSV Error]:", error);
    return res.status(500).json({ message: error.message, error: error.message });
  }
};