import { SendMailClient } from "zeptomail";
import env from "dotenv";
env.config();

const ZEPTOMAIL_TOKEN: string = process.env.ZEPTOMAIL_TOKEN!;
const SENDER_EMAIL: string =
  process.env.SENDER_EMAIL || "noreply@manwhitaroes.com";
const SENDER_NAME: string = process.env.SENDER_NAME || "ManwhitAroes";

const ZEPTOMAIL_URL: string = process.env.ZEPTOMAIL_URL || "api.zeptomail.com/";

// Initialize ZeptoMail client
const client = new SendMailClient({ url: ZEPTOMAIL_URL, token: ZEPTOMAIL_TOKEN });

export const sendPaymentSuccessEmail = async (
  paymentData: any,
  bookingData: any
) => {
  try {
    // Parse booking data if it's a string
    const booking =
      typeof bookingData === "string" ? JSON.parse(bookingData) : bookingData;

    // Format date
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    // Format currency
    const formatAmount = (amount: number, currency: string) => {
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
                <td style="padding: 8px 0; color: #333; font-weight: bold;">${
                  paymentData.tx_ref
                }</td>
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
          ${
            booking
              ? `
          <div style="background-color: #e8f4fd; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
            <h3 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Flight Information</h3>
            ${
              booking.flightDetails
                ? `
            <div style="margin-bottom: 20px;">
              <h4 style="color: #007bff; margin: 0 0 10px 0;">Outbound Flight</h4>
              <p style="margin: 5px 0; color: #333;">
                <strong>${
                  booking.flightDetails.departure?.city || "Departure"
                }</strong> 
                → 
                <strong>${
                  booking.flightDetails.arrival?.city || "Arrival"
                }</strong>
              </p>
              ${
                booking.flightDetails.departureDate
                  ? `
              <p style="margin: 5px 0; color: #666;">
                Date: ${formatDate(booking.flightDetails.departureDate)}
              </p>
              `
                  : ""
              }
            </div>
            `
                : ""
            }
            
            ${
              booking.guestInfo
                ? `
            <div>
              <h4 style="color: #007bff; margin: 0 0 10px 0;">Passenger Information</h4>
              <p style="margin: 5px 0; color: #333;">
                <strong>Name:</strong> ${booking.guestInfo.firstName} ${
                    booking.guestInfo.lastName
                  }
              </p>
              <p style="margin: 5px 0; color: #333;">
                <strong>Email:</strong> ${
                  booking.guestInfo.email || paymentData.customer.email
                }
              </p>
              ${
                booking.guestInfo.phone
                  ? `
              <p style="margin: 5px 0; color: #333;">
                <strong>Phone:</strong> ${booking.guestInfo.phone}
              </p>
              `
                  : ""
              }
            </div>
            `
                : ""
            }
          </div>
          `
              : ""
          }

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

    await client.sendMail({
      from: {
        address: SENDER_EMAIL,
        name: SENDER_NAME,
      },
      to: [
        {
          email_address: {
            address: paymentData.customer.email,
            name:
              paymentData.customer.name ||
              `${booking?.guestInfo?.firstName || ""} ${
                booking?.guestInfo?.lastName || ""
              }`.trim() ||
              "Customer",
          },
        },
      ],
      subject: "Payment Confirmed - Your Flight Booking with Manwhit Areos",
      htmlbody: htmlContent,
    });

    console.log(
      `Payment confirmation email sent successfully to ${paymentData.customer.email}`
    );
  } catch (error: any) {
    console.error(
      `Failed to send payment confirmation email:`,
      error?.message || error
    );
    throw new Error(
      error?.message || "Failed to send payment confirmation email"
    );
  }
};

export const sendPaymentSuccessEmailWithRetry = async (
  paymentData: any,
  bookingData: any,
  retries = 3,
  delay = 1000
) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await sendPaymentSuccessEmail(paymentData, bookingData);
    } catch (error: any) {
      if (i < retries - 1) {
        console.warn(`ZeptoMail error, retrying in ${delay}ms...`);
        await new Promise((res) => setTimeout(res, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
};

// Account verification email using ZeptoMail
export const sendVerificationEmail = async (user: any) => {
  try {
    const BASE_URL: string = process.env.BASE_URL || "https://manwhitaroes.com";
    const SUPPORT_EMAIL: string =
      process.env.SUPPORT_EMAIL || "help@manwhit.com";

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

    await client.sendMail({
      from: {
        address: SENDER_EMAIL,
        name: SENDER_NAME,
      },
      to: [
        {
          email_address: {
            address: user.email,
            name:
              user.name ||
              `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
              "User",
          },
        },
      ],
      subject: "Welcome to Manwhit - Activate Your Account",
      htmlbody: htmlContent,
    });

    console.log(`Verification email sent successfully to ${user.email}`);
  } catch (error: any) {
    console.error(`Failed to send verification email:`, error?.message || error);
    throw new Error(error?.message || "Failed to send verification email");
  }
};

// Updated verify payment function with ZeptoMail email integration
export const verifyFlutterwavePaymentWithEmail = async (
  req: Request | any,
  res: Response | any
): Promise<any> => {
  try {
    const tx_ref = req.query.tx_ref || req.body.tx_ref;

    if (!tx_ref) {
      return res.status(400).json({
        status: "error",
        message: "Missing required parameter: tx_ref",
      });
    }

    // Verify the transaction using Flutterwave's API
    const axios = require("axios");
    const response: any = await axios.get(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${tx_ref}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );

    const paymentData = response.data?.data;

    if (
      response.data.status === "success" &&
      paymentData?.status === "successful"
    ) {
      // Send confirmation email using ZeptoMail
      try {
        await sendPaymentSuccessEmail(
          paymentData,
          paymentData.meta?.bookingData
        );
      } catch (emailError) {
        console.error("Failed to send confirmation email:", emailError);
        // Don't fail the entire request if email fails
      }

      return res.status(200).json({
        status: "success",
        verified: true,
        paymentData,
      });
    } else {
      return res.status(400).json({
        status: "error",
        verified: false,
        message: "Payment not successful or not found",
        paymentData,
      });
    }
  } catch (error: any) {
    console.error("Payment verification error:", error.response?.data || error);
    return res.status(500).json({
      status: "error",
      message: "Error verifying payment",
      error: error.response?.data?.message || error.message,
    });
  }
};

export async function sendBookingConfirmationEmails({
  toEmail,
  toName,
  bookingId,
  flightOffer,
}: {
  toEmail: string;
  toName: string;
  bookingId: string;
  flightOffer: any;
}) {
  if (!ZEPTOMAIL_TOKEN) {
    console.warn("ZeptoMail token not set, skipping email send");
    return;
  }

  // Prepare a simple flight details summary for the email
  const flightDetailsSummary = flightOffer.itineraries
    .map((itinerary: any, idx: number) => {
      const segments = itinerary.segments
        .map(
          (segment: any) =>
            `${segment.departure.iataCode} → ${segment.arrival.iataCode} (${
              segment.departure.at.split("T")[0]
            })`
        )
        .join(", ");
      return `Itinerary ${idx + 1}: ${segments}`;
    })
    .join("<br>");

  try {
    await client.sendMail({
      from: {
        address: SENDER_EMAIL,
        name: SENDER_NAME,
      },
      to: [
        {
          email_address: {
            address: toEmail,
            name: toName,
          },
        },
      ],
      subject: "Your ManWhit Aroes Flight Booking Confirmation",
      htmlbody: `
        <p>Dear ${toName},</p>
        <p>Thank you for booking your flight with ManWhit Aroes.</p>
        <p><strong>Booking ID:</strong> ${bookingId}</p>
        <p><strong>Flight Details:</strong><br>${flightDetailsSummary}</p>
        <p>We wish you a pleasant journey!</p>
        <p>Best regards,<br>ManWhit Aroes Team</p>
      `,
    });

    console.log(`Booking confirmation email sent to ${toEmail}`);
  } catch (emailError) {
    console.error("Failed to send booking confirmation email:", emailError);
    throw emailError;
  }
}

// Send password reset token email
export const sendVerificationToken = async (user: any) => {
  try {
    const BASE_URL: string = process.env.BASE_URL || "https://manwhitaroes.com";

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Reset Password</title>
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px;">
          <h1 style="color: #333; text-align: center;">Reset Your Password</h1>
          
          <p style="color: #666; line-height: 1.6;">Hello,</p>
          
          <p style="color: #666; line-height: 1.6;">
            We received a request to reset your password for your Manwhit account. 
            Click the button below to create a new password:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a 
              href="${BASE_URL}/reset-password/${user.resetToken}" 
              style="
                display: inline-block;
                padding: 15px 30px;
                background-color: #007bff;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
              "
            >
              Reset Password
            </a>
          </div>
          
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            This link will expire in 15 minutes for security reasons.
          </p>
          
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            If you didn't request a password reset, please ignore this email or contact support.
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            © 2025 Manwhit Inc. All rights reserved.
          </p>
        </div>
      </body>
    </html>
    `;

    await client.sendMail({
      from: {
        address: SENDER_EMAIL,
        name: SENDER_NAME,
      },
      to: [
        {
          email_address: {
            address: user.email,
            name:
              user.name ||
              `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
              "User",
          },
        },
      ],
      subject: "Reset Your Manwhit Password",
      htmlbody: htmlContent,
    });

    console.log(`Password reset email sent successfully to ${user.email}`);
  } catch (error: any) {
    console.error(
      `Failed to send password reset email:`,
      error?.message || error
    );
    throw new Error(error?.message || "Failed to send password reset email");
  }
};

// Send agent activation token email
export const sendAgentActivationToken = async (agent: any) => {
  try {
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Agent Account Activation</title>
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px;">
          <h1 style="color: #333; text-align: center;">Activate Agent Account</h1>
          
          <p style="color: #666; line-height: 1.6;">Hey there,</p>
          
          <p style="color: #666; line-height: 1.6;">
            You've been added as an agent on Manwhit Areos. Use the token below to activate your account:
          </p>
          
          <div style="text-align: center; margin: 30px 0; background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            <span style="font-size: 24px; font-weight: bold; color: #007bff; letter-spacing: 2px;">
              ${agent.oneTimeAccessToken}
            </span>
          </div>
          
          <p style="color: #666; line-height: 1.6;">
            The link will expire in 15 minutes for your security.
          </p>
          
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            If you didn't request this, you can safely ignore this email.
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            © 2025 Manwhit Inc. All rights reserved.
          </p>
        </div>
      </body>
    </html>
    `;

    await client.sendMail({
      from: {
        address: SENDER_EMAIL,
        name: SENDER_NAME,
      },
      to: [
        {
          email_address: {
            address: agent.email,
            name:
              agent.name ||
              `${agent.firstName || ""} ${agent.lastName || ""}`.trim() ||
              "Agent",
          },
        },
      ],
      subject: "Agent Account Activation - Manwhit Areos",
      htmlbody: htmlContent,
    });

    console.log(`Agent activation email sent successfully to ${agent.email}`);
  } catch (error: any) {
    console.error(
      `Failed to send agent activation email:`,
      error?.message || error
    );
    throw new Error(error?.message || "Failed to send agent activation email");
  }
};

