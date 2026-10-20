import Mailgen from "mailgen";
import nodemailer from "nodemailer"
import { ApiError } from "./apiError.js";
import { domainToASCII } from "node:url";

// SMTP domains are case-insensitive IDNA names; local parts retain their case.
// Do not change persisted account-email matching or normalize distinct mailboxes.
const recipientIdentity = recipient => {
  const address = typeof recipient === "string" ? recipient : recipient?.address;
  if (typeof address !== "string") return null;
  const at = address.lastIndexOf("@");
  if (at < 1) return null;
  let local = address.slice(0, at);
  // Nodemailer removes optional local-part quotes and quoted-pair escapes.
  if (local.startsWith('"') && local.endsWith('"')) local = local.slice(1, -1).replace(/\\(.)/g, "$1");
  const domain = domainToASCII(address.slice(at + 1));
  return domain ? `${local}@${domain.toLowerCase()}` : null;
};

const sendingEmail = async (options) => {//options -> obejct
  const mailGenerator = new Mailgen({ // config our email themes and all
    theme : "default",
    product : {
      name : "Task Manager",
      link : "https://taskmanagerlink.com"
    }
  })

  //generator
  const emailTextual = mailGenerator.generatePlaintext(options.mailgenContent)
  const emailHtml = mailGenerator.generate(options.mailgenContent)

  const transporter = nodemailer.createTransport({ //this is our transpoert of email
    host : process.env.MAILTRAP_SMTP_HOST,
    port : process.env.MAILTRAP_SMTP_PORT,
    secure: Number(process.env.MAILTRAP_SMTP_PORT) === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth : { //authentication
      user : process.env.MAILTRAP_SMTP_USER,
      pass : process.env.MAILTRAP_SMTP_PASS
    }
  })

  const mail = {
    from : process.env.MAIL_FROM || "iit.adv.2024@gmail.com",
    to : options.email,
    subject : options.subject,
    text : emailTextual,//if our browser not support html then its pick text , otherwise it take html
    html : emailHtml
  }

  try{
    const result = await transporter.sendMail(mail);
    const intendedRecipient = recipientIdentity(options.email);
    if (!intendedRecipient || !result.accepted?.some(recipient => recipientIdentity(recipient) === intendedRecipient)) {
      throw new Error("Recipient was not accepted");
    }
  }catch(error){
    throw new ApiError(502, "Email could not be sent. Please try again.");
  }
}


//email verification email - content
const emailVerficationMailgenContent = (username, verficationUrl) => {
  return {
    body: {
      name: username,
      intro: "Welcome to Project Camp! We are excited to have you on board",
      action: {
        instructions: "To verify email please click on following button",
        button: {
          color: "#22BC66", // Optional action button color
          text: "Confirm your email",
          link: verficationUrl,
        },
      },
      //bottom part of email
      outro:
        "Need help , or have questions? Just reply to this email , we are love to help.",
    },
  };
};

//forgot password email - content
const forgotPasswordMailgenContent = (username, passwordResetUrl) => {
  return {
    body: {
      name: username,
      intro: "Request to forgot your password",
      action: {
        instructions:
          "To forgot your password please click on following button",
        button: {
          color: "#b72515", // Optional action button color
          text: "forgot your password",
          link: passwordResetUrl,
        },
      },
      //bottom part of email
      outro:
        "Need help , or have questions? Just reply to this email , we are love to help.",
    },
  };
};

export { forgotPasswordMailgenContent
  , emailVerficationMailgenContent 
  , sendingEmail };

// refer npm mailgen doc for format
// for sending them currently to dev enviroment we are using mailtrap , go to sandbox for code template
//and nodemailer for sending (from npm packages)
