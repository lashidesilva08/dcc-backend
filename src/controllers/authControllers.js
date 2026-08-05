import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import redisClient from '../config/redis.js';
import emailService from "../services/email.service.js";
import notificationService from "../services/notification.service.js";

const prisma = new PrismaClient();

const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Name, email and password are required.'
      });
    }

    // Rate limiting — max 3 registrations per hour per IP
    const rateLimitKey = `register_attempts:${req.ip}`;
    const attempts = await redisClient.get(rateLimitKey);

    if (attempts && parseInt(attempts) >= 3) {
      return res.status(429).json({
        message: 'Too many registration attempts. Please try again after 1 hour.'
      });
    }

    await redisClient.incr(rateLimitKey);
    await redisClient.expire(rateLimitKey, 60 * 60);

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (existing) {
      return res.status(400).json({
        message: 'An account with this email already exists.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: role || 'BUYER',
        verified: false
      }
    });

    const verifyToken = crypto.randomBytes(32).toString('hex');

    await redisClient.setEx(
      `verify:${verifyToken}`,
      24 * 60 * 60,
      user.id.toString()
    );

    const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${verifyToken}`;

    // Verification Email
    await emailService.sendVerification(user, verifyLink);

    // Welcome Email
    await emailService.sendWelcome(user);

    // Welcome Notification
    await notificationService.welcome(user.id);

    const token = generateToken(user.id, user.role);

    res.status(201).json({
      message: 'Account created successfully. Please check your email to verify your account.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      message: 'Something went wrong. Please try again.'
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const rateLimitKey = `login_attempts:${email.toLowerCase().trim()}`;
    const attempts = await redisClient.get(rateLimitKey);
    if (attempts && parseInt(attempts) >= 5) {
      return res.status(429).json({ message: 'Too many login attempts. Please try again after 15 minutes.' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!user || !user.password) {
      await redisClient.incr(rateLimitKey);
      await redisClient.expire(rateLimitKey, 15 * 60);
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      await redisClient.incr(rateLimitKey);
      await redisClient.expire(rateLimitKey, 15 * 60);
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    await redisClient.del(rateLimitKey);
    const token = generateToken(user.id, user.role);

    res.status(200).json({
      message: 'Login successful.',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, verified: user.verified }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

export const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({ message: 'No token provided.' });
    }
    const token = authHeader.split(' ')[1];
    await redisClient.setEx(`blacklist:${token}`, 7 * 24 * 60 * 60, 'blacklisted');
    res.status(200).json({ message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Something went wrong.' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const successMessage = 'If that email is registered, a reset link has been sent.';
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) return res.status(200).json({ message: successMessage });

    const resetToken = crypto.randomBytes(32).toString('hex');
    await redisClient.setEx(`reset:${resetToken}`, 3600, user.id.toString());
    const resetLink =
`${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

await emailService.sendPasswordReset(
    user,
    resetLink
);

await notificationService.create({

    userId:user.id,

    title:"Password Reset",

    message:"Password reset link has been sent to your email.",

    type:"ACCOUNT"

});

    res.status(200).json({ message: successMessage });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const userId = await redisClient.get(`reset:${token}`);
    if (!userId) {
      return res.status(400).json({ message: 'This reset link is invalid or has expired.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: parseInt(userId) }, data: { password: hashedPassword } });
    await redisClient.del(`reset:${token}`);

    res.status(200).json({ message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

export const registerSeller = async (req, res) => {
  try {
    const { name, email, password, shop_name, business_type, phone } = req.body;

    if (!name || !email || !password || !shop_name || !business_type) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: 'SELLER',
        phone: phone || null,
        verified: false
      }
    });

    await prisma.seller.create({
      data: {
        userId: user.id,
        shopName: shop_name,
        shopUrl: shop_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        businessType: business_type,
        status: 'pending'
      }
    });

    res.status(201).json({
      message: 'Seller account submitted. You will receive an email once approved by admin.',
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });

  } catch (error) {
    console.error('Seller register error:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!user || !user.password) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Access denied. Not an admin account.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(user.id, user.role);

    res.status(200).json({
      message: 'Admin login successful.',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

export const googleAuth = async (req, res) => {
  res.status(200).json({ message: 'Google login - coming soon' });
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ message: 'Verification token is required.' });
    }

    const userId = await redisClient.get(`verify:${token}`);
    if (!userId) {
      return res.status(400).json({ message: 'This verification link is invalid or has expired.' });
    }

    await prisma.user.update({ where: { id: parseInt(userId) }, data: { verified: true } });

    await notificationService.create({

    userId:Number(userId),

    title:"Email Verified",

    message:"Your email has been successfully verified.",

    type:"ACCOUNT"

});

    await redisClient.del(`verify:${token}`);

    res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }

 
};
// ==========================================
// VERIFY OTP ENDPOINT (For 6-digit code)
// ==========================================
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required." });
    }

    // 1. Check Redis for the 6-digit code
    const storedOTP = await redisClient.get(`otp:${email.toLowerCase().trim()}`);

    if (!storedOTP) {
      return res.status(400).json({ success: false, message: "OTP expired or invalid." });
    }

    // 2. Check if it matches
    if (storedOTP !== otp) {
      return res.status(400).json({ success: false, message: "Incorrect OTP code." });
    }

    // 3. Permanently verify the user in PostgreSQL
    await prisma.user.update({
      where: { email: email.toLowerCase().trim() },
      data: { verified: true }
    });

    // 4. Delete the OTP from Redis
    await redisClient.del(`otp:${email.toLowerCase().trim()}`);

    res.status(200).json({ success: true, message: "Email verified successfully!" });

  } catch (error) {
    console.error("OTP Verification Error:", error);
    res.status(500).json({ success: false, message: "Server error during verification." });
  }
};