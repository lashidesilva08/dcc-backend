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
        status: listing.status || 'active',
        isAvailable:
          listing.status === 'active' && (listing.type === 'SERVICE' || totalStock > 0),
        image: mainImage ? [mainImage] : [],
        description: listing.description,
        type: listing.type,
        // Map variants for frontend rendering
        allVariants: listing.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          price: v.price,
          stock: v.stock,
          attributes: v.attributes,
          images: v.images?.map((img) => img.url) || [],
        })),
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

    const listing = await prisma.listing.findUnique({
      where: { id: Number(id) },
      include: {
        category: true,
        variants: {
          include: {
            images: true,
          },
        },
      },
    });

    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    return res.status(200).json({
      success: true,
      data: listing,
    });
  } catch (error) {
    console.error("Error fetching listing:", error);
    return res.status(500).json({ success: false, message: error.message });
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

// UPDATE PRODUCT
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const listingId = Number(id);

    const {
      categoryId,
      title,
      description,
      type,
      status,
      price,
      stock,
      images = [],
      variants = [],
      discount,
    } = req.body;

    // Verify listing exists
    const existingListing = await prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!existingListing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    // Execute update in transaction
    const updatedListing = await prisma.$transaction(async (tx) => {
      // 1. Update core Listing table
      const listing = await tx.listing.update({
        where: { id: listingId },
        data: {
          categoryId: Number(categoryId),
          title: title.trim(),
          description: description || "",
          type: type || "PRODUCT",
          status: status || "active",
          discountPrice: discount?.price ? Number(discount.price) : null,
          discountStart: discount?.startDate ? new Date(discount.startDate) : null,
          discountEnd: discount?.endDate ? new Date(discount.endDate) : null,
        },
      });

      // 2. Wipe old variants & images to cleanly replace with updated list
      await tx.productImage.deleteMany({
        where: { variant: { listingId } },
      });
      await tx.productVariant.deleteMany({
        where: { listingId },
      });

      // 3. Re-create main variant & sub-variants
      const mainVariant = await tx.productVariant.create({
        data: {
          listingId: listing.id,
          sku: `PRD-${listing.id}-MAIN`,
          price: Number(price),
          stock: type === "SERVICE" ? 0 : Number(stock),
        },
      });

      // Attach images to main variant
      if (images.length > 0) {
        await tx.productImage.createMany({
          data: images.map((url, idx) => ({
            variantId: mainVariant.id,
            url,
            isMain: idx === 0,
          })),
        });
      }

      // Re-create additional custom variants
      if (variants.length > 0 && type === "PRODUCT") {
        for (let i = 0; i < variants.length; i++) {
          const v = variants[i];
          const createdVariant = await tx.productVariant.create({
            data: {
              listingId: listing.id,
              sku: `PRD-${listing.id}-VAR-${i + 1}`,
              price: Number(v.price || price),
              stock: Number(v.stock || 0),
              attributes: v.attributes || {},
            },
          });

          if (images.length > 0) {
            await tx.productImage.createMany({
              data: images.map((url, idx) => ({
                variantId: createdVariant.id,
                url,
                isMain: idx === 0,
              })),
            });
          }
        }
      }

      return listing;
    });

    return res.status(200).json({
      success: true,
      message: "Listing updated successfully",
      data: updatedListing,
    });
  } catch (error) {
    console.error("Error updating listing:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE PRODUCT
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const listingId = Number(id);

    const existingListing = await prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!existingListing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    // Soft delete by updating status to disabled
    await prisma.listing.update({
      where: { id: listingId },
      data: { status: "disabled" },
    });

    return res.status(200).json({
      success: true,
      message: "Listing deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting listing:", error);
    return res.status(500).json({ success: false, message: error.message });
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