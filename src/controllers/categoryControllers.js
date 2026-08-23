import { prisma } from '../config/prisma.js';
import redisClient from '../config/redis.js';

// Cache TTLs (seconds)
const TTL_ALL_CATEGORIES = 5 * 60;    // 5 minutes  – changes rarely
const TTL_CATEGORY_SLUG  = 2 * 60;    // 2 minutes  – listings change more often

// Cache keys
const CACHE_KEY_ALL = 'categories:all';
const slugCacheKey = (slug, query) => {
  // Unique key per slug + filter combination
  const { sort = 'newest', page = 1, limit = 12, minPrice = '', maxPrice = '', minRating = '' } = query;
  return `categories:${slug}:${sort}:p${page}:l${limit}:min${minPrice}:max${maxPrice}:r${minRating}`;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Try to get a JSON value from Redis. Returns null on miss or error. */
async function cacheGet(key) {
  try {
    const raw = await redisClient.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // Redis failure must never break the API
  }
}

/** Store a JSON value in Redis with a TTL. Silently ignores errors. */
async function cacheSet(key, value, ttl) {
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
  } catch {
    // Redis failure must never break the API
  }
}

/** Invalidate all category cache keys (called on create/update/delete). */
async function cacheClearCategories() {
  try {
    // Delete the "all categories" key
    await redisClient.del(CACHE_KEY_ALL);
    // Scan and delete all per-slug keys
    let cursor = 0;
    do {
      const reply = await redisClient.scan(cursor, { MATCH: 'categories:*', COUNT: 100 });
      cursor = reply.cursor;
      if (reply.keys.length) await redisClient.del(reply.keys);
    } while (cursor !== 0);
  } catch {
    // Redis failure must never break the API
  }
}

