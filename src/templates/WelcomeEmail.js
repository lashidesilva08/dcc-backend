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


export default function WelcomeEmail({name}) {

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
style:{
backgroundColor:"#f5f5f5",
fontFamily:"Arial"
}
},

React.createElement(

Container,

{
style:{
backgroundColor:"#ffffff",
padding:"30px",
borderRadius:"10px"
}
},


React.createElement(
Heading,
null,
"Welcome to Digital City Center 🎉"
),


React.createElement(
Text,
null,
`Hello ${name}`
),


React.createElement(
Text,
null,
"Thank you for registering with Digital City Center."
),


React.createElement(

Button,

{
href:process.env.FRONTEND_URL,
style:{
backgroundColor:"#2563eb",
color:"#ffffff",
padding:"12px 20px",
borderRadius:"5px"
}
},

"Visit Website"

)

)

)

);

}