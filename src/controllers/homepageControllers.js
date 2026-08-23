import { prisma } from "../config/prisma.js";
export const getBanners = async (req, res) => {
    try {
        res.status(200).json({ 
            banners: ["https://example.com/promo1.jpg", "https://example.com/promo2.jpg"],
            message: "Active hero banners retrieved." 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


export const updateHeroBanner = async (req, res) => {
    try {
        res.status(200).json({ message: "Homepage marketing assets updated." });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};



//featured shops
export const getFeaturedShops = async (req, res) => {
    try {
        const featuredShops = await prisma.seller.findMany({
            where: { 
                status: "ACTIVE",
                featured: true 
            },
            select: {
                shopName: true,
                bannerImage: true, 
                rating: true,     
                _count: {
                    select: { listings: true } 
                }
            },
            orderBy: {
                rating: 'desc' 
            },
            take: 2 
        });

        res.status(200).json({ 
            featured: featuredShops,
            message: "Featured shops retrieved successfully from database." 
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
    
}; 


//flashsale
export const getActiveFlashSale = async (req, res) => {
  try {
    const now = new Date()
    const flashSale = await prisma.flashSale.findFirst({
      where: {
        status: "active",
        startTime: { lte: now },
        endTime: { gte: now },
      },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                images: true,
                listing: {
                  include: {
                    category: true,
                    seller: {
                      select: {
                        id: true,
                        shopName: true,
                        shopUrl: true,
                      },
                    },
                    reviews: {
                      select: { rating: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!flashSale) {
      return res.status(404).json({
        success: false,
        message: "No active flash sale found at the moment.",
      });
    }

    const formattedProducts = flashSale.items
      .map((item) => {
        const variant = item.productVariant;
        const listing = variant?.listing;
        if (!listing || listing.status !== "active" || variant?.status !== "active") {
          return null;
        }

        const mainImage =
          variant?.images?.find((img) => img.isMain === true) || variant?.images?.[0];
        const productImage = mainImage ? mainImage.url : "";

        const originalPrice = Number(variant?.price || item.flashPrice) || 0;
        const flashPrice = Number(item.flashPrice) || originalPrice;
        const discountPercent =
          originalPrice > flashPrice
            ? Math.round(((originalPrice - flashPrice) / originalPrice) * 100)
            : 0;

        const ratings = (listing.reviews || []).map((r) => Number(r.rating) || 0);
        const rating =
          ratings.length > 0
            ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
            : 4.5;

        const categoryName = listing.category?.name || "Marketplace";
        const categorySlug = categoryName.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "");

        return {
          id: listing.id,
          listingId: listing.id,
          productId: listing.id,
          variantId: item.variantId,
          title: listing.title || "Unknown Product",
          name: listing.title || "Unknown Product",
          brand: listing.seller?.shopName || categoryName,
          description: listing.description || "",
          image: productImage,
          images: productImage ? [productImage] : [],
          price: flashPrice,
          flashPrice,
          originalPrice,
          discountPercent,
          discountPercentage:
            discountPercent > 0 ? `${discountPercent}% OFF` : "SALE",
          stock: Number(item.flashStock ?? variant?.stock ?? 0),
          stockRemaining: Number(item.flashStock ?? variant?.stock ?? 0),
          soldCount: Number(item.soldCount || 0),
          rating: Number(rating.toFixed(1)),
          reviewCount: ratings.length,
          categorySlug,
          categoryLabel: categoryName,
          seller: listing.seller?.shopName || "Marketplace Seller",
          shopId: listing.seller?.shopUrl || listing.seller?.id || null,
        };
      })
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      message: "Active flash sale retrieved successfully.",
      flashSale: {
        id: flashSale.id,
        title: flashSale.title,
        endTime: flashSale.endTime,
        products: formattedProducts,
      },
    });
  } catch (error) {
    console.error("Error fetching active flash sale:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
};





// Active Categories and  listings 
export const getActiveCategories = async (req, res) => {
    try {
        const categories = await prisma.category.findMany({
            where: {
                status: "active" 
            },
            select: {
                id: true,
                name: true,
                icon: true,
                _count: {
                    select: { listings: true } 
                }
            },
            orderBy: {
                id: 'asc' 
            }
        });

        const formattedCategories = categories.map(cat => ({
            id: cat.id,
            label: cat.name,
            slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-'), 
            icon: cat.icon || "LayoutGrid", 
            count: `${cat._count.listings}+ Items` 
        }));

        return res.status(200).json({
            success: true,
            message: "Active categories retrieved successfully from database.",
            categories: formattedCategories
        });

    } catch (error) {
        console.error("Error fetching active categories:", error);
        return res.status(500).json({ 
            success: false, 
            error: error.message || "Internal Server Error" 
        });
    }
};