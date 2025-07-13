import axios from "axios";
import env from "dotenv";
env.config();

const BREVO_API_KEY: string = process.env.BREVO_API_KEY!;
const SENDER_EMAIL: string =
  process.env.SENDER_EMAIL || "noreply@manwhitaroes.com";
const SENDER_NAME: string = process.env.SENDER_NAME || "ManwhitAroes";

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
  const apiKey = BREVO_API_KEY;
  if (!apiKey) {
    console.warn("Brevo API key not set, skipping email send");
    return;
  }

  const endpoint = "https://api.brevo.com/v3/smtp/email";

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

  const payload = {
    sender: { name: "ManWhit Aroes", email: "no-reply@manwhitaroes.com" },
    to: [{ email: toEmail, name: toName }],
    subject: "Your ManWhit Aroes Flight Booking Confirmation",
    htmlContent: `
      <p>Dear ${toName},</p>
      <p>Thank you for booking your flight with ManWhit Aroes.</p>
      <p><strong>Booking ID:</strong> ${bookingId}</p>
      <p><strong>Flight Details:</strong><br>${flightDetailsSummary}</p>
      <p>We wish you a pleasant journey!</p>
      <p>Best regards,<br>ManWhit Aroes Team</p>
    `,
  };

  try {
    await axios.post(endpoint, payload, {
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
    });
    console.log(`Booking confirmation email sent to ${toEmail}`);
  } catch (emailError) {
    console.error("Failed to send booking confirmation email:", emailError);
  }
}

