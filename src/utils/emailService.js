import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendVerificationEmail = async (email, token) => {
  const verifyLink = `http://localhost:5173/verify-email?token=${token}`;
  
  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Verify your Digital City Center account',
    html: `
      <h2>Welcome to Digital City Center!</h2>
      <p>Click the link below to verify your email address:</p>
      <a href="${verifyLink}" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;">
        Verify Email
      </a>
      <p>This link expires in 24 hours.</p>
    `
  };

  await sgMail.send(msg);
};

export const sendPasswordResetEmail = async (email, token) => {
  const resetLink = `http://localhost:3000/reset-password?token=${token}`;
  
  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Reset your Digital City Center password',
    html: `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;">
        Reset Password
      </a>
      <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    `
  };

  await sgMail.send(msg);
};
