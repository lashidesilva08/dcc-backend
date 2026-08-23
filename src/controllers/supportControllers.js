import prisma from "../config/prisma.js";

const VALID_SUBJECTS = [
  "customer-support",
  "order",
  "seller",
  "partnership",
  "general",
];

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const submitInquiry = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return res.status(400).json({ message: "Name, email, subject, and message are required." });
    }

    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    if (!VALID_SUBJECTS.includes(subject.trim())) {
      return res.status(400).json({ message: "Please select a valid subject." });
    }

    const inquiry = await prisma.supportInquiry.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: subject.trim(),
        message: message.trim(),
      },
    });

    res.status(201).json({
      message: "Support inquiry submitted successfully.",
      inquiry: {
        id: inquiry.id,
        createdAt: inquiry.createdAt,
      },
    });
  } catch (error) {
    console.error("Submit inquiry error:", error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

export const getAllTickets = async (req, res) => {
  try {
    const tickets = await prisma.supportInquiry.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ tickets });
  } catch (error) {
    console.error("Get support tickets error:", error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};
