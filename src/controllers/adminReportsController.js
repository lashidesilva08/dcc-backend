
import { Prisma } from '@prisma/client'
import prisma from '../config/prisma.js'
import redisClient from '../config/redis.js'

const CACHE_TTL = 60
const CACHE_PREFIX = 'dcc:admin:reports'

/* --------------------------------------------------
   DATE FILTERS
-------------------------------------------------- */

function getDateRange(query = {}) {
  const now = new Date()

  const defaultFrom = new Date(now)
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29)

  const dateFrom = query.dateFrom
    ? new Date(`${query.dateFrom}T00:00:00.000Z`)
    : defaultFrom

  const dateTo = query.dateTo
    ? new Date(`${query.dateTo}T23:59:59.999Z`)
    : now

  if (
    Number.isNaN(dateFrom.getTime()) ||
    Number.isNaN(dateTo.getTime())
  ) {
    throw new Error('Invalid report date.')
  }

  if (dateFrom > dateTo) {
    throw new Error('Start date cannot be after end date.')
  }

  if (dateTo > now) {
    throw new Error('End date cannot be in the future.')
  }

  return { dateFrom, dateTo }
}

/* --------------------------------------------------
   REDIS CACHE
-------------------------------------------------- */

async function getCachedReport(key, callback) {
  const cacheKey = `${CACHE_PREFIX}:${key}`

  try {
    if (redisClient.isReady) {
      const cached = await redisClient.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }
    }
  } catch (error) {
    console.error('Reports Redis read error:', error.message)
  }

  const data = await callback()

  try {
    if (redisClient.isReady) {
      await redisClient.set(
        cacheKey,
        JSON.stringify(data),
        { EX: CACHE_TTL }
      )
    }
  } catch (error) {
    console.error('Reports Redis write error:', error.message)
  }

  return data
}

/* --------------------------------------------------
   POSTGRESQL SALES AGGREGATION
-------------------------------------------------- */

async function getSalesAggregation(dateFrom, dateTo, period) {
  const allowedPeriods = {
    daily: 'day',
    weekly: 'week',
    monthly: 'month',
  }

  const unit = allowedPeriods[period]

  if (!unit) {
    throw new Error('Invalid sales aggregation period.')
  }

  const bucket = Prisma.raw(
    `DATE_TRUNC('${unit}', o."createdAt")`
  )

  const rows = await prisma.$queryRaw`
    SELECT
      TO_CHAR(${bucket}, 'YYYY-MM-DD') AS "period",
      COUNT(o."id")::int AS "orders",
      COALESCE(SUM(o."totalAmount"), 0)::float AS "revenue"
    FROM "Order" o
    WHERE
      LOWER(o."paymentStatus") = 'paid'
      AND o."createdAt" >= ${dateFrom}
      AND o."createdAt" <= ${dateTo}
    GROUP BY ${bucket}
    ORDER BY ${bucket} ASC
  `

  return rows.map((row) => ({
    period: row.period,
    orders: Number(row.orders),
    revenue: Number(row.revenue),
  }))
}

/* --------------------------------------------------
   REPORT SUMMARY
-------------------------------------------------- */

async function getSalesSummary(dateFrom, dateTo) {
  const rows = await prisma.$queryRaw`
    SELECT
      COUNT(o."id")::int AS "totalOrders",
      COALESCE(SUM(o."totalAmount"), 0)::float AS "totalRevenue",
      COALESCE(AVG(o."totalAmount"), 0)::float AS "averageOrderValue"
    FROM "Order" o
    WHERE
      LOWER(o."paymentStatus") = 'paid'
      AND o."createdAt" >= ${dateFrom}
      AND o."createdAt" <= ${dateTo}
  `

  const summary = rows[0] || {}

  return {
    totalOrders: Number(summary.totalOrders || 0),
    totalRevenue: Number(summary.totalRevenue || 0),
    averageOrderValue: Number(summary.averageOrderValue || 0),
  }
}

