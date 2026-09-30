import sgMail from "@sendgrid/mail";
import transporter from "../config/mail.config.js";

/**
 * Sends an email.
 *
 * - If SENDGRID_API_KEY is set, the SendGrid API is used.
 * - Otherwise the existing SMTP transporter (nodemailer) is used.
 *   SendGrid and AWS SES both expose SMTP, so pointing SMTP_HOST / SMTP_USER /
 *   SMTP_PASS at either provider also works without this branch.
 *
 * MAIL_FROM must be a sender verified with the provider,
 * e.g. "Digital City Center <no-reply@yourdomain.com>".
 */
const mailSender = async ({ to, subject, html }) => {
  try {
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      const [response] = await sgMail.send({
        to,
        from: process.env.MAIL_FROM,
        subject,
        html,
      });

      console.log("Email Sent (SendGrid):", response.statusCode);

      return response;
    }

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      html,
    });

    console.log("Email Sent:", info.messageId);

    return info;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

export default mailSender;