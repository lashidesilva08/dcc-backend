import prisma from '../config/prisma.js'

// ============================================================
// GET ALL PRODUCTS
// GET /api/v1/products
// ============================================================
export const getAllProducts = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice } = req.query;

    const where = {
      status: 'active',
      ...(search
        ? {
            OR: [
              {
                title: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
      ...(category
        ? {
            category: {
              name: {
                equals: category,
                mode: 'insensitive',
              },
            },
          }
        : {}),
      variants: {
        some: {
          status: 'active',
          ...(minPrice || maxPrice
            ? {
                price: {
                  ...(minPrice ? { gte: Number(minPrice) } : {}),
                  ...(maxPrice ? { lte: Number(maxPrice) } : {}),
                },
              }
            : {}),
        },
      },
    };

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
        variants: {
          where: {
            status: 'active',
          },
          include: {
            images: true,
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const data = listings.map((listing) => {
      const variants = listing.variants || [];
      const primaryVariant = variants.find((v) => v.stock > 0) || variants[0];

      const ratings = listing.reviews.map((review) => review.rating);

      const rating =
        ratings.length > 0
          ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
          : 4.5;

      let image = null;

      if (primaryVariant?.images?.length) {
        const mainImage = primaryVariant.images.find((img) => img.isMain);
        image = mainImage?.url || primaryVariant.images[0]?.url || null;
      }

      return {
        id: listing.id,
        title: listing.title,
        description: listing.description,
        price: Number(primaryVariant?.price || 0),
        stock: variants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0),
        image,
        rating: Number(rating.toFixed(1)),
        reviewCount: ratings.length,
        status: listing.status,
        sold: listing.sold,
        category: listing.category,
        seller: listing.seller,
        variants,
        reviews: listing.reviews,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Products fetched successfully',
      data,
    });
  } catch (error) {
    console.error('Get all products error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message,
    });
  }
};

export const getProducts = async (req, res) => {
  try {
const rawSellerId = req.query.sellerId;
let whereClause = {};
if (rawSellerId) {
      const inputId = Number(rawSellerId);

      // 1. Look up the Seller profile associated with either the User ID (11) OR Seller ID (10)
      const sellerProfile = await prisma.seller.findFirst({
        where: {
          OR: [
            { userId: inputId }, // Matches User ID = 11
            { id: inputId },     // Matches Seller ID = 10
          ],
        },
      });

      // If a seller profile exists, filter strictly by its ID (10)
      if (sellerProfile) {
        whereClause.sellerId = sellerProfile.id;
      } else {
        // If no seller profile is found for ID 11, return empty results immediately
        return res.status(200).json({
          success: true,
          data: [],
        });
      }
    }  

// 2. Fetch listings strictly filtered by the resolved sellerId
    const listings = await prisma.listing.findMany({
      where: whereClause,
      include: {
        variants: {
          include: {
            images: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Format Prisma schema fields to fit frontend expectations
    const formattedProducts = listings.map((listing) => {
      const mainVariant = listing.variants[0] || {};
      const totalStock = listing.variants.reduce((acc, v) => acc + (v.stock || 0), 0);
      const mainImage = mainVariant.images?.find((img) => img.isMain)?.url || mainVariant.images?.[0]?.url || "";

      return {
        _id: String(listing.id),
        productId: mainVariant.sku || `PRD-${listing.id}`,
        name: listing.title,
        price: mainVariant.price || 0,
        labelPrice: listing.discountPrice || mainVariant.price || 0,
        stock: listing.type === "SERVICE" ? 999 : totalStock,
        isAvailable: listing.status === "active" && (listing.type === "SERVICE" || totalStock > 0),
        image: mainImage ? [mainImage] : [],
        description: listing.description,
        type: listing.type,
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedProducts,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET LOGGED-IN SELLER'S OWN LISTINGS
// GET /api/v1/products/my-listings   (protected)
// The sellerId is resolved from the auth token, never from the client.
// ============================================================
export const getMyListings = async (req, res) => {
  try {
    // `protect` attaches the authenticated user. Support both shapes.
    const authUserId = Number(req.user?.id ?? req.user?.userId);

    if (!Number.isInteger(authUserId) || authUserId <= 0) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized.',
        data: [],
      });
    }

    // Resolve the Seller profile that belongs to this user (User.id -> Seller.userId)
    const sellerProfile =
      req.user?.seller?.id
        ? { id: Number(req.user.seller.id) }
        : await prisma.seller.findUnique({
            where: { userId: authUserId },
            select: { id: true },
          });

    if (!sellerProfile) {
      return res.status(403).json({
        success: false,
        message: 'No seller profile found for this account.',
        data: [],
      });
    }

    // Strictly scoped to the logged-in seller
    const listings = await prisma.listing.findMany({
      where: {
        sellerId: sellerProfile.id,
        status: {
          not: 'disabled',
        },
      },
      include: {
        variants: {
          include: {
            images: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Same shape the seller dashboard already expects
    const formattedProducts = listings.map((listing) => {
      const mainVariant = listing.variants[0] || {};
      const totalStock = listing.variants.reduce((acc, v) => acc + (v.stock || 0), 0);
      const mainImage =
        mainVariant.images?.find((img) => img.isMain)?.url ||
        mainVariant.images?.[0]?.url ||
        '';

      return {
        _id: String(listing.id),
        productId: mainVariant.sku || `PRD-${listing.id}`,
        name: listing.title,
        price: mainVariant.price || 0,
        labelPrice: listing.discountPrice || mainVariant.price || 0,
        stock: listing.type === 'SERVICE' ? 999 : totalStock,
        isAvailable:
          listing.status === 'active' && (listing.type === 'SERVICE' || totalStock > 0),
        image: mainImage ? [mainImage] : [],
        description: listing.description,
        type: listing.type,
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedProducts,
    });
  } catch (error) {
    console.error('Error fetching seller listings:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// GET CATEGORIES
// GET /api/v1/products/categories
// ============================================================
export const getCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: {
        status: 'active',
      },
      orderBy: {
        name: 'asc',
      },
    });

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Get categories error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message,
    });
  }
};

// ============================================================
// GET PRODUCT BY ID
// GET /api/v1/products/:id
// ============================================================
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const productId = Number(id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID. Backend product IDs must be numeric.',
      });
    }

    const product = await prisma.listing.findFirst({
      where: {
        id: productId,
        status: 'active',
      },
      include: {
        variants: {
          where: {
            status: 'active',
          },
          include: {
            images: true,
          },
        },
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
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
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID ${id} not found.`,
      });
    }

    const ratings = product.reviews.map((review) => review.rating);

    const averageRating =
      ratings.length > 0
        ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
        : 4.5;

    return res.status(200).json({
      success: true,
      message: 'Product details retrieved successfully',
      data: {
        ...product,
        rating: Number(averageRating.toFixed(1)),
        reviewCount: ratings.length,
      },
    });
  } catch (error) {
    console.error('Error fetching product details:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve product details',
      error: error.message,
    });
  }
};

// ============================================================
// CREATE PRODUCT
// ============================================================
export const createProduct = async (req, res) => {
  try {
    const {
      sellerId,
      categoryId,
      title,
      description,
      type = "PRODUCT",
      price,
      stock,
      images = [],
      variants = [],
      discount,
    } = req.body;

    // Validation
    if (!sellerId || !categoryId || !title || !price) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    if (!images || images.length === 0) {
      return res.status(400).json({ message: "At least one image is required." });
    }

    // Process listing creation inside a transaction
    const newListing = await prisma.$transaction(async (tx) => {
      // 1. Create the main Listing record
      const listing = await tx.listing.create({
        data: {
          sellerId: Number(sellerId),
          categoryId: Number(categoryId),
          title: title.trim(),
          description: description || "",
          type: type, // "PRODUCT" or "SERVICE"
          discountPrice: discount?.price ? Number(discount.price) : null,
          discountStart: discount?.startDate ? new Date(discount.startDate) : null,
          discountEnd: discount?.endDate ? new Date(discount.endDate) : null,
        },
      });

      // 2. Prepare Variant data
      let variantList = [];

      if (type === "PRODUCT" && variants.length > 0) {
        // If specific variants were added by the seller
        variantList = variants.map((v, idx) => ({
          sku: `${title.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)}-${Date.now()}-${idx}`,
          price: Number(v.price) || Number(price),
          stock: Number(v.stock) || 0,
          attributes: v.attributes || {},
        }));
      } else {
        // Default variant for standard product or service
        variantList.push({
          sku: `${title.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)}-${Date.now()}`,
          price: Number(price),
          stock: type === "SERVICE" ? 0 : Number(stock) || 0,
          attributes: {},
        });
      }

      // 3. Create Variants and associate Image URLs
      for (let i = 0; i < variantList.length; i++) {
        const variantData = variantList[i];

        // Attach images to the primary/first variant
        const imageCreateData =
          i === 0
            ? images.map((url, idx) => ({
                url: url,
                isMain: idx === 0,
              }))
            : [];

        await tx.productVariant.create({
          data: {
            listingId: listing.id,
            sku: variantData.sku,
            price: variantData.price,
            stock: variantData.stock,
            attributes: variantData.attributes,
            images: {
              create: imageCreateData,
            },
          },
        });
      }

      // Increment seller product count
      await tx.seller.update({
        where: { id: Number(sellerId) },
        data: { productCount: { increment: 1 } },
      });

      return listing;
    });

    return res.status(201).json({
      success: true,
      message: "Listing created successfully!",
      data: newListing,
    });
  } catch (error) {
    console.error("Error creating product:", error);
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

// ============================================================
// UPDATE PRODUCT
// ============================================================
export const updateProduct = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID.',
      });
    }

    const {
      title,
      description,
      categoryId,
      status,
    } = req.body;

    const listing = await prisma.listing.update({
      where: {
        id,
      },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(categoryId !== undefined ? { categoryId: Number(categoryId) } : {}),
        ...(status !== undefined ? { status } : {}),
      },
      include: {
        variants: {
          include: {
            images: true,
          },
        },
        category: true,
        seller: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: listing,
    });
  } catch (error) {
    console.error('Update product error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: error.message,
    });
  }
};

// ============================================================
// DELETE PRODUCT
// ============================================================
export const deleteProduct = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID.',
      });
    }

    await prisma.listing.update({
      where: {
        id,
      },
      data: {
        status: 'disabled',
      },
    });

    return res.status(200).json({
      success: true,
      message: `Product ${id} disabled successfully`,
    });
  } catch (error) {
    console.error('Delete product error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message,
    });
  }
};

// ============================================================
// GET REVIEWS
// ============================================================
export const getProductReviews = async (req, res) => {
  try {
    const productId = Number(req.params.productId);

    const reviews = await prisma.review.findMany({
      where: {
        listingId: productId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json({
      success: true,
      reviews,
    });
  } catch (error) {
    console.error('Get reviews error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
    });
  }
};

// ============================================================
// SUBMIT REVIEW
// ============================================================
export const submitReview = async (req, res) => {
  try {
    const { productId, rating, comment, userId } = req.body;

    if (!productId || !rating || !userId) {
      return res.status(400).json({
        success: false,
        message: 'productId, rating and userId are required.',
      });
    }

    const review = await prisma.review.create({
      data: {
        listingId: Number(productId),
        rating: Number(rating),
        comment: comment || null,
        userId: Number(userId),
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review,
    });
  } catch (error) {
    console.error('Submit review error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to submit review',
      error: error.message,
    });
  }
};