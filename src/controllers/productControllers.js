import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
// 1. Browse products with search and filtering
export const getAllProducts = async (req, res) => {
    const { search, category, minPrice, maxPrice } = req.query;
    res.status(200).json({
        message: "Products fetched successfully",
        filtersApplied: { search, category, minPrice, maxPrice },
        data: [] // Placeholder for Prisma query result
    });
};

// 2. List all categories
export const getCategories = async (req, res) => {
    const categories = ["Fashion", "Groceries", "Small Businesses", "Services"];
    res.status(200).json({ categories });
};

// 3. Get detailed product info
export const getProductById = async (req, res) => {
    try {
        const { id } = req.params;

        // CRITICAL: Convert the string ID from params into an integer
        const productId = parseInt(id, 10);

        if (isNaN(productId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID format. ID must be a number."
            });
        }

        // Fetch product and include its variants (with specifications/images), category, and seller
        const product = await prisma.listing.findUnique({
  where: {
    id: productId,
  },
  include: {
    variants: {
      include: {
        images: true,
      },
    },
    reviews: true,
    category: true,
    seller: {
      select: {
        shopName: true,
        shopUrl: true,
      },
    },
  },
});

        // If no product matches that ID
        if (!product) {
            return res.status(404).json({
                success: false,
                message: `Product with ID ${id} not found.`
            });
        }

        // Return the actual database data
        res.status(200).json({
            success: true,
            message: "Product details retrieved successfully",
            data: product
        });

    } catch (error) {
        console.error("Error fetching product details:", error);
        res.status(500).json({
            success: false,
            message: "An internal server error occurred while retrieving the product details."
        });
    }
};
// 4. Create product (Seller Only)
export const createProduct = async (req, res) => {
    const productData = req.body;
    res.status(201).json({
        message: "Product listing created successfully",
        data: productData
    });
};

// 5. Update product (Seller Only)
export const updateProduct = async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    res.status(200).json({
        message: `Product ${id} updated`,
        updatedData: updateData
    });
};

// 6. Delete product (Seller Only)
export const deleteProduct = async (req, res) => {
    const { id } = req.params;
    res.status(200).json({ message: `Product ${id} deleted successfully` });
};

// 7. Get reviews
export const getProductReviews = async (req, res) => {
    const { productId } = req.params;
    res.status(200).json({
        message: `Reviews for product ${productId}`,
        reviews: []
    });
};

// 8. Submit Review (Buyer Only)
export const submitReview = async (req, res) => {
    const { productId, rating, comment } = req.body;
    res.status(201).json({
        message: "Review submitted successfully",
        review: { productId, rating, comment }
    });
};



