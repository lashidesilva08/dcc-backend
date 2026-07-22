import prisma from "../config/prisma.js";


export const createShop = async (req, res) => {

    res.status(201).json({ message: "Shop created successfully", shop: req.body });
};

export const getAllShops = async (req,res)=>{
    try{

        const userId = req.user?.id;

        const shops = await prisma.seller.findMany({
            include:{
                user:true,
                favouritedBy:userId ? {
                    where:{
                        userId
                    },
                    select:{
                        id:true
                    }
                } : false,
                _count:{
                    select:{
                        listings:true,
                        favouritedBy:true
                    }
                }
            },
            orderBy:{
                id:"asc"
            }
        });

        const data = shops.map(shop=>({

            ...shop,

            favouriteCount:shop._count.favouritedBy,

            isFavourite:userId
                ? shop.favouritedBy.length>0
                :false

        }));

        res.json({
            success:true,
            data
        });

    }catch(error){

        res.status(500).json({
            success:false,
            message:error.message
        });

    }
}

export const searchShops = async (req, res) => {
  try {
    const { q } = req.query;

    const userId = req.user?.id;

    const shops = await prisma.seller.findMany({
      where: {
        OR: [
          {
            shopName: {
              contains: q,
              mode: "insensitive",
            },
          },
          {
            businessType: {
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
        ],
      },

      include: {
        user: true,
        favouritedBy: userId
          ? {
              where: {
                userId,
              },
              select: {
                id: true,
              },
            }
          : false,

        _count: {
          select: {
            listings: true,
            favouritedBy: true,
          },
        },
      },
    });

    const data = shops.map((shop) => ({
      ...shop,
      favouriteCount: shop._count.favouritedBy,
      isFavourite: userId
        ? shop.favouritedBy.length > 0
        : false,
    }));

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


export const getShopByUrl = async (req, res) => {
  try {
    const { shopUrl } = req.params;

    const shop = await prisma.seller.findUnique({
      where: { shopUrl: shopUrl },
      include: { user: true, _count: { select: { listings: true } } }
    });

    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }

    res.status(200).json({ success: true, data: shop });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getShopAnalytics = async (req, res) => {
    res.status(200).json({ totalSales: 50000, profileViews: 1200 });

    try {
        const { shop_name, shopUrl, business_type, description } = req.body;
        const userId = req.user.id; // From your authMiddleware

        // 1. Validations
        if (!shop_name || !shopUrl || !business_type) {
            return res.status(400).json({ error: "Please provide all required fields." });
        }

        // 2. Check if user is a seller and is approved
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user.role !== 'SELLER' || user.status !== 'APPROVED') {
            return res.status(403).json({ error: "Only approved sellers can create a shop." });
        }

        // 3. Check for uniqueness
        const existingShop = await prisma.seller.findFirst({
            where: { OR: [{ shop_name }, { shopUrl }] }
        });
        if (existingShop) {
            return res.status(400).json({ error: "Shop name or URL already exists." });
        }

        // 4. Create Shop
        const newShop = await prisma.seller.create({
            data: {
                shop_name,
                shopUrl,
                business_type,
                description,
                user_id: userId,
                status: 'ACTIVE' // Default active upon creation
            }
        });

        res.status(201).json({ success: true, data: newShop });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getShopById = async (req, res) => {
    try {
        const shop = await prisma.seller.findUnique({
            where: { id: req.params.id },
            include: { listings: true, _count: { select: { listings: true } } } // Include associated product listings and count
        });

        if (!shop) return res.status(404).json({ error: "Shop not found" });

        res.status(200).json({ success: true, data: shop });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const toggleFavouriteShop = async (req, res) => {
  try {
    const userId = req.user.id;
    const sellerId = Number(req.params.id);

    const favourite =
      await prisma.favouriteShop.findUnique({
        where: {
          userId_sellerId: {
            userId,
            sellerId,
          },
        },
      });

    if (favourite) {
      await prisma.favouriteShop.delete({
        where: {
          id: favourite.id,
        },
      });

      return res.json({
        success: true,
        favourite: false,
      });
    }

    await prisma.favouriteShop.create({
      data: {
        userId,
        sellerId,
      },
    });

    res.json({
      success: true,
      favourite: true,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

export const getFavouriteStatus = async (
  req,
  res
) => {
  try {
    const userId = req.user.id;
    const sellerId = Number(req.params.id);

    const favourite =
      await prisma.favouriteShop.findUnique({
        where: {
          userId_sellerId: {
            userId,
            sellerId,
          },
        },
      });

    res.json({
      success: true,
      favourite: !!favourite,
    });
  } catch (error) {
    console.log(error);
  }
};

export const getFavouriteCount = async (
  req,
  res
) => {
  const sellerId = Number(req.params.id);

  const count =
    await prisma.favouriteShop.count({
      where: {
        sellerId,
      },
    });

  res.json({
    success: true,
    count,
  });
};

export const updateShop = async (req, res) => {
    try {
        const { shop_banner, description, phone } = req.body;
        const shopId = req.params.id;

        // Validation: Check ownership
        const shop = await prisma.seller.findUnique({ where: { id: shopId } });
        if (shop.user_id !== req.user.id) {
            return res.status(401).json({ error: "Unauthorized to update this shop." });
        }

        const updatedShop = await prisma.seller.update({
            where: { id: shopId },
            data: { shop_banner, description, phone }
        });

        res.status(200).json({ success: true, data: updatedShop });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};



export const approveShop = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;

        // 1. Role Validation: Ensure only Super Admin or designated admin can approve
        const admin = await prisma.user.findUnique({ where: { id: adminId } });
        if (admin.role !== 'SUPER_ADMIN' && admin.role !== 'ADMIN') {
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }

        // 2. Check if Shop exists
        const shop = await prisma.seller.findUnique({ where: { id: parseInt(id) } });
        if (!shop) {
            return res.status(404).json({ error: "Shop not found." });
        }

        // 3. Update Status to ACTIVE
        const approvedShop = await prisma.seller.update({
            where: { id: parseInt(id) },
            data: { status: 'ACTIVE' }
        });

        res.status(200).json({ success: true, message: "Shop approved successfully", data: approvedShop });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getShopProducts = async (req, res) => {
    try {
        const { id } = req.params; // Shop ID

        // 1. Validate Shop Existence
        const shop = await prisma.seller.findUnique({ where: { id: parseInt(id) } });
        if (!shop) {
            return res.status(404).json({ error: "Shop not found." });
        }

        // 2. Fetch all products for this shopyy
        const products = await prisma.listing.findMany({
            where: { shop_id: parseInt(id) },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const toggleShopStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // Expecting 'ACTIVE' or 'DISABLED'

        // 1. Validation: Ensure valid status is provided
        if (!['ACTIVE', 'DISABLED'].includes(status)) {
            return res.status(400).json({ error: "Invalid status. Use 'ACTIVE' or 'DISABLED'." });
        }

        // 2. Update status
        const updatedShop = await prisma.seller.update({
            where: { id: parseInt(id) },
            data: { status }
        });

        res.status(200).json({ success: true, message: `Shop status updated to ${status}`, data: updatedShop });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateInventoryBulk = async (req, res) => {
    try {
        const { updates } = req.body; // Array of { productId: 1, stock: 50 }
        const userId = req.user.id;

        // 1. Validation: Ensure updates is an array
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ error: "Please provide an array of product updates." });
        }

        // 2. Authorization & Execution
        // Using a transaction to ensure all updates succeed or none do
        const transaction = await prisma.$transaction(
            updates.map(update => 
                prisma.product.updateMany({
                    where: { 
                        id: update.productId,
                        shop: { user_id: userId } // Security: Ensure seller owns the product
                    },
                    data: { stock: update.stock }
                })
            )
        );

        res.status(200).json({ success: true, message: "Inventory updated successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getShopReviews = async (req, res) => {
    try {
        const { id } = req.params;

        const reviews = await prisma.review.findMany({
            where: {
                product: { shop_id: parseInt(id) }
            },
            include: {
                user: { select: { name: true } } // Include reviewer name
            }
        });

        res.status(200).json({ success: true, data: reviews });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateShopBranding = async (req, res) => {
    try {
        const { shop_banner, description } = req.body;
        const userId = req.user.id;

        // 1. Input Validation
        if (description && description.length > 500) {
            return res.status(400).json({ error: "Description cannot exceed 500 characters." });
        }

        // 2. Update Branding (Ensuring the user owns the shop)
        const updatedShop = await prisma.seller.updateMany({
            where: { user_id: userId },
            data: {
                shop_banner,
                description
            }
        });

        if (updatedShop.count === 0) {
            return res.status(404).json({ error: "Shop not found or you do not have permission." });
        }

        res.status(200).json({ success: true, message: "Shop branding updated." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }

};

export const getShopBySlug = async (req, res) => {
  try {
    const { shopUrl } = req.params;

    const shop = await prisma.seller.findUnique({
      where: {
        shopUrl,
      },
      include: {
        user: true,
      },
    });

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    res.status(200).json({
      success: true,
      data: shop,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getShopProductsBySlug = async (req, res) => {
  try {
    const { shopUrl } = req.params;

    const seller = await prisma.seller.findUnique({
      where: {
        shopUrl,
      },
    });

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    const products = await prisma.listing.findMany({
      where: {
        sellerId: seller.id,
      },
      include: {
        variants: {
          include: {
            images: true,
          },
        },
        reviews: true,
      },
    });

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};