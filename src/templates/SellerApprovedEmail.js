import React from "react";

import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
} from "@react-email/components";

export default function SellerApprovedEmail({ businessName }) {
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
          "Seller Account Approved 🎉"
        ),

        React.createElement(
          Text,
          null,
          "Congratulations!"
        ),

        React.createElement(
          Text,
          null,
          `Your business "${businessName}" has been approved successfully.`
        ),

        React.createElement(
          Text,
          null,
          "You can now log in and start managing your products and orders."
        ),

        React.createElement(

          Button,

          {
            href: process.env.FRONTEND_URL,
            style: {
              backgroundColor: "#16A34A",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: "5px",
            },
          },

          "Login"

        ),

        React.createElement(
          Text,
          {
            style: {
              marginTop: "25px",
              color: "#888888",
            },
          },
          "Thank you for joining Digital City Center."
        ),

        React.createElement(
          Text,
          {
            style: {
              color: "#888888",
            },
          },
          "Digital City Center Team"
        )

      )

    )

  );
}