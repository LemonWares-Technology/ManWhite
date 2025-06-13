import axios from "axios";
import env from "dotenv";
env.config();

const BREVO_API_KEY: string = process.env.BREVO_API_KEY!;
const SENDER_EMAIL: string =
  process.env.SENDER_EMAIL || "noreply@manwhitareos.com";
const SENDER_NAME: string = process.env.SENDER_NAME || "Manwhit Areos";

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

    // Brevo API payload
    const emailData = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL,
      },
      to: [
        {
          email: paymentData.customer.email,
          name:
            paymentData.customer.name ||
            `${booking?.guestInfo?.firstName || ""} ${
              booking?.guestInfo?.lastName || ""
            }`.trim() ||
            "Customer",
        },
      ],
      subject: "Payment Confirmed - Your Flight Booking with Manwhit Areos",
      htmlContent: htmlContent,
      textContent: `
        Payment Confirmation - Manwhit Areos
        
        Dear ${paymentData.customer.name || "Customer"},
        
        Thank you for booking with Manwhit Areos! Your payment has been successfully processed.
        
        Payment Details:
        - Transaction ID: ${paymentData.tx_ref}
        - Amount: ${formatAmount(paymentData.amount, paymentData.currency)}
        - Payment Method: ${paymentData.payment_type || "Card"}
        - Date: ${new Date(paymentData.created_at).toLocaleDateString()}
        
        What's Next?
        - You will receive your e-ticket within 24 hours
        - Check-in opens 24 hours before departure
        - Arrive at the airport at least 2 hours before domestic flights
        - Keep this confirmation email for your records
        
        Need help? Contact us at support@manwhitareos.com
        
        © 2025 Manwhit Areos. All rights reserved.
      `,
      tags: ["payment-confirmation", "flight-booking"],
    };

    // Send email using Brevo API
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      emailData,
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    console.log(
      `Payment confirmation email sent successfully to ${paymentData.customer.email}`
    );
    console.log("Brevo response:", response.data);

    return response.data;
  } catch (error: any) {
    console.error(
      `Failed to send payment confirmation email:`,
      error?.response?.data || error?.message
    );

    if (error?.response?.status === 401) {
      throw new Error(
        "Brevo API authentication failed. Please check your API key."
      );
    } else if (error?.response?.status === 400) {
      throw new Error(
        `Brevo API error: ${
          error?.response?.data?.message || "Invalid request"
        }`
      );
    } else {
      throw new Error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to send email"
      );
    }
  }
};

// Account verification email using Brevo
export const sendVerificationEmail = async (user: any) => {
  try {
    const BASE_URL: string =
      process.env.BASE_URL || "https://manwhit.lemonwares.com.ng";
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

    const emailData = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL,
      },
      to: [
        {
          email: user.email,
          name:
            user.name ||
            `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
            "User",
        },
      ],
      subject: "Welcome to Manwhit - Activate Your Account",
      htmlContent: htmlContent,
      textContent: `
        Welcome to Manwhit!
        
        You're so close to starting your Manwhit Journey. To finish signing up, please visit the following link to confirm your email address:
        
        ${BASE_URL}/verify/${user.id}
        
        This link will be valid for the next 15 minutes.
        
        If you have any questions, please email us at ${SUPPORT_EMAIL}.
        
        © 2025 Manwhit Inc. All rights reserved.
      `,
      tags: ["account-verification", "welcome"],
    };

    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      emailData,
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    console.log(`Verification email sent successfully to ${user.email}`);
    return response.data;
  } catch (error: any) {
    console.error(
      `Failed to send verification email:`,
      error?.response?.data || error?.message
    );

    if (error?.response?.status === 401) {
      throw new Error(
        "Brevo API authentication failed. Please check your API key."
      );
    } else if (error?.response?.status === 400) {
      throw new Error(
        `Brevo API error: ${
          error?.response?.data?.message || "Invalid request"
        }`
      );
    } else {
      throw new Error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to send email"
      );
    }
  }
};

// Updated verify payment function with Brevo email integration
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
      // Send confirmation email using Brevo
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
