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
exports.getCachedIataCode = getCachedIataCode;
exports.getCachedLocationDetails = getCachedLocationDetails;
exports.initiateHotelBookingTemplate = initiateHotelBookingTemplate;
exports.generateBookingReference = generateBookingReference;
exports.extractTotalAmount = extractTotalAmount;
exports.extractCurrency = extractCurrency;
exports.extractAmadeusReference = extractAmadeusReference;
exports.generateCarBookingReference = generateCarBookingReference;
exports.extractCarTotalAmount = extractCarTotalAmount;
exports.extractCarCurrency = extractCarCurrency;
exports.extractCarAmadeusReference = extractCarAmadeusReference;
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Cache within the request scope
const locationCache = {};
const iataCache = {};
function getCachedIataCode(locationName, token) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        // Robust check for IATA code (3 uppercase letters)
        if (locationName && typeof locationName === 'string') {
            const trimmed = locationName.trim().toUpperCase();
            if (/^[A-Z]{3}$/.test(trimmed)) {
                return trimmed;
            }
        }
        if (iataCache[locationName])
            return iataCache[locationName];
        try {
            const response = yield axios_1.default.get("https://test.api.amadeus.com/v1/reference-data/locations", {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    keyword: locationName,
                    subType: "CITY,AIRPORT",
                    page: { limit: 1 },
                },
            });
            const code = ((_b = (_a = response.data.data) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.iataCode) || null;
            if (code)
                iataCache[locationName] = code;
            return code;
        }
        catch (error) {
            console.error(`Failed to get IATA for ${locationName}:`, ((_c = error.response) === null || _c === void 0 ? void 0 : _c.data) || error.message);
            return null;
        }
    });
}
function getCachedLocationDetails(iataCode, token) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (locationCache[iataCode])
            return locationCache[iataCode];
        try {
            // Small delay to prevent 429
            yield sleep(300);
            const response = yield axios_1.default.get("https://test.api.amadeus.com/v1/reference-data/locations", {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    keyword: iataCode,
                    subType: "AIRPORT",
                },
            });
            const details = (_a = response.data.data) === null || _a === void 0 ? void 0 : _a[0];
            if (details)
                locationCache[iataCode] = details;
            return details;
        }
        catch (error) {
            console.error(`Failed to get location for ${iataCode}:`, ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
            return null;
        }
    });
}
// Flutterwave handler
function initiateHotelBookingTemplate(amount, currency, customerEmail) {
    return __awaiter(this, void 0, void 0, function* () {
        const paymentData = {
            tx_ref: `hotel_${uuid_1.v4}`,
            amount,
            currency,
            redirect_url: `${process.env.FRONTEND_URL}/success`,
            payment_options: `card,bank`,
            customers: {
                email: customerEmail,
                name: `Hotel Guest`,
            },
            customizations: {
                title: `Hotel Booking Payment`,
                description: `Payment for hotel booking`,
            },
        };
        const response = yield axios_1.default.post(`https://api.flutterwave.com/v3/payments`, paymentData, {
            headers: {
                Authorization: `Bearer ${process.env.FLUTTER_SECRET}`,
                "Content-Type": "application/json",
            },
        });
        return response === null || response === void 0 ? void 0 : response.data;
    });
}
// Helper function to generate booking reference
function generateBookingReference() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `HTL${timestamp}${random}`;
}
// Helper function to extract total amount from response
function extractTotalAmount(amadeusResponse) {
    var _a, _b, _c, _d, _e;
    try {
        return (((_b = (_a = amadeusResponse.data) === null || _a === void 0 ? void 0 : _a.price) === null || _b === void 0 ? void 0 : _b.total) ||
            ((_c = amadeusResponse.data) === null || _c === void 0 ? void 0 : _c.totalPrice) ||
            ((_e = (_d = amadeusResponse.data) === null || _d === void 0 ? void 0 : _d.booking) === null || _e === void 0 ? void 0 : _e.totalPrice) ||
            null);
    }
    catch (error) {
        console.warn("Could not extract total amount:", error);
        return null;
    }
}
// Helper function to extract currency from response
function extractCurrency(amadeusResponse) {
    var _a, _b, _c, _d, _e;
    try {
        return (((_b = (_a = amadeusResponse.data) === null || _a === void 0 ? void 0 : _a.price) === null || _b === void 0 ? void 0 : _b.currency) ||
            ((_c = amadeusResponse.data) === null || _c === void 0 ? void 0 : _c.currency) ||
            ((_e = (_d = amadeusResponse.data) === null || _d === void 0 ? void 0 : _d.booking) === null || _e === void 0 ? void 0 : _e.currency) ||
            "USD");
    }
    catch (error) {
        console.warn("Could not extract currency:", error);
        return "USD";
    }
}
// Helper function to extract Amadeus reference ID
function extractAmadeusReference(amadeusResponse) {
    var _a, _b, _c;
    try {
        return (((_a = amadeusResponse.data) === null || _a === void 0 ? void 0 : _a.id) ||
            ((_b = amadeusResponse.data) === null || _b === void 0 ? void 0 : _b.bookingId) ||
            ((_c = amadeusResponse.data) === null || _c === void 0 ? void 0 : _c.confirmationNumber) ||
            null);
    }
    catch (error) {
        console.warn("Could not extract Amadeus reference:", error);
        return null;
    }
}
function generateCarBookingReference() {
    const prefix = "CAR"; // Car prefix
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
}
// Helper functions to extract information from Amadeus response
function extractCarTotalAmount(amadeusResponse) {
    var _a, _b, _c, _d, _e;
    try {
        // Adjust based on actual Amadeus car booking response structure
        return (((_c = (_b = (_a = amadeusResponse.data) === null || _a === void 0 ? void 0 : _a.quotation) === null || _b === void 0 ? void 0 : _b.totalPrice) === null || _c === void 0 ? void 0 : _c.amount) ||
            ((_e = (_d = amadeusResponse.data) === null || _d === void 0 ? void 0 : _d.price) === null || _e === void 0 ? void 0 : _e.total) ||
            null);
    }
    catch (error) {
        console.warn("Could not extract total amount from car booking response");
        return null;
    }
}
function extractCarCurrency(amadeusResponse) {
    var _a, _b, _c, _d, _e;
    try {
        // Adjust based on actual Amadeus car booking response structure
        return (((_c = (_b = (_a = amadeusResponse.data) === null || _a === void 0 ? void 0 : _a.quotation) === null || _b === void 0 ? void 0 : _b.totalPrice) === null || _c === void 0 ? void 0 : _c.currency) ||
            ((_e = (_d = amadeusResponse.data) === null || _d === void 0 ? void 0 : _d.price) === null || _e === void 0 ? void 0 : _e.currency) ||
            "USD");
    }
    catch (error) {
        console.warn("Could not extract currency from car booking response");
        return "USD";
    }
}
function extractCarAmadeusReference(amadeusResponse) {
    var _a, _b, _c;
    try {
        // Adjust based on actual Amadeus car booking response structure
        return (((_a = amadeusResponse.data) === null || _a === void 0 ? void 0 : _a.id) ||
            ((_b = amadeusResponse.data) === null || _b === void 0 ? void 0 : _b.confirmationNumber) ||
            ((_c = amadeusResponse.data) === null || _c === void 0 ? void 0 : _c.reference) ||
            null);
    }
    catch (error) {
        console.warn("Could not extract Amadeus reference from car booking response");
        return null;
    }
}
// Additional helper function to clear cart separately if needed