// Helper: convert category name → URL slug
function nameToSlug(name) {
  return name
    .toLowerCase()
    .replace(/[&]/g, 'and')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── GET /api/v1/categories ──────────────────────────────────────────────────
export const getAllCategories = async (req, res) => {
  try {
    // 1. Check cache
    const cached = await cacheGet(CACHE_KEY_ALL);
    if (cached) {
      return res.status(200).json({ success: true, data: cached, source: 'cache' });
    }

    // 2. Cache miss → query DB
    const categories = await prisma.category.findMany({
      where: { status: 'active' },
      include: {
        _count: { select: { listings: { where: { status: 'active' } } } },
      },
      orderBy: { name: 'asc' },
    });

    const data = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      slug: nameToSlug(cat.name),
      listingCount: cat._count.listings,
      createdAt: cat.createdAt,
    }));

    // 3. Store in Redis
    await cacheSet(CACHE_KEY_ALL, data, TTL_ALL_CATEGORIES);

    res.status(200).json({ success: true, data, source: 'db' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /api/v1/categories/:slug ────────────────────────────────────────────
export const getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const {
      minPrice,
      maxPrice,
      minRating,
      sort = 'newest',
      page = 1,
      limit = 12,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 12);

    // ==========================================================
    // ALL CATEGORIES
    // ==========================================================
    let category = null;

    if (slug !== 'all') {
      const allCategories = await prisma.category.findMany({
        where: {
          status: 'active',
        },
      });

      category = allCategories.find(
        (item) => nameToSlug(item.name) === slug.toLowerCase()
      );

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found',
        });
      }
    }

    // ==========================================================
    // BUILD WHERE
    // ==========================================================
    const where = {
      status: 'active',
      ...(category
        ? {
            categoryId: category.id,
          }
        : {}),
    };

    if (minPrice || maxPrice) {
      where.variants = {
        some: {
          status: 'active',
          price: {
            ...(minPrice ? { gte: Number(minPrice) } : {}),
            ...(maxPrice ? { lte: Number(maxPrice) } : {}),
          },
        },
      };
    }

    // ==========================================================
    // FETCH PRODUCTS
    // ==========================================================
    const listings = await prisma.listing.findMany({
      where,
      include: {
        category: true,

        seller: {
          select: {
            id: true,
            shopName: true,
            shopUrl: true,
            image: true,
            rating: true,
            reviewCount: true,
          },
        },

        reviews: {
          select: {
            rating: true,
          },
        },

        variants: {
          where: {
            status: 'active',
          },
          include: {
            images: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    // ==========================================================
    // NORMALIZE PRODUCTS
    // ==========================================================
    let data = listings.map((listing) => {
      const variants = listing.variants || [];

      const primaryVariant =
        variants.find((variant) => Number(variant.stock) > 0) ||
        variants[0] ||
        null;

      const ratings = listing.reviews.map(
        (review) => Number(review.rating) || 0
      );

      const averageRating =
        ratings.length > 0
          ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
          : 4.5;

      let image = null;

      if (primaryVariant?.images?.length) {
        const mainImage = primaryVariant.images.find(
          (item) => item.isMain
        );

        image =
          mainImage?.url ||
          primaryVariant.images[0]?.url ||
          null;
      }

      return {
        id: listing.id,
        title: listing.title,
        description: listing.description,
        price: Number(primaryVariant?.price || 0),
        stock: variants.reduce(
          (sum, variant) => sum + Number(variant.stock || 0),
          0
        ),
        image,
        rating: Number(averageRating.toFixed(1)),
        reviewCount: ratings.length,
        sold: listing.sold || 0,
        status: listing.status,
        category: listing.category,
        seller: listing.seller,
        variants,
        createdAt: listing.createdAt,
      };
    });

    // ==========================================================
    // RATING FILTER
    // ==========================================================
    if (minRating) {
      data = data.filter(
        (product) => product.rating >= Number(minRating)
      );
    }

    // ==========================================================
    // SORT
    // ==========================================================
    if (sort === 'price-low') {
      data.sort((a, b) => a.price - b.price);
    } else if (sort === 'price-high') {
      data.sort((a, b) => b.price - a.price);
    } else if (sort === 'rating') {
      data.sort((a, b) => b.rating - a.rating);
    } else {
      data.sort(
        (a, b) =>
          new Date(b.createdAt) - new Date(a.createdAt)
      );
    }

    // ==========================================================
    // PAGINATION
    // ==========================================================
    const totalListings = data.length;
    const totalPages =
      totalListings === 0
        ? 1
        : Math.ceil(totalListings / limitNum);

    const skip = (pageNum - 1) * limitNum;

    const paginatedListings = data.slice(
      skip,
      skip + limitNum
    );

    // ==========================================================
    // RESPONSE
    // ==========================================================
    const result = {
      category: category
        ? {
            id: category.id,
            name: category.name,
            icon: category.icon,
            slug: nameToSlug(category.name),
          }
        : {
            id: null,
            name: 'All Categories',
            icon: null,
            slug: 'all',
          },

      listings: paginatedListings,

      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalListings,
        totalPages,
      },
    };

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get category error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load category',
      error: error.message,
    });
  }
};

// ── POST /api/v1/categories  (Admin only) ───────────────────────────────────
export const createCategory = async (req, res) => {
  try {
    const { name, icon } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

    const category = await prisma.category.create({
      data: { name, icon: icon ?? null, status: 'active' },
    });

    await cacheClearCategories();  // invalidate all category caches
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// ── PUT /api/v1/categories/:id  (Admin only) ────────────────────────────────
export const updateCategory = async (req, res) => {
  try {
    const { id }           = req.params;
    const { name, icon, status } = req.body;

    const category = await prisma.category.update({
      where: { id: parseInt(id, 10) },
      data: {
        ...(name   && { name }),
        ...(icon !== undefined && { icon }),
        ...(status && { status }),
      },
    });

    await cacheClearCategories();  // invalidate all category caches
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// ── DELETE /api/v1/categories/:id  (Admin only) ─────────────────────────────
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.category.update({
      where: { id: parseInt(id, 10) },
      data:  { status: 'disabled' },
    });

    await cacheClearCategories();  // invalidate all category caches
    res.status(200).json({ success: true, message: 'Category disabled successfully.' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};