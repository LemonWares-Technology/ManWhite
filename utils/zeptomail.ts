import { SendMailClient } from "zeptomail";
import env from "dotenv";
import fs from "fs";
import path from "path";
import handlebars from "handlebars";

env.config();

const ZEPTOMAIL_TOKEN: string = process.env.ZEPTOMAIL_TOKEN!;
const SENDER_EMAIL: string =
  process.env.SENDER_EMAIL || "no-reply@manwhitaroes.com";
const SENDER_NAME: string = process.env.SENDER_NAME || "Manwhit Areos";

const ZEPTOMAIL_URL: string =
  process.env.ZEPTOMAIL_URL || "api.zeptomail.com/";

// Initialize ZeptoMail client
const client = new SendMailClient({
  url: ZEPTOMAIL_URL,
  token: ZEPTOMAIL_TOKEN,
});

// Helper to format date
const formatDate = (dateString: string) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Format currency helper
const formatAmount = (amount: number, currency: string) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);
};

// Compile Template Helper
const compileTemplate = async (templateName: string, data: any) => {
  const templatesDir = path.join(__dirname, "../templates");
  const baseTemplatePath = path.join(templatesDir, "base.html");
  const templatePath = path.join(templatesDir, `${templateName}.html`);

  try {
    const baseSource = fs.readFileSync(baseTemplatePath, "utf8");
    const templateSource = fs.readFileSync(templatePath, "utf8");

    const baseTemplate = handlebars.compile(baseSource);
    const template = handlebars.compile(templateSource);

    const body = template(data);
    const year = new Date().getFullYear();

    return baseTemplate({ ...data, body, year });
  } catch (error) {
    console.error(`Error compiling template ${templateName}:`, error);
    throw error;
  }
};

