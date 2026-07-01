import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const generateSlug = (name) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
};

export const getAllCategories = async (req, res) => {
    try {
        const categories = await prisma.category.findMany();
        res.status(200).json({ message: "Fetched all marketplace categories.", categories });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getCategory = async (req, res) => {
    try {
        const { param } = req.params;
        const isId = !isNaN(parseInt(param));
        
        const category = await prisma.category.findFirst({
            where: isId ? { id: parseInt(param) } : { slug: param }
        });
        
        if (!category) {
            return res.status(404).json({ message: "Category not found." });
        }

        res.status(200).json({ message: `Fetched details for category: ${param}`, category });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const createCategory = async (req, res) => {
    try {
        const { name, icon, status } = req.body;
        
        if (!name) {
            return res.status(400).json({ message: "Category name is required." });
        }

        const slug = generateSlug(name);

        const newCategory = await prisma.category.create({
            data: {
                name,
                slug,
                icon,
                status: status || "active"
            }
        });

        res.status(201).json({ message: "New category created successfully.", category: newCategory });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, icon, status } = req.body;

        const updateData = { icon, status };
        if (name) {
            updateData.name = name;
            updateData.slug = generateSlug(name);
        }

        const updatedCategory = await prisma.category.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        res.status(200).json({ message: "Category updated successfully.", category: updatedCategory });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Category not found." });
        }
        res.status(400).json({ error: error.message });
    }
};

export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.category.delete({
            where: { id: parseInt(id) }
        });

        res.status(200).json({ message: "Category removed from platform." });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Category not found." });
        }
        res.status(400).json({ error: error.message });
    }
};