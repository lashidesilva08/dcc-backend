export const getNotifications = async (req, res) => {
    res.status(200).json({ notifications: [{ id: "n1", text: "Your order was shipped!" }] });
};

export const markAsRead = async (req, res) => {
    res.status(200).json({ message: `Notification ${req.params.id} marked as read` });
};

export const clearAll = async (req, res) => {
    res.status(200).json({ message: "All notifications cleared" });
};

export const markAllRead = async (req, res) => {
    res.status(200).json({
        message: "All notifications marked as read"
    });
};

export const deleteNotification = async (req, res) => {
    res.status(200).json({
        message: "Notification deleted"
    });
};