/* --------------------------------------------------
   TOP-SELLING PRODUCTS
-------------------------------------------------- */

async function queryTopProducts(dateFrom, dateTo, limit = 5) {
  const rows = await prisma.$queryRaw`
    SELECT
      l."id" AS "productId",
      l."title" AS "productName",
      s."shopName" AS "sellerName",
      COUNT(DISTINCT o."id")::int AS "orders",
      SUM(oi."quantity")::int AS "unitsSold",
      COALESCE(SUM(oi."subtotal"), 0)::float AS "revenue"
    FROM "OrderItem" oi
    INNER JOIN "Order" o
      ON o."id" = oi."orderId"
    INNER JOIN "ProductVariant" pv
      ON pv."id" = oi."variantId"
    INNER JOIN "Listing" l
      ON l."id" = pv."listingId"
    INNER JOIN "Seller" s
      ON s."id" = oi."sellerId"
    WHERE
      LOWER(o."paymentStatus") = 'paid'
      AND o."createdAt" >= ${dateFrom}
      AND o."createdAt" <= ${dateTo}
    GROUP BY
      l."id",
      l."title",
      s."shopName"
    ORDER BY "unitsSold" DESC, "revenue" DESC
    LIMIT ${limit}
  `

  return rows.map((row) => ({
    productId: Number(row.productId),
    productName: row.productName,
    sellerName: row.sellerName,
    orders: Number(row.orders),
    unitsSold: Number(row.unitsSold),
    revenue: Number(row.revenue),
  }))
}

/* --------------------------------------------------
   TOP-PERFORMING SELLERS
-------------------------------------------------- */

async function queryTopSellers(dateFrom, dateTo, limit = 5) {
  const rows = await prisma.$queryRaw`
    SELECT
      s."id" AS "sellerId",
      s."shopName" AS "sellerName",
      COUNT(DISTINCT o."id")::int AS "orders",
      SUM(oi."quantity")::int AS "unitsSold",
      COALESCE(SUM(oi."subtotal"), 0)::float AS "revenue"
    FROM "OrderItem" oi
    INNER JOIN "Order" o
      ON o."id" = oi."orderId"
    INNER JOIN "Seller" s
      ON s."id" = oi."sellerId"
    WHERE
      LOWER(o."paymentStatus") = 'paid'
      AND o."createdAt" >= ${dateFrom}
      AND o."createdAt" <= ${dateTo}
    GROUP BY
      s."id",
      s."shopName"
    ORDER BY "revenue" DESC, "unitsSold" DESC
    LIMIT ${limit}
  `

  return rows.map((row) => ({
    sellerId: Number(row.sellerId),
    sellerName: row.sellerName,
    orders: Number(row.orders),
    unitsSold: Number(row.unitsSold),
    revenue: Number(row.revenue),
  }))
}

/* --------------------------------------------------
   COMPLETE ANALYTICS DASHBOARD
-------------------------------------------------- */

export const getReportsAnalytics = async (req, res) => {
  try {
    const { dateFrom, dateTo } = getDateRange(req.query)

    const cacheKey =
      `analytics:${dateFrom.toISOString()}:${dateTo.toISOString()}`

    const report = await getCachedReport(cacheKey, async () => {
      const [
        summary,
        daily,
        weekly,
        monthly,
        topProducts,
        topSellers,
      ] = await Promise.all([
        getSalesSummary(dateFrom, dateTo),
        getSalesAggregation(dateFrom, dateTo, 'daily'),
        getSalesAggregation(dateFrom, dateTo, 'weekly'),
        getSalesAggregation(dateFrom, dateTo, 'monthly'),
        queryTopProducts(dateFrom, dateTo, 5),
        queryTopSellers(dateFrom, dateTo, 5),
      ])

      return {
        summary,
        sales: {
          daily,
          weekly,
          monthly,
        },
        topProducts,
        topSellers,
      }
    })

    return res.status(200).json({
      success: true,
      filters: {
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
      },
      data: report,
    })
  } catch (error) {
    console.error('Reports analytics error:', error)

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load reports.',
    })
  }
}

