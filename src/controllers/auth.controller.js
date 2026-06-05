const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const redisClient = require('../config/redis');

const prisma = new PrismaClient();

const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// ─────────────────────────────────────────────
// POST /api/v1/auth/login
// With rate limiting via Redis
// ─────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Rate limiting — max 5 attempts per 15 minutes per email
    const rateLimitKey = `login_attempts:${email.toLowerCase().trim()}`;
    const attempts = await redisClient.get(rateLimitKey);

    if (attempts && parseInt(attempts) >= 5) {
      return res.status(429).json({
        message: 'Too many login attempts. Please try again after 15 minutes.'
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user || !user.password_hash) {
      // Increment failed attempts
      await redisClient.incr(rateLimitKey);
      await redisClient.expire(rateLimitKey, 15 * 60); // 15 minutes
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      // Increment failed attempts
      await redisClient.incr(rateLimitKey);
      await redisClient.expire(rateLimitKey, 15 * 60);
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Login successful — clear rate limit
    await redisClient.del(rateLimitKey);

    const token = generateToken(user.id, user.role);

    res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        verified: user.verified
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// ─────────────────────────────────────────────
// GET /api/v1/auth/me
// ─────────────────────────────────────────────
const getMe = async (req, res) => {
  res.status(200).json({
    message: 'Here is your account info.',
    user: req.user
  });
};

// ─────────────────────────────────────────────
// POST /api/v1/auth/logout
// Blacklist the JWT token in Redis
// ─────────────────────────────────────────────
const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({ message: 'No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    // Store token in Redis blacklist — expires in 7 days (same as JWT)
    await redisClient.setEx(`blacklist:${token}`, 7 * 24 * 60 * 60, 'blacklisted');

    res.status(200).json({ message: 'Logged out successfully.' });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Something went wrong.' });
  }
};

// ─────────────────────────────────────────────
// POST /api/v1/auth/forgot-password
// Store reset token in Redis instead of PostgreSQL
// ─────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const successMessage = 'If that email is registered, a reset link has been sent.';

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      return res.status(200).json({ message: successMessage });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Store in Redis — expires in 1 hour (3600 seconds)
    await redisClient.setEx(`reset:${resetToken}`, 3600, user.id);

    // TODO: send real email
    console.log(`Reset link: http://localhost:3000/reset-password?token=${resetToken}`);

    res.status(200).json({ message: successMessage });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// ─────────────────────────────────────────────
// POST /api/v1/auth/reset-password
// Verify reset token from Redis
// ─────────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    // Get user ID from Redis using the reset token
    const userId = await redisClient.get(`reset:${token}`);

    if (!userId) {
      return res.status(400).json({
        message: 'This reset link is invalid or has expired. Please request a new one.'
      });
    }

    // Hash new password
    const password_hash = await bcrypt.hash(newPassword, 12);

    // Update password in database
    await prisma.user.update({
      where: { id: userId },
      data: { password_hash }
    });

    // Delete reset token from Redis — can't be used again
    await redisClient.del(`reset:${token}`);

    res.status(200).json({ message: 'Password reset successful. You can now log in.' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

module.exports = {
  login,
  getMe,
  logout,
  forgotPassword,
  resetPassword
};