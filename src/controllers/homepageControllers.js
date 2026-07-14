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



export const updateHeroBanner = async (req, res) => {
    try {
        res.status(200).json({ message: "Homepage marketing assets updated." });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};




/*
export const getActiveFlashSale = async (req, res) => {
  try {
    const flashSale = await prisma.flashSale.findFirst({
      where: {
        status: "active",
      },
      include: {
        items: {
          include: {
            productVariant: { 
              include: {
                images: true,
                listing: true 
              }
            }
          }
        }
      }
    });

    if (!flashSale) {
      return res.status(404).json({ 
        success: false,
        message: "No active flash sale found at the moment." 
      });
    }

    const formattedProducts = flashSale.items.map(item => {
      const variant = item.productVariant; 
      const listing = variant?.listing;
      
      const mainImage = variant?.images?.find(img => img.isMain === true) || variant?.images?.[0];
      const productImage = mainImage ? mainImage.url : "";

      const originalPrice = variant?.price || item.flashPrice;
      const discountPercentage = originalPrice > item.flashPrice
        ? `${Math.round(((originalPrice - item.flashPrice) / originalPrice) * 100)}% OFF`
        : "SALE";

      return {
        id: item.id,
        variantId: item.variantId,
        title: listing?.title || "Unknown Product",
        image: productImage,
        flashPrice: item.flashPrice,
        originalPrice: originalPrice,
        discountPercentage: discountPercentage,
        stockRemaining: item.flashStock,
        soldCount: item.soldCount
      };
    });

    return res.status(200).json({
      success: true,
      message: "Active flash sale retrieved successfully.",
      flashSale: {
        id: flashSale.id,
        title: flashSale.title,
        endTime: flashSale.endTime,
        products: formattedProducts 
      }
    });

  } catch (error) {
    console.error("Error fetching active flash sale:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Internal Server Error" 
    });
  }
};
*/





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
            icon: cat.icon || "LayoutGrid", // default icon එකක්
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