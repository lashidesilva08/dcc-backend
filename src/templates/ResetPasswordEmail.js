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

export default function ResetPasswordEmail({ name, resetUrl }) {
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
          backgroundColor: "#f4f4f4",
          fontFamily: "Arial",
        },
      },

      React.createElement(

        Container,

        {
          style: {
            backgroundColor: "#ffffff",
            padding: "30px",
            borderRadius: "8px",
          },
        },

        React.createElement(
          Heading,
          null,
          "Password Reset"
        ),

        React.createElement(
          Text,
          null,
          `Hello ${name},`
        ),

        React.createElement(
          Text,
          null,
          "We received a request to reset your password."
        ),

        React.createElement(

          Button,

          {
            href: resetUrl,
            style: {
              backgroundColor: "#2563EB",
              color: "#ffffff",
              padding: "12px 22px",
              borderRadius: "5px",
            },
          },

          "Reset Password"

        ),

        React.createElement(
          Text,
          {
            style: {
              marginTop: "20px",
            },
          },
          "If you didn't request this, you can safely ignore this email."
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