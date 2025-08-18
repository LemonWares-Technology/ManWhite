"use strict";
// import nodemailer from "nodemailer";
// import { google } from "googleapis";
// import env from "dotenv";
// env.config();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendToken = exports.sendResetPassword = exports.sendPaymentSuccessEmail = exports.sendVerification = void 0;
// const GOOGLE_CLIENT_ID: string = process.env.GOOGLE_CLIENT_ID!;
// const GOOGLE_CLIENT_SECRET: string = process.env.GOOGLE_CLIENT_SECRET!;
// const GOOGLE_REFRESH: string = process.env.GOOGLE_REFRESH!;
// const GOOGLE_REDIRECT: string = process.env.GOOGLE_REDIRECT!;
// const OAuth = new google.auth.OAuth2(
//   GOOGLE_CLIENT_ID,
//   GOOGLE_CLIENT_SECRET,
//   GOOGLE_REDIRECT
// );
// OAuth.setCredentials({ refresh_token: GOOGLE_REFRESH }); // ✅ use refresh_token here
// export const sendVerification = async (user: any) => {
//   try {
//     const accessTokenResponse = await OAuth.getAccessToken();
//     const accessToken = accessTokenResponse?.token;
//     const transport = nodemailer.createTransport({
//       service: "gmail",
//       auth: {
//         type: "OAuth2",
//         user: "kossyuzoigwe@gmail.com",
//         clientId: GOOGLE_CLIENT_ID,
//         clientSecret: GOOGLE_CLIENT_SECRET,
//         refreshToken: GOOGLE_REFRESH,
//         accessToken: accessToken!,
//       },
//     });
//     const htmlContent = `
//     <!DOCTYPE html>
// <html lang="en">
//   <head>
//     <meta charset="UTF-8" />
//     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//     <link
//       rel="stylesheet"
//       href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
//     />
//     <title>Account Activation</title>
//   </head>
//   <body
//     style="
//       width: 100%;
//       margin: 0;
//       font-size: 20px;
//       padding: 0;
//       font-family: 'Courier New', Courier, monospace;
//       background-color: white;
//     "
//   >
//     <div style="max-width: 600px; margin: 0 auto; padding: 20px">
//       <!-- Logo/Top Box -->
//       <div
//         style="
//           width: 100px;
//           height: 50px;
//           border: 1px solid gray;
//           border-radius: 4px;
//           display: flex;
//           justify-content: center;
//           align-items: center;
//           margin: 20px auto;
//         "
//       ></div>
//       <!-- Image Placeholder -->
//       <div
//         style="
//           text-align: center;
//           width: 100%;
//           height: 300px;
//           max-width: 100%;
//           border: 1px solid gray;
//           border-radius: 4px;
//           margin: 30px auto;
//           display: flex;
//           justify-content: center;
//           align-items: center;
//         "
//       >
//         Image Here
//       </div>
//       <!-- Title -->
//       <h2 style="text-align: center; font-weight: bold; margin: 20px 0">
//         Activate Your Account
//       </h2>
//       <!-- Paragraph -->
//       <p
//         style="
//           text-align: center;
//           font-weight: 500;
//           max-width: 90%;
//           margin: 0 auto 20px auto;
//         "
//       >
//         You're so close to starting your Manwhit Journey. To finish signing up,
//         just click the button below to confirm your email address. The link will
//         be valid for the next 15 minutes.
//       </p>
//       <!-- Button -->
//       <div style="text-align: center">
//         <a
//           href="https://manwhit.lemonwares.com.ng/verify/${user.id}"
//           target="_blank"
//           style="
//             display: inline-block;
//             padding: 15px 30px;
//             margin: 20px 0;
//             background-color: blue;
//             color: white;
//             border-radius: 50px;
//             text-decoration: none;
//             font-weight: bold;
//           "
//         >
//           Activate my account
//         </a>
//       </div>
//       <!-- Support Text -->
//       <p
//         style="
//           text-align: center;
//           font-size: 14px;
//           font-weight: 500;
//           max-width: 90%;
//           margin: 0 auto 30px auto;
//         "
//       >
//         If you have any questions, please visit our
//         <span style="color: orange; font-weight: bold">FAQs</span> or email us
//         at
//         <span style="color: orange; font-weight: bold">help@mainwhit.com</span>.
//         Our team can answer questions about your account or help you with your
//         meditation practice.
//       </p>
//       <!-- Divider -->
//       <hr style="width: 80%; margin: 30px auto" />
//       <!-- Social Icons -->
//       <div
//         style="
//           display: flex;
//           justify-content: center;
//           gap: 15px;
//           margin-bottom: 20px;
//           font-size: 20px;
//           color: #444;
//         "
//       >
//         <i class="fab fa-facebook"></i>
//         <i class="fab fa-instagram"></i>
//         <i class="fab fa-twitter"></i>
//         <i class="fab fa-youtube"></i>
//       </div>
//       <!-- Footer -->
//       <div style="text-align: center; color: gray; font-size: 12px">
//         <div>You've received this email as a registered user of Manwhit®</div>
//         <div>
//           Manwhit, Inc., 2145 Michigan Avenue, Santa Monica CA 90404, United
//           States.
//         </div>
//         <div>LemonWares Technology</div>
//         <div>® 2025 Manwhit Inc</div>
//         <div>All rights reserved</div>
//       </div>
//     </div>
//   </body>
// </html>
// `;
//     const mailer = {
//       from: `Francis <kossyuzoigwe@gmail.com>`,
//       to: user?.email,
//       subject: `Account Activation`,
//       html: htmlContent,
//     };
//     await transport.sendMail(mailer);
//     console.log(`Sent!!`);
//   } catch (error: any) {
//     console.log(`This is error:`, error?.message);
//     throw new Error(error?.response?.data?.message || error.message);
//   }
// };
const nodemailer_1 = __importDefault(require("nodemailer"));
const googleapis_1 = require("googleapis");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH = process.env.GOOGLE_REFRESH;
const GOOGLE_REDIRECT = process.env.GOOGLE_REDIRECT;
const SENDER_EMAIL = process.env.SENDER_EMAIL || "kossyuzoigwe@gmail.com";
const SENDER_NAME = process.env.SENDER_NAME || "Manwhit Team";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "help@manwhit.com";
const BASE_URL = process.env.BASE_URL || "https://manwhit.lemonwares.com.ng";
const OAuth = new googleapis_1.google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT);
OAuth.setCredentials({ refresh_token: GOOGLE_REFRESH });
const sendVerification = (user) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const accessTokenResponse = yield OAuth.getAccessToken();
        const accessToken = accessTokenResponse === null || accessTokenResponse === void 0 ? void 0 : accessTokenResponse.token;
        if (!accessToken) {
            throw new Error("Failed to obtain access token");
        }
        const transport = nodemailer_1.default.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: SENDER_EMAIL,
                clientId: GOOGLE_CLIENT_ID,
                clientSecret: GOOGLE_CLIENT_SECRET,
                refreshToken: GOOGLE_REFRESH,
                accessToken: accessToken,
            },
        });
        const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Account Activation</title>
        <style>
          .social-icon {
            display: inline-block;
            width: 24px;
            height: 24px;
            margin: 0 7px;
            background-color: #666;
            border-radius: 50%;
          }
        </style>
      </head>
      <body
        style="
          width: 100%;
          margin: 0;
          font-size: 20px;
          padding: 0;
          font-family: 'Courier New', Courier, monospace;
          background-color: white;
        "
      >
        <div style="max-width: 600px; margin: 0 auto; padding: 20px">
          <!-- Logo/Top Box -->
          <div
            style="
              width: 100px;
              height: 50px;
              border: 1px solid gray;
              border-radius: 4px;
              display: flex;
              justify-content: center;
              align-items: center;
              margin: 20px auto;
              background-color: #f8f9fa;
            "
          >
            <strong style="color: #333;">MANWHIT</strong>
          </div>

          <!-- Image Placeholder -->
          <div
            style="
              text-align: center;
              width: 100%;
              height: 300px;
              max-width: 100%;
              border: 1px solid gray;
              border-radius: 4px;
              margin: 30px auto;
              display: flex;
              justify-content: center;
              align-items: center;
              background-color: #f8f9fa;
              color: #666;
            "
          >
            Welcome to Manwhit
          </div>

          <!-- Title -->
          <h2 style="text-align: center; font-weight: bold; margin: 20px 0; color: #333;">
            Activate Your Account
          </h2>

          <!-- Paragraph -->
          <p
            style="
              text-align: center;
              font-weight: 500;
              max-width: 90%;
              margin: 0 auto 20px auto;
              color: #555;
              line-height: 1.6;
            "
          >
            You're so close to starting your Manwhit Journey. To finish signing up,
            just click the button below to confirm your email address. The link will
            be valid for the next 15 minutes.
          </p>

          <!-- Button -->
          <div style="text-align: center">
            <a
              href="${BASE_URL}/verify/${user.id}"
              target="_blank"
              style="
                display: inline-block;
                padding: 15px 30px;
                margin: 20px 0;
                background-color: #007bff;
                color: white;
                border-radius: 50px;
                text-decoration: none;
                font-weight: bold;
                font-size: 16px;
              "
            >
              Activate my account
            </a>
          </div>

          <!-- Support Text -->
          <p
            style="
              text-align: center;
              font-size: 14px;
              font-weight: 500;
              max-width: 90%;
              margin: 0 auto 30px auto;
              color: #666;
              line-height: 1.6;
            "
          >
            If you have any questions, please visit our
            <span style="color: #ff6b35; font-weight: bold">FAQs</span> or email us
            at
            <a href="mailto:${SUPPORT_EMAIL}" style="color: #ff6b35; font-weight: bold; text-decoration: none">${SUPPORT_EMAIL}</a>.
            Our team can answer questions about your account or help you with your
            meditation practice.
          </p>

          <!-- Divider -->
          <hr style="width: 80%; margin: 30px auto; border: none; height: 1px; background-color: #ddd;" />

          <!-- Social Icons (Email-safe version) -->
          <div
            style="
              text-align: center;
              margin-bottom: 20px;
            "
          >
            <span class="social-icon"></span>
            <span class="social-icon"></span>
            <span class="social-icon"></span>
            <span class="social-icon"></span>
          </div>

          <!-- Footer -->
          <div style="text-align: center; color: #999; font-size: 12px; line-height: 1.4;">
            <div>You've received this email as a registered user of Manwhit®</div>
            <div style="margin: 5px 0;">
              Manwhit, Inc., 2145 Michigan Avenue, Santa Monica CA 90404, United States.
            </div>
            <div>LemonWares Technology</div>
            <div>© 2025 Manwhit Inc</div>
            <div>All rights reserved</div>
          </div>
        </div>
      </body>
    </html>
    `;
        const mailer = {
            from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
            to: user === null || user === void 0 ? void 0 : user.email,
            subject: `Welcome to Manwhit - Activate Your Account`,
            html: htmlContent,
        };
        const result = yield transport.sendMail(mailer);
        console.log(`Verification email sent successfully to ${user === null || user === void 0 ? void 0 : user.email}`);
        return result;
    }
    catch (error) {
        console.error(`Failed to send verification email:`, error === null || error === void 0 ? void 0 : error.message);
        // More specific error handling
        if ((error === null || error === void 0 ? void 0 : error.code) === "EAUTH") {
            throw new Error("Email authentication failed. Please check OAuth credentials.");
        }
        else if ((error === null || error === void 0 ? void 0 : error.code) === "EENVELOPE") {
            throw new Error("Invalid email address provided.");
        }
        else {
            throw new Error(((_b = (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) ||
                error.message ||
                "Failed to send email");
        }
    }
});
exports.sendVerification = sendVerification;
const sendPaymentSuccessEmail = (paymentData, bookingData) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const accessTokenResponse = yield OAuth.getAccessToken();
        const accessToken = accessTokenResponse === null || accessTokenResponse === void 0 ? void 0 : accessTokenResponse.token;
        if (!accessToken) {
            throw new Error("Failed to obtain access token");
        }
        const transport = nodemailer_1.default.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: SENDER_EMAIL,
                clientId: GOOGLE_CLIENT_ID,
                clientSecret: GOOGLE_CLIENT_SECRET,
                refreshToken: GOOGLE_REFRESH,
                accessToken: accessToken,
            },
        });
        // Parse booking data if it's a string
        const booking = typeof bookingData === "string" ? JSON.parse(bookingData) : bookingData;
        // Format date
        const formatDate = (dateString) => {
            return new Date(dateString).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            });
        };
        // Format currency
        const formatAmount = (amount, currency) => {
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: currency,
            }).format(amount);
        };
        const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Payment Confirmation</title>
      </head>
      <body
        style="
          width: 100%;
          margin: 0;
          font-size: 16px;
          padding: 0;
          font-family: 'Arial', sans-serif;
          background-color: #f8f9fa;
          line-height: 1.6;
        "
      >
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: white;">
          <!-- Header -->
          <div
            style="
              text-align: center;
              padding: 30px 0;
              background: linear-gradient(135deg, #007bff, #0056b3);
              border-radius: 8px 8px 0 0;
              margin-bottom: 30px;
            "
          >
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
              ✈️ MANWHIT AREOS
            </h1>
            <p style="color: #e3f2fd; margin: 10px 0 0 0; font-size: 16px;">
              Your Flight is Confirmed!
            </p>
          </div>

          <!-- Success Message -->
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="
              width: 80px; 
              height: 80px; 
              background-color: #28a745; 
              border-radius: 50%; 
              margin: 0 auto 20px; 
              display: flex; 
              align-items: center; 
              justify-content: center;
            ">
              <span style="color: white; font-size: 40px;">✓</span>
            </div>
            <h2 style="color: #333; margin: 0 0 10px 0;">Payment Successful!</h2>
            <p style="color: #666; margin: 0;">
              Thank you for booking with Manwhit Areos. Your payment has been processed successfully.
            </p>
          </div>

          <!-- Payment Details -->
          <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
            <h3 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Payment Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 500;">Transaction ID:</td>
                <td style="padding: 8px 0; color: #333; font-weight: bold;">${paymentData.tx_ref}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 500;">Amount Paid:</td>
                <td style="padding: 8px 0; color: #333; font-weight: bold;">
                  ${formatAmount(paymentData.amount, paymentData.currency)}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 500;">Payment Method:</td>
                <td style="padding: 8px 0; color: #333; font-weight: bold;">
                  ${paymentData.payment_type || "Card"}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 500;">Date:</td>
                <td style="padding: 8px 0; color: #333; font-weight: bold;">
                  ${new Date(paymentData.created_at).toLocaleDateString()}
                </td>
              </tr>
            </table>
          </div>

          <!-- Flight Details (if available) -->
          ${booking
            ? `
          <div style="background-color: #e8f4fd; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
            <h3 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Flight Information</h3>
            ${booking.flightDetails
                ? `
            <div style="margin-bottom: 20px;">
              <h4 style="color: #007bff; margin: 0 0 10px 0;">Outbound Flight</h4>
              <p style="margin: 5px 0; color: #333;">
                <strong>${((_a = booking.flightDetails.departure) === null || _a === void 0 ? void 0 : _a.city) || "Departure"}</strong> 
                → 
                <strong>${((_b = booking.flightDetails.arrival) === null || _b === void 0 ? void 0 : _b.city) || "Arrival"}</strong>
              </p>
              ${booking.flightDetails.departureDate
                    ? `
              <p style="margin: 5px 0; color: #666;">
                Date: ${formatDate(booking.flightDetails.departureDate)}
              </p>
              `
                    : ""}
            </div>
            `
                : ""}
            
            ${booking.guestInfo
                ? `
            <div>
              <h4 style="color: #007bff; margin: 0 0 10px 0;">Passenger Information</h4>
              <p style="margin: 5px 0; color: #333;">
                <strong>Name:</strong> ${booking.guestInfo.firstName} ${booking.guestInfo.lastName}
              </p>
              <p style="margin: 5px 0; color: #333;">
                <strong>Email:</strong> ${booking.guestInfo.email || paymentData.customer.email}
              </p>
              ${booking.guestInfo.phone
                    ? `
              <p style="margin: 5px 0; color: #333;">
                <strong>Phone:</strong> ${booking.guestInfo.phone}
              </p>
              `
                    : ""}
            </div>
            `
                : ""}
          </div>
          `
            : ""}

          <!-- Next Steps -->
          <div style="background-color: #fff3cd; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #ffc107;">
            <h3 style="color: #856404; margin: 0 0 15px 0; font-size: 18px;">What's Next?</h3>
            <ul style="color: #856404; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">You will receive your e-ticket within 24 hours</li>
              <li style="margin-bottom: 8px;">Check-in opens 24 hours before departure</li>
              <li style="margin-bottom: 8px;">Arrive at the airport at least 2 hours before domestic flights</li>
              <li>Keep this confirmation email for your records</li>
            </ul>
          </div>

          <!-- Support -->
          <div style="text-align: center; padding: 20px 0; border-top: 1px solid #dee2e6; margin-top: 30px;">
            <p style="color: #666; margin: 0 0 10px 0;">
              Need help? Contact our support team
            </p>
            <p style="margin: 0;">
              <a href="mailto:support@manwhitareos.com" style="color: #007bff; text-decoration: none; font-weight: bold;">
                support@manwhitareos.com
              </a>
            </p>
          </div>

          <!-- Footer -->
          <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
            <p style="margin: 5px 0;">© 2025 Manwhit Areos. All rights reserved.</p>
            <p style="margin: 5px 0;">This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
    </html>
    `;
        const mailOptions = {
            from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
            to: paymentData.customer.email,
            subject: `Payment Confirmed - Your Flight Booking with Manwhit Areos`,
            html: htmlContent,
        };
        const result = yield transport.sendMail(mailOptions);
        console.log(`Payment confirmation email sent successfully to ${paymentData.customer.email}`);
        return result;
    }
    catch (error) {
        console.error(`Failed to send payment confirmation email:`, error === null || error === void 0 ? void 0 : error.message);
        if ((error === null || error === void 0 ? void 0 : error.code) === "EAUTH") {
            throw new Error("Email authentication failed. Please check OAuth credentials.");
        }
        else if ((error === null || error === void 0 ? void 0 : error.code) === "EENVELOPE") {
            throw new Error("Invalid email address provided.");
        }
        else {
            throw new Error(((_d = (_c = error === null || error === void 0 ? void 0 : error.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) ||
                error.message ||
                "Failed to send email");
        }
    }
});
exports.sendPaymentSuccessEmail = sendPaymentSuccessEmail;
const sendResetPassword = (user) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const accessTokenResponse = yield OAuth.getAccessToken();
        const accessToken = accessTokenResponse === null || accessTokenResponse === void 0 ? void 0 : accessTokenResponse.token;
        const transport = nodemailer_1.default.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: "kossyuzoigwe@gmail.com",
                clientId: GOOGLE_CLIENT_ID,
                clientSecret: GOOGLE_CLIENT_SECRET,
                refreshToken: GOOGLE_REFRESH,
                accessToken: accessToken,
            },
        });
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
    />
    <title>Account Activation</title>
  </head>
  <body
    style="
      width: 100%;
      margin: 0;
      font-size: 18px;
      padding: 0;
      font-family: 'Courier New', Courier, monospace;
      background-color: white;
    "
  >
    <div style="max-width: 600px; margin: 0 auto; padding: 20px">
      <!-- Logo/Top Box -->
      <h1 style="text-align: center; font-weight: bolder">Reset Password</h1>
      <div
        style="
          width: 100px;
          height: 50px;
          border: 1px solid gray;
          border-radius: 4px;
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 20px auto;
        "
      ></div>

      <!-- Image Placeholder -->
      <div
        style="
          text-align: center;
          width: 100%;
          height: 300px;
          max-width: 100%;
          border: 1px solid gray;
          border-radius: 4px;
          margin: 30px auto;
          display: flex;
          justify-content: center;
          align-items: center;
        "
      >
        Image Here
      </div>

      <!-- Title -->

      <!-- Paragraph -->
      <div style="font-weight: 500; max-width: 90%">
        <div>Hey there,</div>
        <div>
          We received a request to reset your password. No worries - it happens
          to the best of us!
        </div>
        <div>
          Click the link below to reset your password. The link will expire in
          15 minutes for your security:
        </div>
        <div
          style="
            display: inline-flex;
            margin-top: 20px;
            margin-bottom: 10px;
            align-items: center;
            gap: 10px;
          "
        >
          <i class="fas fa-hand-point-right" style="color: orange"></i>
          <a
            style="text-decoration: none; color: blue"
            href="https://manwhitareos.web.app/auth/${user.id}/complete"
            target="_blank"
            >Reset Your Password</a
          >
        </div>
      </div>

      <!-- Button -->
      <div>
        If you didn’t request this, you can safely ignore this email — your
        password will remain unchanged.
      </div>

      <!-- Support Text -->
      <p
        style="
          text-align: center;
          padding-top: 20px;
          font-size: 14px;
          font-weight: 500;
          max-width: 90%;
          margin: 0 auto 30px auto;
        "
      >
        If you have any questions, please visit our
        <span style="color: orange; font-weight: bold">FAQs</span> or email us
        at
        <span style="color: orange; font-weight: bold">help@mainwhit.com</span>.
        Our team can answer questions about your account or help you with your
        meditation practice.
      </p>

      <!-- Divider -->
      <hr style="width: 80%; margin: 30px auto" />

      <!-- Social Icons -->
      <div
        style="
          display: flex;
          justify-content: center;
          gap: 15px;
          margin-bottom: 20px;
          font-size: 20px;
          color: #444;
        "
      >
        <i class="fab fa-facebook"></i>
        <i class="fab fa-instagram"></i>
        <i class="fab fa-twitter"></i>
        <i class="fab fa-youtube"></i>
      </div>

      <!-- Footer -->
      <div style="text-align: center; color: gray; font-size: 12px">
        <div>You've received this email as a registered user of Manwhit®</div>
        <div>
          Manwhit, Inc., 2145 Michigan Avenue, Santa Monica CA 90404, United
          States.
        </div>
        <div>LemonWares Technology</div>
        <div>® 2025 Manwhit Inc</div>
        <div>All rights reserved</div>
      </div>
    </div>
  </body>