export const sendPaymentSuccessEmail = async (
  paymentData: any,
  bookingData: any
) => {
  try {
    const booking =
      typeof bookingData === "string" ? JSON.parse(bookingData) : bookingData;

    const data = {
      title: "Payment Confirmed",
      paymentData,
      amount: formatAmount(paymentData.amount, paymentData.currency),
      date: new Date(paymentData.created_at).toLocaleDateString(),
      booking,
      flightDate: booking?.flightDetails?.departureDate
        ? formatDate(booking.flightDetails.departureDate)
        : "",
    };

    const htmlContent = await compileTemplate("payment-success", data);

    await client.sendMail({
      from: { address: SENDER_EMAIL, name: SENDER_NAME },
      to: [
        {
          email_address: {
            address: paymentData.customer.email,
            name: paymentData.customer.name || "Customer",
          },
        },
      ],
      subject: "Payment Confirmed - Manwhit Areos",
      htmlbody: htmlContent,
    });

    console.log(
      `Payment confirmation email sent to ${paymentData.customer.email}`
    );
  } catch (error: any) {
    console.error(
      "Failed to send payment confirmation email:",
      error?.message || error
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
        console.warn(`ZeptoMail retry ${i + 1}/${retries}...`);
        await new Promise((res) => setTimeout(res, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
};

export const sendVerificationEmail = async (user: any) => {
  try {
    const BASE_URL: string = process.env.BASE_URL || "https://manwhitaroes.com";
    
    const data = {
      title: "Account Activation",
      verificationUrl: `${BASE_URL}/verify/${user.id}`,
    };

    const htmlContent = await compileTemplate("account-activation", data);

    await client.sendMail({
      from: { address: SENDER_EMAIL, name: SENDER_NAME },
      to: [
        {
          email_address: {
            address: user.email,
            name: user.name || "User",
          },
        },
      ],
      subject: "Activate Your Account - Manwhit Areos",
      htmlbody: htmlContent,
    });

    console.log(`Verification email sent to ${user.email}`);
  } catch (error: any) {
    console.error("Failed to send verification email:", error?.message || error);
    throw new Error(error?.message || "Failed to send verification email");
  }
};

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
      try {
        await sendPaymentSuccessEmail(
          paymentData,
          paymentData.meta?.bookingData
        );
      } catch (emailError) {
        console.error("Failed to send confirmation email:", emailError);
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

  const flightDetailsSummary = flightOffer.itineraries
    .map((itinerary: any, idx: number) => {
      const segments = itinerary.segments
        .map(
          (segment: any) =>
            `<strong>${segment.departure.iataCode}</strong> → <strong>${
              segment.arrival.iataCode
            }</strong> (${segment.departure.at.split("T")[0]})`
        )
        .join(" <br> ");
      return `<div style="margin-bottom: 10px;">${segments}</div>`;
    })
    .join("");

  const data = {
    title: "Flight Booking Confirmation",
    name: toName,
    bookingId,
    flightDetailsSummary,
  };

  const htmlContent = await compileTemplate("flight-confirmation", data);

  try {
    await client.sendMail({
      from: { address: SENDER_EMAIL, name: SENDER_NAME },
      to: [{ email_address: { address: toEmail, name: toName } }],
      subject: `Flight Booking Confirmation (${bookingId}) - Manwhit Areos`,
      htmlbody: htmlContent,
    });
    console.log(`Flight booking confirmation sent to ${toEmail}`);
  } catch (error) {
    console.error("Failed to send flight booking email:", error);
    throw error;
  }
}

export const sendVerificationToken = async (user: any) => {
  try {
    const BASE_URL: string = process.env.BASE_URL || "https://manwhitaroes.com";

    const data = {
      title: "Reset Password",
      resetUrl: `${BASE_URL}/reset-password/${user.resetToken}`,
    };

    const htmlContent = await compileTemplate("reset-password", data);

    await client.sendMail({
      from: { address: SENDER_EMAIL, name: SENDER_NAME },
      to: [{ email_address: { address: user.email, name: user.name || "User" } }],
      subject: "Reset Your Manwhit Password",
      htmlbody: htmlContent,
    });

    console.log(`Password reset email sent to ${user.email}`);
  } catch (error: any) {
    console.error("Failed to send password reset email:", error);
    throw new Error("Failed to send password reset email");
  }
};

export const sendAgentActivationToken = async (agent: any) => {
  try {
    const data = {
      title: "Agent Activation",
      token: agent.oneTimeAccessToken,
    };

    const htmlContent = await compileTemplate("agent-activation", data);

    await client.sendMail({
      from: { address: SENDER_EMAIL, name: SENDER_NAME },
      to: [{ email_address: { address: agent.email, name: agent.name || "Agent" } }],
      subject: "Agent Account Activation - Manwhit Areos",
      htmlbody: htmlContent,
    });
    console.log(`Agent activation email sent to ${agent.email}`);
  } catch (error: any) {
    console.error("Failed to send agent activation email:", error);
    throw new Error("Failed to send agent activation email");
  }
};

export const sendHotelBookingConfirmationEmail = async (bookingData: any, user: any) => {
  try {
    const { hotelName, checkInDate, checkOutDate, guests, totalAmount, currency, bookingId } = bookingData;
    const ref = bookingId || bookingData.id || "N/A";

    const data = {
      title: "Hotel Booking Confirmation",
      name: user.name || "Guest",
      hotelName,
      bookingId: ref,
      checkInDate: formatDate(checkInDate),
      checkOutDate: formatDate(checkOutDate),
      guestCount: guests?.length || 1,
      totalAmount: formatAmount(totalAmount || 0, currency || 'USD'),
    };

    const htmlContent = await compileTemplate("hotel-confirmation", data);

    await client.sendMail({
      from: { address: SENDER_EMAIL, name: SENDER_NAME },
      to: [{ email_address: { address: user.email, name: user.name || "Guest" } }],
      subject: `Hotel Booking Confirmation - ${hotelName}`,
      htmlbody: htmlContent,
    });
    console.log(`Hotel confirmation email sent to ${user.email}`);
  } catch (error) {
    console.error("Failed to send hotel confirmation email:", error);
  }
};

export const sendCarBookingConfirmationEmail = async (bookingData: any, user: any) => {
  try {
    const { carModel, pickupLocation, dropoffLocation, pickupDate, totalAmount, currency, bookingId } = bookingData;
    const ref = bookingId || bookingData.id || "N/A";

    const data = {
      title: "Car Rental Confirmation",
      name: user.name || "Customer",
      carModel: carModel || "Vehicle",
      bookingId: ref,
      pickupLocation,
      dropoffLocation,
      pickupDate: formatDate(pickupDate),
      totalAmount: formatAmount(totalAmount || 0, currency || 'USD'),
    };

    const htmlContent = await compileTemplate("car-confirmation", data);

    await client.sendMail({
      from: { address: SENDER_EMAIL, name: SENDER_NAME },
      to: [{ email_address: { address: user.email, name: user.name || "Customer" } }],
      subject: `Car Rental Confirmation - ${ref}`,
      htmlbody: htmlContent,
    });
    console.log(`Car confirmation email sent to ${user.email}`);
  } catch (error) {
    console.error("Failed to send car confirmation email:", error);
  }
};

export const sendTourBookingConfirmationEmail = async (bookingData: any, user: any) => {
  try {
    const { tourName, date, participants, totalAmount, currency, bookingId } = bookingData;
    const ref = bookingId || bookingData.id || "N/A";

    const data = {
      title: "Tour Booking Confirmation",
      name: user.name || "Traveler",
      tourName,
      bookingId: ref,
      date: formatDate(date),
      participants: participants || 1,
      totalAmount: formatAmount(totalAmount || 0, currency || 'USD'),
    };

    const htmlContent = await compileTemplate("tour-confirmation", data);

    await client.sendMail({
      from: { address: SENDER_EMAIL, name: SENDER_NAME },
      to: [{ email_address: { address: user.email, name: user.name || "Traveler" } }],
      subject: `Tour Booking Confirmation - ${tourName}`,
      htmlbody: htmlContent,
    });
    console.log(`Tour confirmation email sent to ${user.email}`);
  } catch (error) {
    console.error("Failed to send tour confirmation email:", error);
  }
};

