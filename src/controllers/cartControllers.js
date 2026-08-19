import prisma from "../config/prisma.js";


// ======================================================
// CART HELPERS
// ======================================================

function getMainImage(images = []) {
    if (!images.length) {
        return "";
    }

    const mainImage = images.find(
        (image) => image.isMain
    );

    return mainImage?.url || images[0]?.url || "";
}


function getAttribute(attributes, name) {
    if (!attributes || typeof attributes !== "object") {
        return "";
    }

    const key = Object.keys(attributes).find(
        (attributeKey) =>
            attributeKey.toLowerCase() === name.toLowerCase()
    );

    return key ? String(attributes[key]) : "";
}


function calculateCartSummary(items) {
    const subtotal = items.reduce(
        (sum, item) => sum + item.lineTotal,
        0
    );

    const itemCount = items.reduce(
        (sum, item) => sum + item.quantity,
        0
    );

    /*
     * Cart page estimate uses the default
     * Platform Delivery method.
     *
     * Checkout will calculate the final fee
     * according to the selected delivery method.
     */
    const deliveryFee =
        subtotal > 0 && subtotal < 10000
            ? 350
            : 0;

    return {
        itemCount,
        uniqueItems: items.length,
        subtotal,
        deliveryFee,
        discount: 0,
        total: subtotal + deliveryFee,
        currency: "LKR",
        freeDeliveryThreshold: 10000
    };
}


function normalizeCartItem(cartItem) {
    const variant = cartItem.variant;
    const listing = variant.listing;

    const price = Number(variant.price);
    const quantity = Number(cartItem.quantity);

    return {
        id: listing.id,

        lineId: cartItem.id,

        productId: listing.id,

        listingId: listing.id,

        variantId: variant.id,

        name: listing.title,

        brand:
            listing.category?.name || "",

        seller:
            listing.seller?.shopName ||
            "Marketplace Seller",

        quantity,

        price,

        unitPrice: price,

        lineTotal:
            price * quantity,

        stock:
            variant.stock,

        status:
            variant.status,

        image:
            getMainImage(
                variant.images
            ),

        color:
            getAttribute(
                variant.attributes,
                "color"
            ),

        size:
            getAttribute(
                variant.attributes,
                "size"
            ),

        attributes:
            variant.attributes || {}
    };
}


async function loadUserCart(userId) {
    const rows =
        await prisma.cartItem.findMany({
            where: {
                userId
            },

            include: {
                variant: {
                    include: {
                        images: true,

                        listing: {
                            include: {
                                seller: true,
                                category: true
                            }
                        }
                    }
                }
            },

            orderBy: {
                createdAt: "asc"
            }
        });


    const items =
        rows.map(normalizeCartItem);


    return {
        items,
        summary:
            calculateCartSummary(items)
    };
}


// ======================================================
// GET CART
// GET /api/v1/cart
// ======================================================

export const getCart = async (req, res) => {
    try {
        const userId = req.user.id;

        const cart =
            await loadUserCart(userId);

        return res.status(200).json({
            success: true,
            message:
                "Cart retrieved successfully.",
            data: cart
        });

    } catch (error) {
        console.error(
            "Get cart error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to retrieve cart.",
            error: error.message
        });
    }
};


// ======================================================
// ADD TO CART
// POST /api/v1/cart/add
// ======================================================

