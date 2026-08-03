import { render } from "@react-email/render";

import mailSender from "../utils/mailSender.js";

import WelcomeEmail from "../templates/WelcomeEmail.js";
import VerifyEmail from "../templates/VerifyEmail.js";
import ResetPasswordEmail from "../templates/ResetPasswordEmail.js";
import OrderConfirmationEmail from "../templates/OrderConfirmationEmail.js";
import OrderStatusEmail from "../templates/OrderStatusEmail.js";
import SellerApprovedEmail from "../templates/SellerApprovedEmail.js";
import SellerRejectedEmail from "../templates/SellerRejectedEmail.js";

class EmailService {

  async sendTemplate(component, subject, email) {
    const html = await render(component);

    return mailSender({
      to: email,
      subject,
      html,
    });
  }

  async sendWelcome(user) {
    return this.sendTemplate(
      WelcomeEmail({ name: user.name }),
      "Welcome to Digital City Center",
      user.email
    );
  }

  async sendVerification(user, link) {
    return this.sendTemplate(
      VerifyEmail({ name: user.name, url: link }),
      "Verify Your Email",
      user.email
    );
  }

  async sendPasswordReset(user, resetUrl) {
    return this.sendTemplate(
      ResetPasswordEmail({ name: user.name, resetUrl }),
      "Reset Password",
      user.email
    );
  }

  async sendOrderConfirmation(user, order) {
    return this.sendTemplate(
      OrderConfirmationEmail({ name: user.name, orderId: order.id, total: order.total }),
      "Order Confirmation",
      user.email
    );
  }

  async sendOrderStatus(user, order) {
    return this.sendTemplate(
      OrderStatusEmail({ name: user.name, orderId: order.id, status: order.status }),
      "Order Status Updated",
      user.email
    );
  }

  async sendSellerApproved(user) {
    return this.sendTemplate(
      SellerApprovedEmail({ businessName: user.businessName }),
      "Seller Approved",
      user.email
    );
  }

  async sendSellerRejected(user, reason) {
    return this.sendTemplate(
      SellerRejectedEmail({ businessName: user.businessName, reason }),
      "Seller Application Status",
      user.email
    );
  }
}

export default new EmailService();