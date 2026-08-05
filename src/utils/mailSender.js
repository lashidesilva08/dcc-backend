import transporter from "../config/mail.config.js";

const mailSender = async ({
  to,
  subject,
  html,
}) => {
  try {
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