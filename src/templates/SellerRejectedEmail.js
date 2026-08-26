import React from "react";

import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
} from "@react-email/components";

export default function SellerRejectedEmail({
  businessName,
  reason,
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
          "Seller Application"
        ),

        React.createElement(
          Text,
          null,
          `Unfortunately, your application for "${businessName}" was not approved.`
        ),

        React.createElement(
          Text,
          null,
          `Reason: ${reason}`
        ),

        React.createElement(
          Text,
          null,
          "You can submit another application after correcting the above issues."
        ),

        React.createElement(
          Text,
          {
            style: {
              marginTop: "25px",
              color: "#888888",
            },
          },
          "If you have any questions, please contact our support team."
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