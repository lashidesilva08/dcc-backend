export const getPendingSellers = async (req, res) => {
    res.status(200).json({ pending: [] });
};

export const approveSeller = async (req, res) => {
    const { status } = req.body; // "APPROVED" or "REJECTED"
    res.status(200).json({ message: `Seller status updated to ${status}` });
};

export const getSalesReport = async (req, res) => {
    res.status(200).json({ analytics: { totalEarnings: 50000, orders: 120 } });
};

export const getDisputes = async (req, res) => {
    res.status(200).json({ disputes: [] });
};

export const getDashboard = async (req, res) => {
    res.status(200).json({
        totalUsers: 100,
        totalOrders: 50,
        totalRevenue: 50000
    });
};



export const rejectSeller = async (req, res) => {
    res.status(200).json({
        message: "Seller rejected"
    });
};

export const suspendSeller = async (req, res) => {
    res.status(200).json({
        message: "Seller suspended"
    });
};

// Admin: Get all orders
export const getAllOrders = async (req, res) => {
    res.status(200).json({
        message: "All orders fetched"
    });
};

