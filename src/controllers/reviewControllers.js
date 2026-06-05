
// 1. Get all reviews for a specific product
export const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        // Placeholder for Prisma: await prisma.review.findMany({ where: { productId } })
        
        res.status(200).json({
            status: "success",
            message: `Fetched all reviews for product ${productId}`,
            data: [] // Mock data
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Submit a new review (Buyer only)
export const addReview = async (req, res) => {
    try {
        const { product_id, rating, comment } = req.body;
        const userId = req.user.id; // From authMiddleware

        // Validation: Ensure rating and product ID are provided 
        if (!product_id || !rating) {
            return res.status(400).json({ error: "Product ID and rating are required." });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: "Rating must be between 1 and 5." });
        }

        res.status(201).json({
            status: "success",
            message: "Review submitted successfully.",
            data: { userId, product_id, rating, comment }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. Delete a review
export const deleteReview = async (req, res) => {
    try {
        const { id } = req.params;
        res.status(200).json({
            status: "success",
            message: `Review ${id} deleted.`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};