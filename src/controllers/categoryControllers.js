export const getAllCategories = async (req, res) => {
    try {
        res.status(200).json({ message: "Fetched all marketplace categories." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getCategoryBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        res.status(200).json({ message: `Fetched details for category: ${slug}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const createCategory = async (req, res) => {
    try {
        res.status(201).json({ message: "New category created successfully." });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const updateCategory = async (req, res) => {
    try {
        res.status(200).json({ message: "Category updated successfully." });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const deleteCategory = async (req, res) => {
    try {
        res.status(200).json({ message: "Category removed from platform." });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};