export const addToCart = async (req, res) => {
    try {
        const userId = req.user.id;

        const {
            variantId,
            quantity = 1
        } = req.body;


        const parsedVariantId =
            Number(variantId);

        const parsedQuantity =
            Number(quantity);


        // ----------------------------------------------
        // Validate input
        // ----------------------------------------------

        if (
            !Number.isInteger(parsedVariantId) ||
            parsedVariantId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid product variant is required."
            });
        }


        if (
            !Number.isInteger(parsedQuantity) ||
            parsedQuantity <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Quantity must be at least 1."
            });
        }


        // ----------------------------------------------
        // Check real product
        // ----------------------------------------------

        const variant =
            await prisma.productVariant.findUnique({
                where: {
                    id: parsedVariantId
                },

                include: {
                    listing: true
                }
            });


        if (!variant) {
            return res.status(404).json({
                success: false,
                message:
                    "Product variant not found."
            });
        }


        if (
            variant.status !== "active" ||
            variant.listing.status !== "active"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "This product is currently unavailable."
            });
        }


        // ----------------------------------------------
        // Existing cart line?
        // ----------------------------------------------

        const existing =
            await prisma.cartItem.findUnique({
                where: {
                    userId_variantId: {
                        userId,
                        variantId:
                            parsedVariantId
                    }
                }
            });


        const nextQuantity =
            (existing?.quantity || 0) +
            parsedQuantity;


        if (
            nextQuantity >
            variant.stock
        ) {
            return res.status(400).json({
                success: false,
                message:
                    `Only ${variant.stock} item(s) are currently available.`
            });
        }


        // ----------------------------------------------
        // Create or update
        // ----------------------------------------------

        await prisma.cartItem.upsert({
            where: {
                userId_variantId: {
                    userId,
                    variantId:
                        parsedVariantId
                }
            },

            update: {
                quantity:
                    nextQuantity
            },

            create: {
                userId,

                variantId:
                    parsedVariantId,

                quantity:
                    parsedQuantity
            }
        });


        const cart =
            await loadUserCart(userId);


        return res.status(201).json({
            success: true,
            message:
                "Product added to cart.",
            data: cart
        });

    } catch (error) {
        console.error(
            "Add to cart error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to add product to cart.",
            error: error.message
        });
    }
};


// ======================================================
// UPDATE CART QUANTITY
// PUT /api/v1/cart/update/:id
// ======================================================

export const updateCartItem = async (req, res) => {
    try {
        const userId = req.user.id;

        const cartItemId =
            Number(req.params.id);

        const quantity =
            Number(req.body.quantity);


        if (
            !Number.isInteger(cartItemId) ||
            cartItemId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid cart item ID."
            });
        }


        if (
            !Number.isInteger(quantity) ||
            quantity <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Quantity must be at least 1."
            });
        }


        const cartItem =
            await prisma.cartItem.findFirst({
                where: {
                    id:
                        cartItemId,

                    userId
                },

                include: {
                    variant: true
                }
            });


        if (!cartItem) {
            return res.status(404).json({
                success: false,
                message:
                    "Cart item not found."
            });
        }


        if (
            cartItem.variant.status !==
            "active"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "This product is no longer available."
            });
        }


        if (
            quantity >
            cartItem.variant.stock
        ) {
            return res.status(400).json({
                success: false,
                message:
                    `Only ${cartItem.variant.stock} item(s) are currently available.`
            });
        }


        await prisma.cartItem.update({
            where: {
                id: cartItemId
            },

            data: {
                quantity
            }
        });


        const cart =
            await loadUserCart(userId);


        return res.status(200).json({
            success: true,
            message:
                "Cart quantity updated.",
            data: cart
        });

    } catch (error) {
        console.error(
            "Update cart error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to update cart.",
            error: error.message
        });
    }
};


// ======================================================
// REMOVE ONE CART ITEM
// DELETE /api/v1/cart/:id
// ======================================================

export const removeFromCart = async (req, res) => {
    try {
        const userId = req.user.id;

        const cartItemId =
            Number(req.params.id);


        if (
            !Number.isInteger(cartItemId) ||
            cartItemId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid cart item ID."
            });
        }


        const cartItem =
            await prisma.cartItem.findFirst({
                where: {
                    id:
                        cartItemId,

                    userId
                }
            });


        if (!cartItem) {
            return res.status(404).json({
                success: false,
                message:
                    "Cart item not found."
            });
        }


        await prisma.cartItem.delete({
            where: {
                id: cartItemId
            }
        });


        const cart =
            await loadUserCart(userId);


        return res.status(200).json({
            success: true,
            message:
                "Item removed from cart.",
            data: cart
        });

    } catch (error) {
        console.error(
            "Remove cart item error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to remove cart item.",
            error: error.message
        });
    }
};


// ======================================================
// CLEAR CART
// DELETE /api/v1/cart/clear
// ======================================================

export const clearCart = async (req, res) => {
    try {
        const userId =
            req.user.id;


        await prisma.cartItem.deleteMany({
            where: {
                userId
            }
        });


        return res.status(200).json({
            success: true,
            message:
                "Cart cleared successfully.",

            data: {
                items: [],

                summary: {
                    itemCount: 0,
                    uniqueItems: 0,
                    subtotal: 0,
                    deliveryFee: 0,
                    discount: 0,
                    total: 0,
                    currency: "LKR",
                    freeDeliveryThreshold: 10000
                }
            }
        });

    } catch (error) {
        console.error(
            "Clear cart error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to clear cart.",
            error: error.message
        });
    }
};