/* --------------------------------------------------
   TOP PRODUCTS ENDPOINT
-------------------------------------------------- */

export const getTopProducts = async (req, res) => {
  try {
    const { dateFrom, dateTo } = getDateRange(req.query)

    const report = await getCachedReport(
      `products:${dateFrom.toISOString()}:${dateTo.toISOString()}`,
      () => queryTopProducts(dateFrom, dateTo, 10)
    )

    return res.status(200).json({
      success: true,
      data: report,
    })
  } catch (error) {
    console.error('Top products report error:', error)

    return res.status(500).json({
      success: false,
      message: 'Failed to load top-selling products.',
    })
  }
}

/* --------------------------------------------------
   TOP SELLERS ENDPOINT
-------------------------------------------------- */

export const getTopSellers = async (req, res) => {
  try {
    const { dateFrom, dateTo } = getDateRange(req.query)

    const report = await getCachedReport(
      `sellers:${dateFrom.toISOString()}:${dateTo.toISOString()}`,
      () => queryTopSellers(dateFrom, dateTo, 10)
    )

    return res.status(200).json({
      success: true,
      data: report,
    })
  } catch (error) {
    console.error('Top sellers report error:', error)

    return res.status(500).json({
      success: false,
      message: 'Failed to load top-performing sellers.',
    })
  }
}

/* --------------------------------------------------
   CSV EXPORT
-------------------------------------------------- */

function csvCell(value) {
  let text = String(value ?? '')

  // Prevent spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`
  }

  return `"${text.replace(/"/g, '""')}"`
}

export const exportReportsCSV = async (req, res) => {
  try {
    const { dateFrom, dateTo } = getDateRange(req.query)

    const cacheKey =
      `csv:${dateFrom.toISOString()}:${dateTo.toISOString()}`

    const csv = await getCachedReport(cacheKey, async () => {
      const orders = await prisma.order.findMany({
        where: {
          paymentStatus: {
            equals: 'paid',
            mode: 'insensitive',
          },
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10000,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
          orderItems: {
            include: {
              variant: {
                include: {
                  listing: {
                    select: {
                      title: true,
                    },
                  },
                },
              },
              seller: {
                select: {
                  shopName: true,
                },
              },
            },
          },
        },
      })

      const headers = [
        'Order Number',
        'Order Date',
        'Buyer Name',
        'Buyer Email',
        'Products',
        'Sellers',
        'Items Count',
        'Total Amount (LKR)',
        'Payment Status',
        'Order Status',
      ]

      const rows = orders.map((order) => {
        const products = order.orderItems
          .map((item) => item.variant.listing.title)
          .join('; ')

        const sellers = [
          ...new Set(
            order.orderItems.map((item) => item.seller.shopName)
          ),
        ].join('; ')

        const itemCount = order.orderItems.reduce(
          (sum, item) => sum + item.quantity,
          0
        )

        return [
          order.orderNumber,
          order.createdAt.toISOString(),
          order.user?.name,
          order.user?.email,
          products,
          sellers,
          itemCount,
          order.totalAmount,
          order.paymentStatus,
          order.orderStatus,
        ]
      })

      return [
        headers.map(csvCell).join(','),
        ...rows.map((row) => row.map(csvCell).join(',')),
      ].join('\r\n')
    })

    const filename =
      `DCC_Sales_Report_${new Date().toISOString().slice(0, 10)}.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    )

    return res.status(200).send(`\uFEFF${csv}`)
  } catch (error) {
    console.error('CSV export error:', error)

    return res.status(500).json({
      success: false,
      message: 'Failed to export sales report.',
    })
  }
}

/* --------------------------------------------------
   LEGACY SALES REPORT ENDPOINT
-------------------------------------------------- */

export const getSalesReport = getReportsAnalytics