export async function sendBookingConfirmationEmailx({
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
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("Brevo API key not set, skipping email send");
    return { success: false, error: "API key not configured" };
  }

  const endpoint = "https://api.brevo.com/v3/smtp/email";

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

  const payload = {
    sender: { name: "ManWhit Aroes", email: "no-reply@manwhitaroes.com" },
    to: [{ email: toEmail, name: toName }],
    subject: "Your ManWhit Aroes Flight Booking Confirmation",
    htmlContent: `
      <p>Dear ${toName},</p>
      <p>Thank you for booking your flight with ManWhit Aroes.</p>
      <p><strong>Booking ID:</strong> ${bookingId}</p>
      <p><strong>Flight Details:</strong><br>${flightDetailsSummary}</p>
      <p>We wish you a pleasant journey!</p>
      <p>Best regards,<br>ManWhit Aroes Team</p>
    `,
  };

  // Retry configuration
  const maxRetries = 3;
  const retryDelay = 2000; // 2 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(endpoint, payload, {
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 second timeout
      });

      console.log(
        `Booking confirmation email sent to ${toEmail} on attempt ${attempt}`
      );
      return { success: true, response: response.data };
    } catch (emailError: any) {
      console.error(`Email send attempt ${attempt} failed:`, {
        message: emailError.message,
        code: emailError.code,
        hostname: emailError.hostname,
        syscall: emailError.syscall,
      });

      // Check if it's a DNS/network error that might benefit from retry
      const isNetworkError =
        emailError.code === "EAI_AGAIN" ||
        emailError.code === "ENOTFOUND" ||
        emailError.code === "ECONNRESET" ||
        emailError.code === "ETIMEDOUT";

      // If this is the last attempt or not a network error, don't retry
      if (attempt === maxRetries || !isNetworkError) {
        console.error(
          "Failed to send booking confirmation email after all retries:",
          emailError.message
        );
        return {
          success: false,
          error: emailError.message,
          code: emailError.code,
        };
      }

      // Wait before retrying
      console.log(`Retrying in ${retryDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  return { success: false, error: "Max retries exceeded" };
}

export async function sendBookingConfirmationEmail({
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
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("Brevo API key not set, skipping email send");
    return { success: false, error: "API key not configured" };
  }

  const endpoint = "https://api.brevo.com/v3/smtp/email";

  // Helper to format date
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  // Compose a minimal, clear itinerary summary
  const itineraryHtml = flightOffer.itineraries
    .map((itin: any, idx: number) => {
      const segs = itin.segments
        .map(
          (seg: any) =>
            `<tr>
              <td style="padding:4px 8px;">${seg.departure.iataCode}</td>
              <td style="padding:4px 8px;">${formatDate(seg.departure.at)}</td>
              <td style="padding:4px 8px;">${seg.arrival.iataCode}</td>
              <td style="padding:4px 8px;">${formatDate(seg.arrival.at)}</td>
              <td style="padding:4px 8px;">${seg.carrierCode} ${seg.number}</td>
            </tr>`
        )
        .join("");
      return `
        <h4 style="margin:10px 0 5px 0;">Itinerary ${idx + 1}</h4>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th align="left" style="padding:4px 8px;">From</th>
              <th align="left" style="padding:4px 8px;">Departure</th>
              <th align="left" style="padding:4px 8px;">To</th>
              <th align="left" style="padding:4px 8px;">Arrival</th>
              <th align="left" style="padding:4px 8px;">Flight</th>
            </tr>
          </thead>
          <tbody>
            ${segs}
          </tbody>
        </table>
      `;
    })
    .join("");

  // Only the essentials: greeting, booking ID, itinerary, and support
  const htmlContent = `
    <div style="max-width:600px;margin:0 auto;padding:24px;background:#fff;font-family:Arial,sans-serif;">
      <h2 style="color:#007bff;">Your Flight Booking is Confirmed!</h2>
      <p>Dear <b>${toName}</b>,</p>
      <p>Thank you for booking with ManWhit Aroes. Your reservation is confirmed.</p>
      <table style="margin:18px 0 24px 0;">
        <tr>
          <td style="color:#555;font-weight:500;">Booking ID:</td>
          <td style="color:#222;font-weight:bold;">${bookingId}</td>
        </tr>
      </table>
      <h3 style="color:#333;">Flight Itinerary</h3>
      ${itineraryHtml}
      <div style="margin:24px 0 0 0;padding:16px;background:#f8f9fa;border-radius:6px;">
        <b>Next Steps:</b>
        <ul style="margin:8px 0 0 18px;padding:0;">
          <li>You'll receive your e-ticket within 24 hours.</li>
          <li>Check-in opens 24 hours before departure.</li>
          <li>Arrive at the airport at least 2 hours before your flight.</li>
        </ul>
      </div>
      <p style="margin-top:32px;color:#888;">Need help? Contact us: <a href="mailto:support@manwhitareos.com" style="color:#007bff;">support@manwhitareos.com</a></p>
      <p style="font-size:12px;color:#bbb;margin-top:20px;">&copy; 2025 ManWhit Aroes. All rights reserved.</p>
    </div>
  `;

  const payload = {
    sender: { name: "ManWhit Aroes", email: "no-reply@manwhitaroes.com" },
    to: [{ email: toEmail, name: toName }],
    subject: "Your ManWhit Aroes Flight Booking Confirmation",
    htmlContent,
  };

  // Retry configuration
  const maxRetries = 3;
  const retryDelay = 2000; // 2 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(endpoint, payload, {
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      });
      console.log(
        `Booking confirmation email sent to ${toEmail} on attempt ${attempt}`
      );
      return { success: true, response: response.data };
    } catch (emailError: any) {
      console.error(`Email send attempt ${attempt} failed:`, {
        message: emailError.message,
        code: emailError.code,
        hostname: emailError.hostname,
        syscall: emailError.syscall,
      });
      const isNetworkError =
        emailError.code === "EAI_AGAIN" ||
        emailError.code === "ENOTFOUND" ||
        emailError.code === "ECONNRESET" ||
        emailError.code === "ETIMEDOUT";
      if (attempt === maxRetries || !isNetworkError) {
        console.error(
          "Failed to send booking confirmation email after all retries:",
          emailError.message
        );
        return {
          success: false,
          error: emailError.message,
          code: emailError.code,
        };
      }
      console.log(`Retrying in ${retryDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
  return { success: false, error: "Max retries exceeded" };
}

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
      if (error.code === "EAI_AGAIN" && i < retries - 1) {
        console.warn(`Brevo DNS error, retrying in ${delay}ms...`);
        await new Promise((res) => setTimeout(res, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
};

// Sending email verification code
export const sendVerificationToken: any = async (user: {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  recoveryCode: string;
}): Promise<void> => {
  if (!user || !user.email || !user.id) {
    console.error(`[sendVerificationToken] Invalid user data provided:`, user);
    throw new Error("Invalid user data for verification email.");
  }

  // Log API key status for debugging
  console.log(
    `[sendVerificationToken] Brevo API Key Status: ${
      BREVO_API_KEY
        ? "Loaded (starts with " + BREVO_API_KEY.substring(0, 5) + "...)"
        : "Not Set"
    }`
  );

  if (!BREVO_API_KEY) {
    console.warn(
      "[sendVerificationToken] Brevo API key not set. Skipping verification email send."
    );
    return; // Exit if API key is not available
  }

  const userName =
    `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Account Password Reset</title>
        <style>
          /* Basic Reset & Body Styles */
          body {
            width: 100%;
            margin: 0;
            padding: 0;
            font-family: 'Arial', sans-serif;
            background-color: #f8f9fa; /* Light background for the overall email */
            line-height: 1.6;
            color: #333;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
          }
          table, td, div, p, a {
            mso-line-height-rule: exactly; /* Outlook-specific fix */
          }
          /* Container */
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0,0,0,0.05);
          }
          /* Header */
          .header {
            text-align: center;
            padding: 30px 0;
            background: linear-gradient(135deg,rgb(209, 54, 27),rgb(253, 4, 4));
            border-radius: 8px 8px 0 0;
            margin-bottom: 30px;
            color: white;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: bold;
          }
          .header p {
            margin: 10px 0 0 0;
            font-size: 16px;
            color: #e3f2fd;
          }
          /* Main Content Area */
          .content-area {
            text-align: center;
            padding: 0 20px;
          }
          .content-area h2 {
            font-weight: bold;
            margin: 20px 0 15px 0;
            color: #333;
            font-size: 24px;
          }
          .content-area p {
            font-weight: 500;
            margin: 0 auto 25px auto;
            color: #555;
            line-height: 1.6;
            max-width: 90%;
            font-size: 16px;
          }
          /* Button */
          .button {
            display: inline-block;
            padding: 15px 30px;
            margin: 20px 0;
            background-color:rgb(255, 0, 0); /* Primary blue color */
            color: white;
            border-radius: 50px;
            text-decoration: none;
            font-weight: bold;
            font-size: 17px;
            transition: background-color 0.3s ease;
          }
          .button:hover {
            background-color: #0056b3; /* Darker blue on hover */
          }
          /* Support Section */
          .support-text {
            text-align: center;
            font-size: 14px;
            font-weight: 500;
            max-width: 90%;
            margin: 0 auto 30px auto;
            color: #666;
            line-height: 1.6;
          }
          .support-text a {
            color: #007bff; /* Match primary button color or use a highlight */
            font-weight: bold;
            text-decoration: none;
          }
          /* Footer */
          .footer {
            text-align: center;
            color: #999;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
          }
          .footer p {
            margin: 5px 0;
          }
          /* Responsive Styles */
          @media only screen and (max-width: 620px) {
            .email-container {
              width: 100% !important;
              border-radius: 0 !important;
            }
            .header, .content-area, .support-text, .footer {
              padding-left: 15px !important;
              padding-right: 15px !important;
            }
            .header h1 {
              font-size: 24px !important;
            }
            .button {
              padding: 12px 25px !important;
              font-size: 15px !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>✈️ MANWHITAREOS</h1>
            <p>Reset Account Password</p>
          </div>

          <div class="content-area">
            <h2 style="color: #333;">Password Reset Request</h2>

            <p>Dear ${userName},</p>
            <p>You've requested to reset your password for your Manwhit Areos account. Use the following verification code to complete the process:</p>

            <div class="support-text">
              <div style="font-size: 32px; color: #dc3545; font-weight: bold; text-align: center; margin-top: 15px; margin-bottom: 15px;">
                ${user.recoveryCode}
              </div>
            </div>

            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              This code is valid for a limited time. If you did not request a password reset, please ignore this email or contact support.
            </p>
          </div>

          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Manwhit Areos. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
            <p>Need help? Contact us at <a href="mailto:Email Here too" style="color: #007bff; text-decoration: none;">Email here</a></p>
          </div>
        </div>
      </body>
    </html>
    `;

  try {
    const payload = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL,
      },
      to: [
        {
          email: user.email,
          name: userName,
        },
      ],
      subject: "Manwhit Areos: Your Password Reset Code", // More descriptive subject
      htmlContent: htmlContent, // Provide the full HTML content
      textContent: `
          Dear ${userName},

          You've requested to reset your password for your Manwhit Areos account. Use the following verification code to complete the process:

          ${user.recoveryCode}

          This code is valid for a limited time. If you did not request a password reset, please ignore this email.

          Best regards,
          The Manwhit Areos Team

          Need help? Contact us at Email here

          © ${new Date().getFullYear()} Manwhit Areos. All rights reserved.
        `, // Plain text fallback, updated
      tags: ["password-reset", "verification-code"], // Updated tags
    };

    console.log(
      `[sendVerificationToken] Attempting to send password reset email to ${user.email}.`
    );

    const response: any = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      payload,
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    console.log(
      `[sendVerificationToken] Password reset email sent successfully to ${user.email}. Brevo Message ID: ${response.data.messageId}`
    );
  } catch (error: any) {
    // Enhanced error logging
    console.error(
      `[sendVerificationToken] Failed to send email to ${user.email}.`,
      `Error details:`,
      error.response
        ? JSON.stringify(error.response.data, null, 2)
        : error.message
    );

    if (error?.response?.status === 401) {
      throw new Error(
        "Brevo API authentication failed. Please check your BREVO_API_KEY."
      );
    } else if (error?.response?.status === 400) {
      // Brevo often provides helpful messages for 400 errors
      const brevoErrorMessage =
        error.response.data?.message || "Invalid request parameters.";
      throw new Error(`Brevo API error: ${brevoErrorMessage}`);
    } else {
      throw new Error(
        error.message || "An unexpected error occurred while sending email."
      );
    }
  }
};
