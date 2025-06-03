import nodemailer from "nodemailer";
import { google } from "googleapis";
import env from "dotenv";
env.config();

const GOOGLE_CLIENT_ID: string = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET: string = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REFRESH: string = process.env.GOOGLE_REFRESH!;
const GOOGLE_REDIRECT: string = process.env.GOOGLE_REDIRECT!;

const OAuth = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT
);

OAuth.setCredentials({ refresh_token: GOOGLE_REFRESH }); // ✅ use refresh_token here

export const sendVerification = async (user: any) => {
  try {
    const accessTokenResponse = await OAuth.getAccessToken();
    const accessToken = accessTokenResponse?.token;

    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: "kossyuzoigwe@gmail.com",
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        refreshToken: GOOGLE_REFRESH,
        accessToken: accessToken!,
      },
    });

    const htmlContent = `
    <!DOCTYPE html>
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
      <h2 style="text-align: center; font-weight: bold; margin: 20px 0">
        Activate Your Account
      </h2>

      <!-- Paragraph -->
      <p
        style="
          text-align: center;
          font-weight: 500;
          max-width: 90%;
          margin: 0 auto 20px auto;
        "
      >
        You're so close to starting your Manwhit Journey. To finish signing up,
        just click the button below to confirm your email address. The link will
        be valid for the next 15 minutes.
      </p>

      <!-- Button -->
      <div style="text-align: center">
        <a
          href="https://manwhit.lemonwares.com.ng/verify/${user.id}"
          target="_blank"
          style="
            display: inline-block;
            padding: 15px 30px;
            margin: 20px 0;
            background-color: blue;
            color: white;
            border-radius: 50px;
            text-decoration: none;
            font-weight: bold;
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
      to: user?.email,
      subject: `Account Activation`,
      html: htmlContent,
    };

    await transport.sendMail(mailer);

    console.log(`Sent!!`);
  } catch (error: any) {
    console.log(`This is error:`, error?.message);
    throw new Error(error?.response?.data?.message || error.message);
  }
};

export const sendResetPassword = async (user: any) => {
  try {
    const accessTokenResponse = await OAuth.getAccessToken();
    const accessToken = accessTokenResponse?.token;

    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: "kossyuzoigwe@gmail.com",
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        refreshToken: GOOGLE_REFRESH,
        accessToken: accessToken!,
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
      to: user?.email,
      subject: `Reset Password`,
      html: htmlContent,
    };

    await transport.sendMail(mailer);

    console.log(`Sent !`);
  } catch (error: any) {
    console.log(`This is error:`, error?.message);
    throw new Error(error?.response?.data?.message || error.message);
  }
};

export const sendToken = async (agent: any) => {
  try {
    const accessTokenResponse = await OAuth.getAccessToken();
    const accessToken = accessTokenResponse?.token;

    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: "kossyuzoigwe@gmail.com",
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        refreshToken: GOOGLE_REFRESH,
        accessToken: accessToken!,
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
      to: agent?.email,
      subject: `Agent Account Activation`,
      html: htmlContent,
    };

    await transport.sendMail(mailer);

    console.log(`Sent !`);
  } catch (error: any) {
    console.log(`This is error:`, error?.message);
    throw new Error(error?.response?.data?.message || error.message);
  }
};
