import { PrismaClient } from "@prisma/client";
import emailService from "../services/email.service.js";

const prisma = new PrismaClient();

/*
|--------------------------------------------------------------------------
| Save Email Log
|--------------------------------------------------------------------------
*/

const saveLog = async ({
  userId = null,
  email,
  subject,
  template,
  status,
}) => {
  try {
    await prisma.emailLog.create({
      data: {
        userId,
        email,
        subject,
        template,
        status,
      },
    });
  } catch (err) {
    console.error("Email Log Error:", err);
  }
};

/*
|--------------------------------------------------------------------------
| Welcome Email
|--------------------------------------------------------------------------
*/

export const sendWelcomeEmail = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await prisma.user.findUnique({
      where: {
        id: Number(userId),
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    await emailService.sendWelcome(user);

    await saveLog({
      userId: user.id,
      email: user.email,
      subject: "Welcome",
      template: "WelcomeEmail",
      status: "SUCCESS",
    });

    res.json({
      success: true,
      message: "Welcome email sent.",
    });

  } catch (error) {

    console.error(error);

    await saveLog({
      email: req.body.email,
      subject: "Welcome",
      template: "WelcomeEmail",
      status: "FAILED",
    });

    res.status(500).json({
      success: false,
      message: "Unable to send welcome email.",
    });

  }
};

/*
|--------------------------------------------------------------------------
| Verify Email
|--------------------------------------------------------------------------
*/

export const sendVerificationEmail = async (req, res) => {

  try {

    const { userId, link } = req.body;

    const user = await prisma.user.findUnique({
      where: {
        id: Number(userId),
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    await emailService.sendVerification(
      user,
      link
    );

    await saveLog({
      userId: user.id,
      email: user.email,
      subject: "Verify Email",
      template: "VerifyEmail",
      status: "SUCCESS",
    });

    res.json({
      success: true,
      message: "Verification email sent.",
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Unable to send verification email.",
    });

  }

};

/*
|--------------------------------------------------------------------------
| Reset Password
|--------------------------------------------------------------------------
*/

export const sendResetPasswordEmail = async (
  req,
  res
) => {

  try {

    const { userId, resetUrl } = req.body;

    const user = await prisma.user.findUnique({
      where: {
        id: Number(userId),
      },
    });

    if (!user) {

      return res.status(404).json({
        success: false,
        message: "User not found.",
      });

    }

    await emailService.sendPasswordReset(
      user,
      resetUrl
    );

    await saveLog({
      userId: user.id,
      email: user.email,
      subject: "Reset Password",
      template: "ResetPasswordEmail",
      status: "SUCCESS",
    });

    res.json({
      success: true,
      message: "Reset email sent.",
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Unable to send reset email.",
    });

  }

};

/*
|--------------------------------------------------------------------------
| Order Confirmation
|--------------------------------------------------------------------------
*/

export const sendOrderConfirmationEmail =
  async (req, res) => {

    try {

      const { orderId } = req.body;

      const order =
        await prisma.order.findUnique({
          where: {
            id: Number(orderId),
          },
          include: {
            user: true,
          },
        });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found.",
        });
      }

      await emailService.sendOrderConfirmation(
        order.user,
        {
          id: order.orderNumber,
          total: order.totalAmount,
        }
      );

      await saveLog({
        userId: order.user.id,
        email: order.user.email,
        subject: "Order Confirmation",
        template: "OrderConfirmationEmail",
        status: "SUCCESS",
      });

      res.json({
        success: true,
        message: "Order confirmation email sent.",
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        message: "Unable to send email.",
      });

    }

  };


  export const sendSellerApprovedEmail =
async (req,res)=>{

try{

const {sellerId}=req.body;

const seller=await prisma.seller.findUnique({

where:{id:Number(sellerId)},

include:{user:true}

});

await emailService.sendSellerApproved({

email:seller.user.email,

businessName:seller.shopName

});

await saveLog({

userId:seller.user.id,

email:seller.user.email,

subject:"Seller Approved",

template:"SellerApprovedEmail",

status:"SUCCESS"

});

res.json({

success:true,

message:"Seller approval email sent."

});

}catch(err){

console.error(err);

res.status(500).json({

success:false,

message:"Unable to send seller email."

});

}

};

export const sendSellerRejectedEmail =
async(req,res)=>{

try{

const {sellerId,reason}=req.body;

const seller=await prisma.seller.findUnique({

where:{id:Number(sellerId)},

include:{user:true}

});

await emailService.sendSellerRejected({

email:seller.user.email,

businessName:seller.shopName

},reason);

await saveLog({

userId:seller.user.id,

email:seller.user.email,

subject:"Seller Rejected",

template:"SellerRejectedEmail",

status:"SUCCESS"

});

res.json({

success:true,

message:"Seller rejection email sent."

});

}catch(err){

console.error(err);

res.status(500).json({

success:false,

message:"Unable to send seller rejection email."

});

}

}
