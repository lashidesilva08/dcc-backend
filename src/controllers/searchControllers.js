import { prisma } from "../config/prisma.js";
import redisClient from "../config/redis.js";

/*  AUTOCOMPLETE SUGGESTIONS*/
export const getSearchSuggestions = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(200).json({ suggestions: [] });
    }

    const cacheKey = `suggestions:${q.toLowerCase()}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    const listings = await prisma.listing.findMany({
      where: {
        status: "active",
        title: {
          contains: q,
          mode: "insensitive",
        },
      },
      select: {
        title: true,
      },
      take: 5,
    });

    const categories = await prisma.category.findMany({
      where: {
        name: {
          contains: q,
          mode: "insensitive",
        },
      },
      select: {
        name: true,
      },
      take: 3,
    });

    const sellers = await prisma.seller.findMany({
      where: {
        shopName: {
          contains: q,
          mode: "insensitive",
        },
      },
      select: {
        shopName: true,
      },
      take: 3,
    });

    const response = {
      suggestions: [
        ...listings.map((l) => l.title),
        ...categories.map((c) => c.name),
        ...sellers.map((s) => s.shopName),
      ],
    };

    await redisClient.setEx(cacheKey, 300, JSON.stringify(response));

    return res.status(200).json(response);
  } catch (error) {
    console.error("Suggestion error:", error);
    return res.status(500).json({ error: "Error fetching suggestions" });
  }
};

/*TRENDING (BASIC STATIC LOGIC)*/
export const getTrending = async (req, res) => {
  try {
    const cacheKey = "trending:listings";

    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    const trending = await prisma.listing.findMany({
      where: {
        status: "active",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        title: true,
      },
      take: 10,
    });

    const response = {
      trending: trending.map((t) => t.title),
    };

    await redisClient.setEx(cacheKey, 600, JSON.stringify(response));

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ error: "Error fetching trending data" });
  }
};

/* MAIN SEARCH PRODUCTS*/
export const searchProducts = async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice, sort } = req.query;

    const cacheKey = `search:${JSON.stringify(req.query)}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    const where = {
      status: "active",
    };

    /* ---------- SEARCH KEYWORD ---------- */
    if (q) {
      where.OR = [
        {
          title: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: q,
            mode: "insensitive",
          },
        },
      ];
    }

    /* ---------- CATEGORY FILTER ---------- */
    if (category) {
      where.category = {
        name: {
          equals: category,
          mode: "insensitive",
        },
      };
    }

    /* ---------- PRICE FILTER ---------- */
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = Number(minPrice);
      if (maxPrice) where.price.lte = Number(maxPrice);
    }

    /* ---------- SORT ---------- */
    let orderBy = { createdAt: "desc" };

    switch (sort) {
      case "price_asc":
        orderBy = { price: "asc" };
        break;
      case "price_desc":
        orderBy = { price: "desc" };
        break;
      case "newest":
        orderBy = { createdAt: "desc" };
        break;
    }

    const listings = await prisma.listing.findMany({
      where,
      orderBy,
      include: {
        category: true,
        seller: true,
        variants: {
          include: {
            images: true,
          },
        },
      },
    });

    const response = {
      message: "Search results retrieved successfully",
      count: listings.length,
      results: listings,
    };

    await redisClient.setEx(cacheKey, 300, JSON.stringify(response));

    return res.status(200).json(response);
  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json({ error: "Error processing search request" });
  }
};

/*GET ALL CATEGORIES*/
export const getAllCategories = async (req, res) => {
  try {
    const cacheKey = "categories:all";

    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    const categories = await prisma.category.findMany({
      where: {
        status: "active",
      },
    });

    const response = {
      categories,
    };

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(response));

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ error: "Error fetching categories" });
  }
};

/* PRODUCTS BY CATEGORY*/
export const getProductsByCategory = async (req, res) => {
  try {
    const { slug } = req.params;

    const cacheKey = `category:${slug}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    const listings = await prisma.listing.findMany({
      where: {
        status: "active",
        category: {
          name: {
            equals: slug,
            mode: "insensitive",
          },
        },
      },
      include: {
        seller: true,
        variants: {
          include: {
            images: true,
          },
        },
      },
    });

    const response = {
      category: slug,
      results: listings,
    };

    await redisClient.setEx(cacheKey, 300, JSON.stringify(response));

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ error: "Error fetching category products" });
  }
};
