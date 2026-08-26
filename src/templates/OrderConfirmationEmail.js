import React from "react";

import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
} from "@react-email/components";

export default function OrderConfirmationEmail({
  name,
  orderId,
  total,
}) {
  return React.createElement(

    Html,

    null,

    React.createElement(
      Head,
      null
    ),

    React.createElement(

      Body,

      {
        style: {
          backgroundColor: "#f5f5f5",
          fontFamily: "Arial",
        },
      },

      React.createElement(

        Container,

        {
          style: {
            backgroundColor: "#ffffff",
            padding: "30px",
            borderRadius: "10px",
          },
        },

        React.createElement(
          Heading,
          null,
          "Order Confirmed 🎉"
        ),

        React.createElement(
          Text,
          null,
          `Hello ${name},`
        ),

        React.createElement(
          Text,
          null,
          "Thank you for your purchase."
        ),

        React.createElement(
          Text,
          null,
          `Order Number: ${orderId}`
        ),

        React.createElement(
          Text,
          null,
          `Total: Rs. ${total}`
        ),

        React.createElement(
          Text,
          null,
          "We will notify you once your seller starts processing your order."
        ),

        React.createElement(
          Text,
          {
            style: {
              marginTop: "25px",
              color: "#888888",
            },
          },
          "Digital City Center Team"
        )

      )

    )

  );
}