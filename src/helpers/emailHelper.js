import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export const sendOrderConfirmation = async (userEmail, userName, order) => {
    const orderItemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.listing.title}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">Rs. ${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

    const msg = {
        to: userEmail,
        from: 'no-reply@digitalcity.lk',
        subject: `Order Confirmation - #ORD-${order.id.toString().padStart(5, '0')}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Digital City Center</h2>
        <h3>Hi ${userName},</h3>
        <p>Your order has been placed successfully!</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 10px; text-align: left;">Item</th>
              <th style="padding: 10px; text-align: center;">Qty</th>
              <th style="padding: 10px; text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>${orderItemsHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding: 10px; text-align: right; font-weight: bold;">Total:</td>
              <td style="padding: 10px; text-align: right; font-weight: bold; font-size: 1.2em; color: #2563eb;">
                Rs. ${parseFloat(order.total).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #6b7280; font-size: 0.9em;">
          <p>Payment: ${order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online Payment'}</p>
        </div>
      </div>
    `,
    };

    try {
        await sgMail.send(msg);
    } catch (error) {
        console.error('Email Error:', error.message);
    }
};