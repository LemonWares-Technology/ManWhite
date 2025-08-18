"use strict";
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
exports.verifyStripePayment = exports.verifyFlutterwavePaymentWithEmail = exports.initializeStripePayment = exports.initializePayment = void 0;
const axios_1 = __importDefault(require("axios"));
const stripe_1 = require("stripe");
const dotenv_1 = __importDefault(require("dotenv"));
const brevo_1 = require("../utils/brevo");
const client_1 = require("@prisma/client");
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
const stripe = new stripe_1.Stripe(process.env.STRIPE_SECRET_KEY);
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTER_SECRET;
const FLUTTERWAVE_PUBLIC_KEY = process.env.FLUTTER_PUBLIC;
const FRONTEND_URL = process.env.FRONTEND_URL;
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
const initializePayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    try {
        const { amount, email, bookingData, currency, baseAmountNGN } = req.body;
        if (!amount || !email || !currency) {
            return res.status(400).json({
                status: "error",
                message: "Missing required parameters: amount, email, or currency",
            });
        }
        const supportedCurrencies = ["NGN", "USD"];
        if (!supportedCurrencies.includes(currency)) {
            return res.status(400).json({
                status: "error",
                message: `Unsupported currency: ${currency}. Supported currencies: ${supportedCurrencies.join(", ")}`,
            });
        }
        const tx_ref = `FLIGHT-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        const getPaymentOptions = (curr) => {
            switch (curr) {
                case "USD":
                    return "card";
                case "NGN":
                default:
                    return "card,banktransfer,ussd";
            }
        };
        const response = yield axios_1.default.post("https://api.flutterwave.com/v3/payments", {
            tx_ref,
            amount,
            currency,
            payment_options: getPaymentOptions(currency),
            redirect_url: `${process.env.FRONTEND_URL || FRONTEND_URL}/auth/success`,
            customer: {
                email,
                phone_number: (_a = bookingData === null || bookingData === void 0 ? void 0 : bookingData.guestInfo) === null || _a === void 0 ? void 0 : _a.phone,
                name: ((_b = bookingData === null || bookingData === void 0 ? void 0 : bookingData.guestInfo) === null || _b === void 0 ? void 0 : _b.firstName)
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
        }, {
            headers: {
                Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY || FLUTTERWAVE_SECRET_KEY}`,
                "Content-Type": "application/json",
            },
        });
        return res.status(200).json({
            status: "success",
            data: {
                publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || FLUTTERWAVE_PUBLIC_KEY,
                reference: tx_ref,
                amount,
                currency,
                paymentLink: response.data.data.link,
            },
        });
    }
    catch (error) {
        console.error("Payment initialization error:", ((_c = error === null || error === void 0 ? void 0 : error.response) === null || _c === void 0 ? void 0 : _c.data) || error);
        return res.status(500).json({
            status: "error",
            message: "Error initializing payment",
            error: ((_e = (_d = error === null || error === void 0 ? void 0 : error.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.message) || error.message,
        });
    }
});
exports.initializePayment = initializePayment;
// initialize stripe payment
const initializeStripePayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const paymentIntent = yield stripe.paymentIntents.create({
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
    }
    catch (error) {
        console.error("Stripe payment initialization error:", error);
        return res.status(500).json({
            status: "error",
            message: "Error initializing Stripe payment",
            error: error.message,
        });
    }
});
exports.initializeStripePayment = initializeStripePayment;
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
const verifyFlutterwavePaymentWithEmail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const tx_ref = req.query.tx_ref || req.body.tx_ref;
        if (!tx_ref || typeof tx_ref !== "string") {
            return res.status(400).json({
                success: false,
                error: "VALIDATION_ERROR",
                message: "Valid transaction reference is required",
            });
        }
        const response = yield axios_1.default.get(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(tx_ref)}`, {
            headers: {
                Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY || FLUTTERWAVE_SECRET_KEY}`,
            },
            timeout: 10000,
        });
        const paymentData = (_a = response.data) === null || _a === void 0 ? void 0 : _a.data;
        if (!paymentData ||
            response.data.status !== "success" ||
            paymentData.status !== "successful") {
            return res.status(400).json({
                success: false,
                error: "PAYMENT_FAILED",
                message: "Payment verification failed or payment not successful",
                data: paymentData || null,
            });
        }
        // Parse meta.bookingData if it's a string
        let bookingData = (_b = paymentData.meta) === null || _b === void 0 ? void 0 : _b.bookingData;
        if (typeof bookingData === "string") {
            try {
                bookingData = JSON.parse(bookingData);
            }
            catch (_e) {
                bookingData = null;
            }
        }
        const userId = bookingData === null || bookingData === void 0 ? void 0 : bookingData.userId;
        if (userId) {
            yield prisma.flightCart.deleteMany({ where: { userId } });
        }
        // Send payment success email only if customer email exists
        if ((_c = paymentData.customer) === null || _c === void 0 ? void 0 : _c.email) {
            try {
                yield (0, brevo_1.sendPaymentSuccessEmailWithRetry)(paymentData, bookingData);
            }
            catch (emailError) {
                // Log but don't block the response
                console.error("Email sending failed:", emailError);
            }
        }
        return res.status(200).json({
            success: true,
            message: "Payment verified successfully",
            data: {
                reference: paymentData.tx_ref,
                amount: paymentData.amount,
                currency: paymentData.currency,
                status: paymentData.status,
            },
        });
    }
    catch (error) {
        console.error("Payment verification error:", error);
        if (error.code === "EAI_AGAIN") {
            return res.status(504).json({
                success: false,
                error: "NETWORK_ERROR",
                message: "DNS/network error. Please try again.",
            });
        }
        if (error.response) {
            return res.status(502).json({
                success: false,
                error: "GATEWAY_ERROR",
                message: "Payment gateway error",
                details: ((_d = error.response.data) === null || _d === void 0 ? void 0 : _d.message) || "Flutterwave API error",
            });
        }
        else if (error.request) {
            return res.status(504).json({
                success: false,
                error: "NETWORK_ERROR",
                message: "No response from payment gateway",
            });
        }
        else {
            return res.status(500).json({
                success: false,
                error: "SERVER_ERROR",
                message: "Internal server error during verification",
            });
        }
    }
});
exports.verifyFlutterwavePaymentWithEmail = verifyFlutterwavePaymentWithEmail;
// Verifying stipe payment
const verifyStripePayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const paymentIntent = yield stripe.paymentIntents.retrieve(paymentIntentId);
        // Check if the payment was successful
        if (paymentIntent.status === "succeeded") {
            return res.status(200).json({
                status: "success",
                verified: true,
                paymentData: paymentIntent,
            });
        }
        else {
            return res.status(400).json({
                status: "error",
                verified: false,
                message: "Payment not successful or not found",
                paymentData: paymentIntent,
            });
        }
    }
    catch (error) {
        console.error("Stripe payment verification error:", error);
        return res.status(500).json({
            status: "error",
            message: "Error verifying Stripe payment",
            error: error.message,
        });
    }
});
exports.verifyStripePayment = verifyStripePayment;
