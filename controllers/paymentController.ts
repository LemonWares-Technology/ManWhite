import { Request, Response } from "express";
import axios from "axios";
import { Stripe } from "stripe";
import env from "dotenv";
import {
  sendPaymentSuccessEmail,
  sendPaymentSuccessEmailWithRetry,
} from "../utils/zeptomail";
import { prisma } from "../lib/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";
env.config();

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_placeholder",
);

const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTER_SECRET!;
const FLUTTERWAVE_PUBLIC_KEY = process.env.FLUTTER_PUBLIC!;

const FRONTEND_URL = process.env.FRONTEND_URL!;

// export const initializePayment = async (
//   req: Request,the
//   res: Response
// ): Promise<any> => {
//   try {
//     const { amount, email, bookingData } = req.body;

//     if (!amount || !email) {
//       return res.status(400).json({
//         status: "error",
//         message: "Missing required parameters: amount and email",
//       });
//     }

//     // Generate a unique transaction reference
//     const tx_ref = `FLIGHT-${Date.now()}-${Math.floor(
//       Math.random() * 1000000
//     )}`;

//     // Initialize payment with Flutterwave
//     const response: any = await axios.post(
//       "https://api.flutterwave.com/v3/payments",
//       {
//         tx_ref,
//         amount,
//         currency: "NGN",
//         payment_options: "card",
//         redirect_url: `${FRONTEND_URL}/auth/success`,
//         customer: {
//           email,
//           phone_number: bookingData?.guestInfo?.phone,
//           name: bookingData?.guestInfo?.firstName
//             ? `${bookingData.guestInfo.firstName} ${bookingData.guestInfo.lastName}`
//             : "Guest User",
//         },
//         // customizations: {
//         //   title: "Manwhit Areos Flight Booking",
//         //   description: "Flight booking payment",
//         //   logo: "https://manwhitareos.web.app/logo.png"
//         // },
//         meta: {
//           bookingData: JSON.stringify(bookingData),
//         },
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     // Return the payment link and configuration
//     return res.status(200).json({
//       status: "success",
//       data: {
//         publicKey: FLUTTERWAVE_PUBLIC_KEY,
//         reference: tx_ref,
//         amount: amount,
//         currency: "USD",
//         paymentLink: response.data.data.link,
//       },
//     });
//   } catch (error: any) {
//     console.error(
//       "Payment initialization error:",
//       error.response?.data || error
//     );
//     return res.status(500).json({
//       status: "error",
//       message: "Error initializing payment",
//       error: error.response?.data?.message || error.message,
//     });
//   }
// };

