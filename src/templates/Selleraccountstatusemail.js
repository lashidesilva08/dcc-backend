import React from "react";

import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
} from "@react-email/components";

/**
 * Used for suspended / reinstated / removed seller accounts.
 */
export default function SellerAccountStatusEmail({
  businessName,
  heading,
  message,
  reason,
}) {
  const children = [
    React.createElement(Heading, { key: "heading" }, heading),

    React.createElement(Text, { key: "greeting" }, `Hello ${businessName},`),

    React.createElement(Text, { key: "message" }, message),
  ];

  if (reason) {
    children.push(
      React.createElement(
        Text,
        {
          key: "reason",
          style: {
            backgroundColor: "#F8F9FD",
            padding: "12px 16px",
            borderRadius: "6px",
          },
        },
        `Reason: ${reason}`
      )
    );
  }

  children.push(
    React.createElement(
      Text,
      { key: "support" },
      "If you have any questions, please reply to this email or contact our support team."
    ),

    React.createElement(
      Text,
      { key: "signature", style: { color: "#888888" } },
      "Digital City Center Team"
    )
  );

  return React.createElement(
    Html,
    null,
    React.createElement(Head, null),
    React.createElement(
      Body,
      { style: { backgroundColor: "#f5f5f5", fontFamily: "Arial" } },
      React.createElement(
        Container,
        {
          style: {
            backgroundColor: "#ffffff",
            padding: "30px",
            borderRadius: "10px",
          },
        },
        ...children
      )
    )
  );
}