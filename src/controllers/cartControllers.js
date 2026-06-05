export const getCart = async (req, res) => {
    res.status(200).json({
        message: "Cart items retrieved successfully",
        cart: [
            { id: "c1", productId: "p101", name: "Designer Shirt", quantity: 1, price: 2500 }
        ]
    });
};

export const addToCart = async (req, res) => {
    const { productId, quantity } = req.body;
    res.status(201).json({
        message: "Product added to cart",
        addedItem: { productId, quantity }
    });
};

export const removeFromCart = async (req, res) => {
    const { id } = req.params;
    res.status(200).json({ message: `Item ${id} removed from cart` });
};

export const updateCartItem = async (req, res) => {
    res.status(200).json({
        message: "Cart item updated"
    });
};

export const clearCart = async (req, res) => {
    res.status(200).json({
        message: "Cart cleared"
    });
};