export const initializePayment = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const { amount, email, bookingData, currency, baseAmountNGN } = req.body;

    if (!amount || !email || !currency) {
      return sendError(
        res,
        "Missing required parameters: amount, email, or currency",
        400,
      );
    }

    const supportedCurrencies = ["NGN", "USD"];
    if (!supportedCurrencies.includes(currency)) {
      return sendError(
        res,
        `Unsupported currency: ${currency}. Supported currencies: ${supportedCurrencies.join(", ")}`,
        400,
      );
    }

    const tx_ref = `FLIGHT-${Date.now()}-${Math.floor(
      Math.random() * 1000000,
    )}`;

    // Check if we're in development mode or keys are not set
    const isDevelopmentMode =
      process.env.NODE_ENV === "development" &&
      (!process.env.FLUTTER_SECRET ||
        !process.env.FLUTTERWAVE_SECRET_KEY ||
        process.env.FLUTTER_SECRET?.includes("SANDBOXDEMOKEY") ||
        process.env.FLUTTERWAVE_SECRET_KEY?.includes("SANDBOXDEMOKEY"));

    if (isDevelopmentMode) {
      // Mock payment for development
      console.log("🧪 DEVELOPMENT MODE: Using mock payment flow");
      console.log("💰 Mock payment details:", {
        tx_ref,
        amount,
        currency,
        email,
        bookingData: JSON.stringify(bookingData).substring(0, 100) + "...",
      });

      // Return mock payment response
      return sendSuccess(res, "Payment initialized successfully (MOCK)", {
        publicKey: "MOCK_PUBLIC_KEY",
        reference: tx_ref,
        amount,
        currency,
        paymentLink: `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/success?tx_ref=${tx_ref}&status=successful&transaction_id=mock_${tx_ref}`,
      });
    }

    const getPaymentOptions = (curr: string) => {
      switch (curr) {
        case "USD":
          return "card";
        case "NGN":
        default:
          return "card,banktransfer,ussd";
      }
    };

    const response: any = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref,
        amount,
        currency,
        payment_options: getPaymentOptions(currency),
        redirect_url: `${
          process.env.FRONTEND_URL || FRONTEND_URL
        }/auth/success`,
        customer: {
          email,
          phone_number: bookingData?.guestInfo?.phone,
          name: bookingData?.guestInfo?.firstName
            ? `${bookingData.guestInfo.firstName} ${bookingData.guestInfo.lastName}`
            : "Guest User",
        },
        customizations: {
          title: "Manwhit Areos Flight Booking",
          description: `Flight booking payment (${currency})`,
          logo: process.env.LOGO_URL,
        },
        meta: {
          bookingData: JSON.stringify(bookingData),
          originalCurrency: currency,
          baseAmountNGN: baseAmountNGN || (currency === "NGN" ? amount : null),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${
            process.env.FLUTTERWAVE_SECRET_KEY || FLUTTERWAVE_SECRET_KEY
          }`,
          "Content-Type": "application/json",
        },
      },
    );

    return sendSuccess(res, "Payment initialized successfully", {
      publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || FLUTTERWAVE_PUBLIC_KEY,
      reference: tx_ref,
      amount,
      currency,
      paymentLink: response.data.data.link,
    });
  } catch (error: any) {
    console.error(
      "Payment initialization error:",
      error?.response?.data || error,
    );
    return sendError(res, "Error initializing payment", 500, error);
  }
};

// initialize stripe payment
export const initializeStripePayment = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const { amount, currency = "USD", email, bookingData } = req.body;

    if (!amount || !email) {
      return sendError(
        res,
        "Missing required parameters: amount and email",
        400,
      );
    }

    if (currency !== "USD") {
      return sendError(res, "This endpoint only supports USD currency", 400);
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // amount in cents
      currency: currency.toLowerCase(),
      receipt_email: email,
      metadata: {
        bookingData: JSON.stringify(bookingData),
      },
    });

    return sendSuccess(res, "Stripe payment initialized successfully", {
      clientSecret: paymentIntent.client_secret,
      amount,
      currency,
    });
  } catch (error: any) {
    console.error("Stripe payment initialization error:", error);
    return sendError(res, "Error initializing Stripe payment", 500, error);
  }
};

// Verifying flutterwave payment
// Updated verify payment function with email integration
// 1. Route Definition (change to POST)

// 2. Verification Function
// export const verifyFlutterwavePaymentWithEmail = async (
//   req: Request,
//   res: Response
// ): Promise<Response | any> => {
//   // Stronger return type
//   try {
//     // Validate input
//     const tx_ref = req.query.tx_ref || req.body.tx_ref;

//     if (!tx_ref || typeof tx_ref !== "string") {
//       return res.status(400).json({
//         success: false,
//         error: "VALIDATION_ERROR",
//         message: "Valid transaction reference is required",
//       });
//     }

//     // Verify transaction
//     const response: any = await axios.get(
//       `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(
//         tx_ref
//       )}`,
//       {
//         headers: {
//           Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
//         },
//         timeout: 10000, // 10 second timeout
//       }
//     );

//     const paymentData = response.data?.data;

//     // Check payment status
//     if (
//       !paymentData ||
//       response.data.status !== "success" ||
//       paymentData.status !== "successful"
//     ) {
//       return res.status(400).json({
//         success: false,
//         error: "PAYMENT_FAILED",
//         message: "Payment verification failed or payment not successful",
//         data: paymentData || null,
//       });
//     }

//     // Async email sending (don't await)
//     sendPaymentSuccessEmail(paymentData, paymentData.meta?.bookingData).catch(
//       (error) => console.error("Email sending failed:", error)
//     );

//     return res.status(200).json({
//       success: true,
//       message: "Payment verified successfully",
//       data: {
//         reference: paymentData.tx_ref,
//         amount: paymentData.amount,
//         currency: paymentData.currency,
//         status: paymentData.status,
//         // Include only necessary fields
//       },
//     });
//   } catch (error: any) {
//     console.error("Payment verification error:", error);

//     // Handle different error types
//     if (error.response) {
//       // Flutterwave API error
//       return res.status(502).json({
//         success: false,
//         error: "GATEWAY_ERROR",
//         message: "Payment gateway error",
//         details: error.response.data?.message || "Flutterwave API error",
//       });
//     } else if (error.request) {
//       // No response received
//       return res.status(504).json({
//         success: false,
//         error: "NETWORK_ERROR",
//         message: "No response from payment gateway",
//       });
//     } else {
//       // Setup error
//       return res.status(500).json({
//         success: false,
//         error: "SERVER_ERROR",
//         message: "Internal server error during verification",
//       });
//     }
//   }
// };

export const verifyFlutterwavePaymentWithEmail = async (
  req: Request,
  res: Response,
): Promise<Response | any> => {
  try {
    const tx_ref = req.query.tx_ref || req.body.tx_ref;

    if (!tx_ref || typeof tx_ref !== "string") {
      return sendError(res, "Valid transaction reference is required", 400, {
        error: "VALIDATION_ERROR",
      });
    }

    const response: any = await axios.get(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(
        tx_ref,
      )}`,
      {
        headers: {
          Authorization: `Bearer ${
            process.env.FLUTTERWAVE_SECRET_KEY || FLUTTERWAVE_SECRET_KEY
          }`,
        },
        timeout: 10000,
      },
    );

    const paymentData = response.data?.data;

    if (
      !paymentData ||
      response.data.status !== "success" ||
      paymentData.status !== "successful"
    ) {
      return sendError(
        res,
        "Payment verification failed or payment not successful",
        400,
        { error: "PAYMENT_FAILED", data: paymentData || null },
      );
    }

    // Parse meta.bookingData if it's a string
    let bookingData = paymentData.meta?.bookingData;
    if (typeof bookingData === "string") {
      try {
        bookingData = JSON.parse(bookingData);
      } catch {
        bookingData = null;
      }
    }

    const userId = bookingData?.userId;
    if (userId) {
      await prisma.flightCart.deleteMany({ where: { userId } });
    }

    // Send payment success email only if customer email exists
    if (paymentData.customer?.email) {
      try {
        await sendPaymentSuccessEmailWithRetry(paymentData, bookingData);
      } catch (emailError) {
        // Log but don't block the response
        console.error("Email sending failed:", emailError);
      }
    }

    return sendSuccess(res, "Payment verified successfully", {
      reference: paymentData.tx_ref,
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: paymentData.status,
    });
  } catch (error: any) {
    console.error("Payment verification error:", error);

    if (error.code === "EAI_AGAIN") {
      return sendError(res, "DNS/network error. Please try again.", 504, {
        error: "NETWORK_ERROR",
      });
    }

    if (error.response) {
      return sendError(
        res,
        error.response.data?.message || "Payment gateway error",
        502,
        { error: "GATEWAY_ERROR" },
      );
    } else if (error.request) {
      return sendError(res, "No response from payment gateway", 504, {
        error: "NETWORK_ERROR",
      });
    } else {
      return sendError(
        res,
        "Internal server error during verification",
        500,
        error,
      );
    }
  }
};

// Verifying stipe payment
export const verifyStripePayment = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    // You can receive paymentIntentId as a query parameter or in the body
    const paymentIntentId = req.query.payment_intent || req.body.payment_intent;

    if (!paymentIntentId) {
      return sendError(res, "Missing required parameter: payment_intent", 400);
    }

    // Retrieve the PaymentIntent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Check if the payment was successful
    if (paymentIntent.status === "succeeded") {
      return sendSuccess(res, "Payment verified successfully", {
        verified: true,
        paymentData: paymentIntent,
      });
    } else {
      return sendError(res, "Payment not successful or not found", 400, {
        verified: false,
        paymentData: paymentIntent,
      });
    }
  } catch (error: any) {
    console.error("Stripe payment verification error:", error);
    return sendError(res, "Error verifying Stripe payment", 500, error);
  }
};