</html>
`;
        const mailer = {
            from: `Francis <kossyuzoigwe@gmail.com>`,
            to: user === null || user === void 0 ? void 0 : user.email,
            subject: `Reset Password`,
            html: htmlContent,
        };
        yield transport.sendMail(mailer);
        console.log(`Sent !`);
    }
    catch (error) {
        console.log(`This is error:`, error === null || error === void 0 ? void 0 : error.message);
        throw new Error(((_b = (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || error.message);
    }
});
exports.sendResetPassword = sendResetPassword;
const sendToken = (agent) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const accessTokenResponse = yield OAuth.getAccessToken();
        const accessToken = accessTokenResponse === null || accessTokenResponse === void 0 ? void 0 : accessTokenResponse.token;
        const transport = nodemailer_1.default.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: "kossyuzoigwe@gmail.com",
                clientId: GOOGLE_CLIENT_ID,
                clientSecret: GOOGLE_CLIENT_SECRET,
                refreshToken: GOOGLE_REFRESH,
                accessToken: accessToken,
            },
        });
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
    />
    <title>Agent Account Activation</title>
  </head>
  <body
    style="
      width: 100%;
      margin: 0;
      font-size: 18px;
      padding: 0;
      font-family: 'Courier New', Courier, monospace;
      background-color: white;
    "
  >
    <div style="max-width: 600px; margin: 0 auto; padding: 20px">
      <!-- Logo/Top Box -->
      <h1 style="text-align: center; font-weight: bolder">Activate Agent Account</h1>
      <div
        style="
          width: 100px;
          height: 50px;
          border: 1px solid gray;
          border-radius: 4px;
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 20px auto;
        "
      ></div>

      <!-- Image Placeholder -->
      <div
        style="
          text-align: center;
          width: 100%;
          height: 300px;
          max-width: 100%;
          border: 1px solid gray;
          border-radius: 4px;
          margin: 30px auto;
          display: flex;
          justify-content: center;
          align-items: center;
        "
      >
        Image Here
      </div>

      <!-- Title -->

      <!-- Paragraph -->
      <div style="font-weight: 500; max-width: 90%">
        <div>Hey there,</div>
        <div>
          You've been added as an agent on Manwhit Areos, use the token below to activate your account
        </div>
        <div>Token: <span style="color:blue">${`${agent.oneTimeAccessToken}`}</span> </div>
        <div>
          Click the link below to reset your password. The link will expire in
          15 minutes for your security:
        </div>
        

      <!-- Button -->
      <div>
        If you didn’t request this, you can safely ignore this email — your
        password will remain unchanged.
      </div>

      <!-- Support Text -->
      <p
        style="
          text-align: center;
          padding-top: 20px;
          font-size: 14px;
          font-weight: 500;
          max-width: 90%;
          margin: 0 auto 30px auto;
        "
      >
        If you have any questions, please visit our
        <span style="color: orange; font-weight: bold">FAQs</span> or email us
        at
        <span style="color: orange; font-weight: bold">help@mainwhit.com</span>.
        Our team can answer questions about your account or help you with your
        meditation practice.
      </p>

      <!-- Divider -->
      <hr style="width: 80%; margin: 30px auto" />

      <!-- Social Icons -->
      <div
        style="
          display: flex;
          justify-content: center;
          gap: 15px;
          margin-bottom: 20px;
          font-size: 20px;
          color: #444;
        "
      >
        <i class="fab fa-facebook"></i>
        <i class="fab fa-instagram"></i>
        <i class="fab fa-twitter"></i>
        <i class="fab fa-youtube"></i>
      </div>

      <!-- Footer -->
      <div style="text-align: center; color: gray; font-size: 12px">
        <div>You've received this email as a registered user of Manwhit®</div>
        <div>
          Manwhit, Inc., 2145 Michigan Avenue, Santa Monica CA 90404, United
          States.
        </div>
        <div>LemonWares Technology</div>
        <div>® 2025 Manwhit Inc</div>
        <div>All rights reserved</div>
      </div>
    </div>
  </body>
</html>
`;
        const mailer = {
            from: `Francis <kossyuzoigwe@gmail.com>`,
            to: agent === null || agent === void 0 ? void 0 : agent.email,
            subject: `Agent Account Activation`,
            html: htmlContent,
        };
        yield transport.sendMail(mailer);
        console.log(`Sent !`);
    }
    catch (error) {
        console.log(`This is error:`, error === null || error === void 0 ? void 0 : error.message);
        throw new Error(((_b = (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || error.message);
    }
});
exports.sendToken = sendToken;
