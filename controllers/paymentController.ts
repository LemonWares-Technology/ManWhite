import { Request, Response } from "express";
import axios from "axios";
import { Stripe } from "stripe";
import env from "dotenv";
import { sendPaymentSuccessEmail } from "../config/emailServices";
env.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTER_SECRET!;
const FLUTTERWAVE_PUBLIC_KEY = process.env.FLUTTER_PUBLIC!;

const FRONTEND_URL = process.env.FRONTEND_URL!;

// export const initializePayment = async (
//   req: Request,
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
  res: Response
): Promise<any> => {
  try {
    const { amount, email, bookingData, currency, baseAmountNGN } = req.body;

    if (!amount || !email || !currency) {
      return res.status(400).json({
        status: "error",
        message: "Missing required parameters: amount and email",
      });
    }

    // Validate currency
    const supportedCurrencies = ["NGN", "USD"];
    if (!supportedCurrencies.includes(currency)) {
      return res.status(400).json({
        status: "error",
        message: `Unsupported currency: ${currency}. Supported currencies: ${supportedCurrencies.join(
          ", "
        )}`,
      });
    }

    // Generate a unique transaction reference
    const tx_ref = `FLIGHT-${Date.now()}-${Math.floor(
      Math.random() * 1000000
    )}`;

    // Determine payment options based on currency
    const getPaymentOptions = (curr: string) => {
      switch (curr) {
        case "USD":
          return "card"; // International cards for foreign currencies
        case "NGN":
        default:
          return "card,banktransfer,ussd"; // More options for NGN
      }
    };

    // Initialize payment with Flutterwave
    const response: any = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref,
        amount,
        currency: currency,
        payment_options: getPaymentOptions(currency),
        redirect_url: `${FRONTEND_URL}/auth/success`,
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
          logo: "https://manwhitareos.web.app/logo.png",
        },
        meta: {
          bookingData: JSON.stringify(bookingData),
          originalCurrency: currency,
          baseAmountNGN: baseAmountNGN || (currency === "NGN" ? amount : null),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Return the payment link and configuration
    console.log(`Currency BE: `, currency);
    return res.status(200).json({
      status: "success",
      data: {
        publicKey: FLUTTERWAVE_PUBLIC_KEY,
        reference: tx_ref,
        amount: amount,
        currency: currency,
        paymentLink: response.data.data.link,
      },
    });
  } catch (error: any) {
    console.error(
      "Payment initialization error:",
      error.response?.data || error
    );
    return res.status(500).json({
      status: "error",
      message: "Error initializing payment",
      error: error.response?.data?.message || error.message,
    });
  }
};

// initialize stripe payment
export const initializeStripePayment = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { amount, currency = "USD", email, bookingData } = req.body;

    if (!amount || !email) {
      return res.status(400).json({
        status: "error",
        message: "Missing required parameters: amount and email",
      });
    }

    if (currency !== "USD") {
      return res.status(400).json({
        status: "error",
        message: "This endpoint only supports USD currency",
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // amount in cents
      currency: currency.toLowerCase(),
      receipt_email: email,
      metadata: {
        bookingData: JSON.stringify(bookingData),
      },
    });

    return res.status(200).json({
      status: "success",
      data: {
        clientSecret: paymentIntent.client_secret,
        amount,
        currency,
      },
    });
  } catch (error: any) {
    console.error("Stripe payment initialization error:", error);
    return res.status(500).json({
      status: "error",
      message: "Error initializing Stripe payment",
      error: error.message,
    });
  }
};

// Verifying flutterwave payment
// Updated verify payment function with email integration
export const verifyFlutterwavePaymentWithEmail = async (
  req: Request,
  res: Response
): Promise<any> => {
  // try {
  //   const tx_ref = req.query.tx_ref || req.body.tx_ref;
  //   if (!tx_ref) {
  //     return res.status(400).json({
  //       status: "error",
  //       message: "Missing required parameter: tx_ref",
  //     });
  //   }
  //   // Verify the transaction using Flutterwave's API
  //   const response: any = await axios.get(
  //     `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${tx_ref}`,
  //     {
  //       headers: {
  //         Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
  //       },
  //     }
  //   );
  //   const paymentData = response.data?.data;
  //   if (
  //     response.data.status === "success" &&
  //     paymentData?.status === "successful"
  //   ) {
  //     // Send confirmation email
  //     try {
  //       await sendPaymentSuccessEmail(
  //         paymentData,
  //         paymentData.meta?.bookingData
  //       );
  //     } catch (emailError) {
  //       console.error("Failed to send confirmation email:", emailError);
  //       // Don't fail the entire request if email fails
  //     }
  //     return res.status(200).json({
  //       status: "success",
  //       verified: true,
  //       paymentData,
  //     });
  //   } else {
  //     return res.status(400).json({
  //       status: "error",
  //       verified: false,
  //       message: "Payment not successful or not found",
  //       paymentData,
  //     });
  //   }
  // } catch (error: any) {
  //   console.error("Payment verification error:", error.response?.data || error);
  //   return res.status(500).json({
  //     status: "error",
  //     message: "Error verifying payment",
  //     error: error.response?.data?.message || error.message,
  //   });
  // }
};

// Verifying stipe payment
export const verifyStripePayment = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    // You can receive paymentIntentId as a query parameter or in the body
    const paymentIntentId = req.query.payment_intent || req.body.payment_intent;

    if (!paymentIntentId) {
      return res.status(400).json({
        status: "error",
        message: "Missing required parameter: payment_intent",
      });
    }

    // Retrieve the PaymentIntent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Check if the payment was successful
    if (paymentIntent.status === "succeeded") {
      return res.status(200).json({
        status: "success",
        verified: true,
        paymentData: paymentIntent,
      });
    } else {
      return res.status(400).json({
        status: "error",
        verified: false,
        message: "Payment not successful or not found",
        paymentData: paymentIntent,
      });
    }
  } catch (error: any) {
    console.error("Stripe payment verification error:", error);
    return res.status(500).json({
      status: "error",
      message: "Error verifying Stripe payment",
      error: error.message,
    });
  }
};
