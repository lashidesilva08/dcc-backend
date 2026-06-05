export const register = async (req, res) => {
    const { name, email, password, role } = req.body;

    res.status(201).json({
        message: "User registered successfully",
        data: { name, email, role }
    });
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    res.status(200).json({
        message: "Login successful",
        token: "jwt_token_here"
    });
};

export const googleAuth = async (req, res) => {
    res.status(200).json({
        message: "Google login successful"
    });
};

export const verifyEmail = async (req, res) => {
    res.status(200).json({
        message: "Email verified successfully"
    });
};

export const forgotPassword = async (req, res) => {
    res.status(200).json({
        message: "Password reset link sent"
    });
};

export const resetPassword = async (req, res) => {
    res.status(200).json({
        message: "Password reset successful"
    });
};

export const logout = async (req, res) => {
    res.status(200).json({
        message: "Logged out successfully"
    });
};
