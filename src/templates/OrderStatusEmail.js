import React from "react";

import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
} from "@react-email/components";

export default function OrderStatusEmail({
  name,
  orderId,
  status,
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
          "Order Status Updated"
        ),

        React.createElement(
          Text,
          null,
          `Hello ${name},`
        ),

        React.createElement(
          Text,
          null,
          "Your order status has been updated."
        ),

        React.createElement(
          Text,
          null,
          `Order ID: ${orderId}`
        ),

        React.createElement(
          Heading,
          {
            style: {
              color: "#2563EB",
              fontSize: "22px",
            },
          },
          status
        ),

        React.createElement(
          Text,
          null,
          "Thank you for shopping with Digital City Center."
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