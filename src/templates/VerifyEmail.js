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

export default function VerifyEmail({ name, url }) {
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
          "Email Verification"
        ),

        React.createElement(
          Text,
          null,
          `Hello ${name},`
        ),

        React.createElement(
          Text,
          null,
          "Please verify your account by clicking the button below."
        ),

        React.createElement(

          Button,

          {
            href: url,
            style: {
              backgroundColor: "#16a34a",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: "5px",
            },
          },

          "Verify Account"

        ),

        React.createElement(
          Text,
          {
            style: {
              marginTop: "20px",
            },
          },
          "If you didn't create this account, you can safely ignore this email."
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