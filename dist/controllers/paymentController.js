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
exports.verifyFlutterwavePayment = exports.initializePayment = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTER_SECRET;
const FLUTTERWAVE_PUBLIC_KEY = process.env.FLUTTER_PUBLIC;
const FRONTEND_URL = process.env.FRONTEND_URL;
const initializePayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    try {
        const { amount, email, bookingData } = req.body;
        if (!amount || !email) {
            return res.status(400).json({
                status: "error",
                message: "Missing required parameters: amount and email",
            });
        }
        // Generate a unique transaction reference
        const tx_ref = `FLIGHT-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        // Initialize payment with Flutterwave
        const response = yield axios_1.default.post("https://api.flutterwave.com/v3/payments", {
            tx_ref,
            amount,
            currency: "NGN",
            payment_options: "card",
            redirect_url: `${FRONTEND_URL}/auth/success`,
            customer: {
                email,
                phone_number: (_a = bookingData === null || bookingData === void 0 ? void 0 : bookingData.guestInfo) === null || _a === void 0 ? void 0 : _a.phone,
                name: ((_b = bookingData === null || bookingData === void 0 ? void 0 : bookingData.guestInfo) === null || _b === void 0 ? void 0 : _b.firstName)
                    ? `${bookingData.guestInfo.firstName} ${bookingData.guestInfo.lastName}`
                    : "Guest User",
            },
            // customizations: {
            //   title: "Manwhit Areos Flight Booking",
            //   description: "Flight booking payment",
            //   logo: "https://manwhitareos.web.app/logo.png"
            // },
            meta: {
                bookingData: JSON.stringify(bookingData),
            },
        }, {
            headers: {
                Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
                "Content-Type": "application/json",
            },
        });
        // Return the payment link and configuration
        return res.status(200).json({
            status: "success",
            data: {
                publicKey: FLUTTERWAVE_PUBLIC_KEY,
                reference: tx_ref,
                amount: amount,
                currency: "USD",
                paymentLink: response.data.data.link,
            },
        });
    }
    catch (error) {
        console.error("Payment initialization error:", ((_c = error.response) === null || _c === void 0 ? void 0 : _c.data) || error);
        return res.status(500).json({
            status: "error",
            message: "Error initializing payment",
            error: ((_e = (_d = error.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.message) || error.message,
        });
    }
});
exports.initializePayment = initializePayment;
const verifyFlutterwavePayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        // You can receive tx_ref as a query parameter or in the body
        const tx_ref = req.query.tx_ref || req.body.tx_ref;
        if (!tx_ref) {
            return res.status(400).json({
                status: "error",
                message: "Missing required parameter: tx_ref",
            });
        }
        // Verify the transaction using Flutterwave's API
        const response = yield axios_1.default.get(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${tx_ref}`, {
            headers: {
                Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
            },
        });
        const paymentData = (_a = response.data) === null || _a === void 0 ? void 0 : _a.data;
        if (response.data.status === "success" &&
            (paymentData === null || paymentData === void 0 ? void 0 : paymentData.status) === "successful") {
            return res.status(200).json({
                status: "success",
                verified: true,
                paymentData,
            });
        }
        else {
            return res.status(400).json({
                status: "error",
                verified: false,
                message: "Payment not successful or not found",
                paymentData,
            });
        }
    }
    catch (error) {
        console.error("Payment verification error:", ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error);
        return res.status(500).json({
            status: "error",
            message: "Error verifying payment",
            error: ((_d = (_c = error.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || error.message,
        });
    }
});
exports.verifyFlutterwavePayment = verifyFlutterwavePayment;
