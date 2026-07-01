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