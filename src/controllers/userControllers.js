
// Get current logged-in user profile

export const getProfile = async (req, res) => {
    res.status(200).json({ status: "success", data: { name: "User Name", email: "user@example.com", role: "BUYER" } });
};

// Update user profile details
export const updateProfile = async (req, res) => {
    try {
        const { name, phone, address } = req.body;
        // Logic for testing without DB
        res.status(200).json({ message: "Profile updated successfully (Mock)", data: { name, phone, address } });
    } catch (error) {
        res.status(500).json({ error: "Failed to update profile" });
    }
};    

// Change account password
export const changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        res.status(200).json({ message: "Password updated successfully (Mock)" });
    } catch (error) {
        res.status(500).json({ error: "Failed to change password" });
    }
};

// Deactivate or delete account
export const deleteAccount = async (req, res) => {
    try {
        res.status(200).json({ message: "Account deactivation request received (Mock)" });
    } catch (error) {
        res.status(500).json({ error: "Failed to process account deletion" });
    }

};




