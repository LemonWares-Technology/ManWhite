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
exports.getUserBookingStats = exports.bookUserFlight = exports.bookFlight = exports.emptyUserFlightCart = exports.removeFlightFromCart = exports.getUserCart = exports.addFlightToCart = exports.verifyFlightPrice = void 0;
exports.deleteBooking = deleteBooking;
const prisma_1 = require("../lib/prisma");
const axios_1 = __importDefault(require("axios"));
const getToken_1 = __importDefault(require("../utils/getToken"));
const apiResponse_1 = require("../utils/apiResponse");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const baseURL = "https://test.api.amadeus.com";
const verifyFlightPrice = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { priceFlightOffersBody } = req.body;
        if (!priceFlightOffersBody) {
            return (0, apiResponse_1.sendError)(res, "Missing flight offer data", 400);
        }
        const token = yield (0, getToken_1.default)();
        const response = axios_1.default.get(`${baseURL}/v1/shopping/flight-offers/pricing`, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                "X-HTTP-Method-Override": "GET",
            },
        });
        return (0, apiResponse_1.sendSuccess)(res, "Flight price verified successfully", response);
    }
    catch (error) {
        return (0, apiResponse_1.sendError)(res, "Error verifying flight price", 500, error);
    }
});
exports.verifyFlightPrice = verifyFlightPrice;
const addFlightToCart = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { userId } = req.params;
        const { flightData } = req.body;
        if (!flightData) {
            return (0, apiResponse_1.sendError)(res, "Missing required parameter", 400);
        }
        const user = yield prisma_1.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            return (0, apiResponse_1.sendError)(res, "User not found or does not exist", 404);
        }
        const cartItem = yield prisma_1.prisma.flightCart.create({
            data: {
                userId,
                flightData,
            },
        });
        return (0, apiResponse_1.sendSuccess)(res, "Flight added to cart", cartItem);
    }
    catch (error) {
        console.log(`AMADEUS API: `, (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data);
        return (0, apiResponse_1.sendError)(res, "Error occurred while adding flight to cart", 500, error);
    }
});
exports.addFlightToCart = addFlightToCart;
const getUserCart = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        // Check if user exists
        const user = yield prisma_1.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            return (0, apiResponse_1.sendError)(res, "User not found or does not exist", 404);
        }
        // Fetch all cart items for the user
        const cartItems = yield prisma_1.prisma.flightCart.findMany({
            where: { userId },
        });
        return (0, apiResponse_1.sendSuccess)(res, "User cart retrieved successfully", cartItems);
    }
    catch (error) {
        console.error("Error fetching user cart:", error.message);
        return (0, apiResponse_1.sendError)(res, "Error occurred while fetching user cart", 500, error);
    }
});
exports.getUserCart = getUserCart;
const removeFlightFromCart = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { cartId } = req.params;
    try {
        const cartItem = yield prisma_1.prisma.flightCart.findUnique({
            where: { id: cartId },
        });
        if (!cartItem) {
            return (0, apiResponse_1.sendError)(res, "Item not found in cart", 404);
        }
        yield prisma_1.prisma.flightCart.delete({
            where: { id: cartId },
        });
        return (0, apiResponse_1.sendSuccess)(res, "Flight removed from cart");
    }
    catch (error) {
        console.log(`AMADEUS API: `, (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data);
        return (0, apiResponse_1.sendError)(res, "Error occurred while removing flight from cart", 500, error);
    }
});
exports.removeFlightFromCart = removeFlightFromCart;
// Remove all flights from a user's cart
const emptyUserFlightCart = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { userId } = req.params;
    try {
        // Check if userId is provided
        if (!userId) {
            return (0, apiResponse_1.sendError)(res, "User ID is required", 400);
        }
        // Delete all cart items for this user
        yield prisma_1.prisma.flightCart.deleteMany({
            where: { userId },
        });
        return (0, apiResponse_1.sendSuccess)(res, "All flights removed from cart");
    }
    catch (error) {
        console.log(`AMADEUS API: `, (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data);
        return (0, apiResponse_1.sendError)(res, "Error occurred while emptying cart", 500, error);
    }
});
exports.emptyUserFlightCart = emptyUserFlightCart;
// export const getUserCart = async (
//   req: Request,
//   res: Response
// ): Promise<any> => {
//   const { userId } = req.params;
//   try {
//     // Optional: Check if user exists (uncomment if needed)
//     const user = await prisma.user.findUnique({ where: { id: userId } });
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }
//     // Get all cart items for the user, ordered by creation date (latest first)
//     const cartItems = await prisma.flightCart.findMany({
//       where: { userId },
//       orderBy: { createdAt: "desc" },
//     });
//     return res.status(200).json({
//       message: "User cart fetched successfully",
//       data: cartItems,
//     });
//   } catch (error: any) {
//     console.error("Error fetching user cart:", error);
//     return res.status(500).json({
//       message: "Error occurred while fetching user cart",
//       error: error.message,
//     });
//   }
// };
const bookFlight = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    try {
        const { transactionId } = req.params;
        const { travelers, guestInfo, flightOffer, data } = req.body;
        // Early check for transaction ID
        if (!transactionId) {
            return (0, apiResponse_1.sendError)(res, "Missing Flutterwave transaction ID", 400);
        }
        // Check if ANY booking exists for this transaction ID
        const existingBooking = yield prisma_1.prisma.booking.findFirst({
            where: {
                apiReferenceId: transactionId,
            },
            include: {
                travelers: true,
            },
        });
        if (existingBooking) {
            console.log(`Found existing booking for transaction ${transactionId}`);
            return (0, apiResponse_1.sendSuccess)(res, "Booking already exists for this transaction", [existingBooking]);
        }
        if (!travelers || !Array.isArray(travelers) || travelers.length === 0) {
            return (0, apiResponse_1.sendError)(res, "Travelers data missing or invalid", 400);
        }
        // 1. Verify payment with Flutterwave
        const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTER_SECRET;
        const verifyUrl = `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`;
        if (!FLUTTERWAVE_SECRET_KEY || !verifyUrl) {
            return (0, apiResponse_1.sendError)(res, "Server misconfiguration", 500);
        }
        const flutterwaveRes = yield axios_1.default.get(verifyUrl, {
            headers: {
                Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
            },
        });
        const flutterwaveData = flutterwaveRes.data;
        if (!flutterwaveData ||
            flutterwaveData.status !== "success" ||
            flutterwaveData.data.status !== "successful") {
            return (0, apiResponse_1.sendError)(res, "Payment not successful", 402);
        }
        // 2. Handle guest user creation if guestInfo is provided
        let guestUserId = null;
        if (guestInfo) {
            const guestUser = yield prisma_1.prisma.guestUser.create({
                data: {
                    email: guestInfo.email,
                    firstName: guestInfo.firstName,
                    lastName: guestInfo.lastName,
                    phone: guestInfo.phone,
                    address: guestInfo.address,
                    postalCode: guestInfo.postalCode,
                    city: guestInfo.city,
                    country: guestInfo.country,
                },
            });
            guestUserId = guestUser.id;
        }
        // 3. Get Amadeus token once
        const token = yield (0, getToken_1.default)();
        // Helper function to fetch location details using query parameters
        function getLocationDetails(iataCode) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const response = yield axios_1.default.get(`${baseURL}/v1/reference-data/locations`, {
                        headers: { Authorization: `Bearer ${token}` },
                        params: {
                            keyword: iataCode,
                            subType: "AIRPORT",
                        },
                    });
                    const locations = response.data.data;
                    if (locations && locations.length > 0) {
                        const exactMatch = locations.find((loc) => loc.iataCode === iataCode);
                        const location = exactMatch || locations[0];
                        return location;
                    }
                    else {
                        return null;
                    }
                }
                catch (error) {
                    return null;
                }
            });
        }
        // Helper function to fetch airline details
        function getAirlineDetails(codes, token) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    if (codes.length === 0)
                        return {};
                    const response = yield axios_1.default.get(`${baseURL}/v1/reference-data/airlines`, {
                        headers: { Authorization: `Bearer ${token}` },
                        params: { airlineCodes: codes.join(",") },
                    });
                    const airlines = response.data.data;
                    const map = {};
                    airlines.forEach((airline) => {
                        map[airline.iataCode] =
                            airline.commonName || airline.name || airline.iataCode;
                    });
                    return map;
                }
                catch (error) {
                    const fallbackMap = {};
                    codes.forEach((code) => (fallbackMap[code] = code));
                    return fallbackMap;
                }
            });
        }
        const bookings = [];
        // 4. Get flight offer(s) based on booking type
        let flightOffers = [];
        if (guestInfo) {
            // Guest booking - direct checkout with single flight
            if (!flightOffer) {
                return (0, apiResponse_1.sendError)(res, "Flight offer is required for guest booking", 400);
            }
            flightOffers = [flightOffer];
        }
        else {
            // Registered user - checkout from cart
            if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
                return (0, apiResponse_1.sendError)(res, "Unauthorized: User ID missing", 401);
            }
            const cartItems = yield prisma_1.prisma.flightCart.findMany({
                where: { userId: req.user.id },
            });
            if (cartItems.length === 0) {
                return (0, apiResponse_1.sendError)(res, "Cart is empty", 400);
            }
            flightOffers = cartItems.map((item) => item.flightData);
        }
        // 5. Process each flight offer
        for (const flightOffer of flightOffers) {
            // Double check for existing booking before processing
            const doubleCheckBooking = yield prisma_1.prisma.booking.findFirst({
                where: {
                    AND: [
                        { apiReferenceId: transactionId },
                        { referenceId: flightOffer.id },
                    ],
                },
            });
            if (doubleCheckBooking) {
                console.log(`Found existing booking for flight ${flightOffer.id} and transaction ${transactionId}`);
                bookings.push(doubleCheckBooking);
                continue;
            }
            // Extract all unique IATA codes from segments
            const segments = flightOffer.itineraries.flatMap((i) => i.segments);
            const uniqueIataCodes = new Set();
            segments.forEach((segment) => {
                uniqueIataCodes.add(segment.departure.iataCode);
                uniqueIataCodes.add(segment.arrival.iataCode);
            });
            // Fetch location details for each IATA code
            const locationDetailsMap = {};
            for (const code of uniqueIataCodes) {
                const details = yield getLocationDetails(code);
                if (details) {
                    locationDetailsMap[code] = {
                        airportName: details.name,
                        cityName: (_b = details.address) === null || _b === void 0 ? void 0 : _b.cityName,
                        countryName: (_c = details.address) === null || _c === void 0 ? void 0 : _c.countryName,
                        countryCode: (_d = details.address) === null || _d === void 0 ? void 0 : _d.countryCode,
                    };
                }
            }
            // Extract unique airline codes
            const uniqueAirlineCodes = new Set();
            segments.forEach((segment) => {
                if (segment.carrierCode)
                    uniqueAirlineCodes.add(segment.carrierCode);
                if (segment.operatingCarrierCode)
                    uniqueAirlineCodes.add(segment.operatingCarrierCode);
            });
            // Fetch airline names
            const airlineDetailsMap = yield getAirlineDetails(Array.from(uniqueAirlineCodes), token);
            // Prepare booking payload
            const payload = {
                data: {
                    type: "flight-order",
                    flightOffers: [flightOffer],
                    travelers: travelers.map((t, index) => {
                        var _a;
                        const travelerId = ((_a = flightOffer.travelerPricings[index]) === null || _a === void 0 ? void 0 : _a.travelerId) ||
                            `TRAVELER_${index + 1}`;
                        return {
                            id: travelerId,
                            dateOfBirth: new Date(t.dateOfBirth).toISOString().split("T")[0],
                            name: {
                                firstName: t.name.firstName,
                                lastName: t.name.lastName,
                            },
                            gender: t.gender,
                            contact: {
                                emailAddress: t.contact.emailAddress,
                                phones: t.contact.phones.map((phone) => ({
                                    deviceType: "MOBILE",
                                    countryCallingCode: phone.countryCallingCode,
                                    number: phone.number,
                                })),
                            },
                            documents: t.documents.map((doc) => {
                                var _a, _b, _c;
                                return ({
                                    number: doc.passportNumber || doc.number,
                                    documentType: doc.documentType || "PASSPORT",
                                    issuanceCountry: (_a = doc.issuanceCountry) === null || _a === void 0 ? void 0 : _a.toUpperCase(),
                                    issuanceLocation: doc.issuanceLocation || "LAGOS",
                                    issuanceDate: new Date(doc.issuanceDate)
                                        .toISOString()
                                        .split("T")[0],
                                    holder: true,
                                    expiryDate: new Date(doc.expiryDate)
                                        .toISOString()
                                        .split("T")[0],
                                    validityCountry: (_b = doc.validityCountry) === null || _b === void 0 ? void 0 : _b.toUpperCase(),
                                    nationality: (_c = doc.nationality) === null || _c === void 0 ? void 0 : _c.toUpperCase(),
                                    birthPlace: doc.birthPlace,
                                });
                            }),
                        };
                    }),
                    contacts: flightOffer.contacts || [
                        {
                            addresseeName: {
                                firstName: guestInfo.firstName,
                                lastName: guestInfo.lastName,
                            },
                            purpose: "STANDARD",
                            phones: [
                                {
                                    deviceType: "MOBILE",
                                    number: guestInfo.phone,
                                    countryCallingCode: guestInfo.countryCode,
                                },
                            ],
                            emailAddress: guestInfo.email,
                            address: {
                                lines: [guestInfo.address],
                                postalCode: guestInfo.postalCode,
                                cityName: guestInfo.city,
                                countryCode: (_e = guestInfo.countryCode) === null || _e === void 0 ? void 0 : _e.toUpperCase(),
                            },
                        },
                    ],
                    remarks: {
                        general: [
                            {
                                subType: "GENERAL_MISCELLANEOUS",
                                text: "ONLINE BOOKING FROM MANWHIT",
                            },
                        ],
                    },
                },
            };
            console.log("Booking payload:", JSON.stringify(payload, null, 2));
            try {
                // Call Amadeus booking API
                const bookingResponse = yield axios_1.default.post(`${baseURL}/v1/booking/flight-orders`, payload, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                });
                const bookingData = bookingResponse.data;
                // Final check before creating booking
                const finalCheck = yield prisma_1.prisma.booking.findFirst({
                    where: {
                        AND: [
                            { apiReferenceId: transactionId },
                            { referenceId: bookingData.data.id },
                        ],
                    },
                });
                if (finalCheck) {
                    console.log(`Found existing booking during final check for transaction ${transactionId}`);
                    bookings.push(finalCheck);
                    continue;
                }
                // Save booking in DB
                const booking = yield prisma_1.prisma.booking.create({
                    data: {
                        userId: (_f = req.user) === null || _f === void 0 ? void 0 : _f.id,
                        guestUserId: guestUserId,
                        referenceId: bookingData.data.id,
                        type: "FLIGHT",
                        verified: true,
                        status: "CONFIRMED",
                        apiResponse: bookingData,
                        bookingDetails: flightOffer,
                        totalAmount: parseFloat(flightOffer.price.total),
                        currency: (_g = flightOffer === null || flightOffer === void 0 ? void 0 : flightOffer.price) === null || _g === void 0 ? void 0 : _g.currency,
                        apiProvider: "AMADEUS",
                        apiReferenceId: transactionId,
                        locationDetails: locationDetailsMap,
                        airlineDetails: airlineDetailsMap,
                        travelers: {
                            create: travelers.map((traveler) => {
                                var _a, _b, _c, _d;
                                return ({
                                    firstName: traveler.name.firstName,
                                    lastName: traveler.name.lastName,
                                    dateOfBirth: new Date(traveler.dateOfBirth),
                                    gender: traveler.gender,
                                    email: traveler.contact.emailAddress,
                                    phone: traveler.contact.phones[0].number,
                                    countryCode: ((_a = traveler.documents[0].issuanceCountry) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || "NG",
                                    birthPlace: traveler.documents[0].birthPlace || "LAGOS",
                                    passportNumber: traveler.documents[0].number,
                                    passportExpiry: new Date(traveler.documents[0].expiryDate),
                                    issuanceCountry: ((_b = traveler.documents[0].issuanceCountry) === null || _b === void 0 ? void 0 : _b.toUpperCase()) || "NG",
                                    validityCountry: ((_c = traveler.documents[0].validityCountry) === null || _c === void 0 ? void 0 : _c.toUpperCase()) || "NG",
                                    nationality: ((_d = traveler.documents[0].nationality) === null || _d === void 0 ? void 0 : _d.toUpperCase()) || "NG",
                                    issuanceDate: new Date(traveler.documents[0].issuanceDate),
                                    issuanceLocation: traveler.documents[0].issuanceLocation || "LAGOS",
                                });
                            }),
                        },
                    },
                });
                bookings.push(booking);
            }
            catch (error) {
                console.error("Error booking flight:", ((_h = error.response) === null || _h === void 0 ? void 0 : _h.data) || error.message);
                continue;
            }
        }
        // 6. Clear cart if it was a registered user booking
        if (!guestInfo && ((_j = req.user) === null || _j === void 0 ? void 0 : _j.id)) {
            yield prisma_1.prisma.flightCart.deleteMany({ where: { userId: req.user.id } });
        }
        return (0, apiResponse_1.sendSuccess)(res, "Flight(s) booked successfully", bookings);
    }
    catch (error) {
        console.error("Booking API Error:", ((_k = error.response) === null || _k === void 0 ? void 0 : _k.data) || error.message);
        return (0, apiResponse_1.sendError)(res, "Error booking flight", 500, error);
    }
});
exports.bookFlight = bookFlight;
const bookUserFlight = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    try {
        const { userId, transactionId } = req.params;
        const { travelers } = req.body;
        if (!userId) {
            return (0, apiResponse_1.sendError)(res, "Unauthorized: User ID missing", 401);
        }
        if (!transactionId) {
            return (0, apiResponse_1.sendError)(res, "Missing Flutterwave transaction ID", 400);
        }
        if (!travelers || !Array.isArray(travelers) || travelers.length === 0) {
            return (0, apiResponse_1.sendError)(res, "Travelers data missing or invalid", 400);
        }
        // 1. Verify payment with Flutterwave
        const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTER_SECRET;
        const verifyUrl = `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`;
        const flutterwaveRes = yield axios_1.default.get(verifyUrl, {
            headers: {
                Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
            },
        });
        const flutterwaveData = flutterwaveRes.data;
        if (!flutterwaveData ||
            flutterwaveData.status !== "success" ||
            flutterwaveData.data.status !== "successful") {
            return (0, apiResponse_1.sendError)(res, "Payment not successful", 402);
        }
        // 2. Fetch user's cart items
        const cartItems = yield prisma_1.prisma.flightCart.findMany({
            where: { userId },
        });
        if (cartItems.length === 0) {
            return (0, apiResponse_1.sendError)(res, "Cart is empty", 400);
        }
        // 3. Get Amadeus token once
        const token = yield (0, getToken_1.default)();
        // console.log("Amadeus token acquired");
        // Helper function to fetch location details using query parameters
        function getLocationDetails(iataCode) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const response = yield axios_1.default.get(`${baseURL}/v1/reference-data/locations`, {
                        headers: { Authorization: `Bearer ${token}` },
                        params: {
                            keyword: iataCode,
                            subType: "AIRPORT",
                        },
                    });
                    const locations = response.data.data;
                    // console.log(`Location data for ${iataCode}:`, JSON.stringify(locations, null, 2));
                    if (locations && locations.length > 0) {
                        // Find exact match by iataCode if multiple returned
                        const exactMatch = locations.find((loc) => loc.iataCode === iataCode);
                        const location = exactMatch || locations[0];
                        return location;
                    }
                    else {
                        // console.warn(`No location data found for IATA code: ${iataCode}`);
                        return null;
                    }
                }
                catch (error) {
                    // console.error(`Failed to fetch location details for ${iataCode}`, error.response?.data || error.message);
                    return null;
                }
            });
        }
        // Helper function to fetch airline details dynamically from Amadeus API
        function getAirlineDetails(codes, token) {
            return __awaiter(this, void 0, void 0, function* () {
                var _a;
                try {
                    if (codes.length === 0)
                        return {};
                    const response = yield axios_1.default.get(`${baseURL}/v1/reference-data/airlines`, {
                        headers: { Authorization: `Bearer ${token}` },
                        params: { airlineCodes: codes.join(",") },
                    });
                    const airlines = response.data.data;
                    const map = {};
                    airlines.forEach((airline) => {
                        map[airline.iataCode] =
                            airline.commonName || airline.name || airline.iataCode;
                    });
                    return map;
                }
                catch (error) {
                    console.error("Failed to fetch airline details:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
                    // fallback: map codes to themselves if API fails
                    const fallbackMap = {};
                    codes.forEach((code) => (fallbackMap[code] = code));
                    return fallbackMap;
                }
            });
        }
        const bookings = [];
        for (const cartItem of cartItems) {
            const flightOffer = cartItem.flightData;
            // Extract all unique IATA codes from segments
            const segments = flightOffer.itineraries.flatMap((i) => i.segments);
            const uniqueIataCodes = new Set();
            segments.forEach((segment) => {
                uniqueIataCodes.add(segment.departure.iataCode);
                uniqueIataCodes.add(segment.arrival.iataCode);
            });
            console.log("Unique IATA codes extracted:", Array.from(uniqueIataCodes));
            // Fetch location details for each IATA code
            const locationDetailsMap = {};
            for (const code of uniqueIataCodes) {
                const details = yield getLocationDetails(code);
                if (details) {
                    locationDetailsMap[code] = {
                        airportName: details.name,
                        cityName: (_a = details.address) === null || _a === void 0 ? void 0 : _a.cityName,
                        countryName: (_b = details.address) === null || _b === void 0 ? void 0 : _b.countryName,
                        countryCode: (_c = details.address) === null || _c === void 0 ? void 0 : _c.countryCode,
                    };
                }
            }
            // console.log("Location details map populated:", locationDetailsMap);
            // Extract unique airline codes from flight segments
            const uniqueAirlineCodes = new Set();
            segments.forEach((segment) => {
                if (segment.carrierCode)
                    uniqueAirlineCodes.add(segment.carrierCode);
                if (segment.operatingCarrierCode)
                    uniqueAirlineCodes.add(segment.operatingCarrierCode);
            });
            console.log("Unique airline codes extracted:", Array.from(uniqueAirlineCodes));
            // Fetch airline names from Amadeus API dynamically
            const airlineDetailsMap = yield getAirlineDetails(Array.from(uniqueAirlineCodes), token);
            // Prepare booking payload
            const payload = {
                data: {
                    type: "flight-order",
                    flightOffers: [flightOffer],
                    travelers: travelers.map((t) => ({
                        id: t.id,
                        dateOfBirth: t.dateOfBirth,
                        name: {
                            firstName: t.name.firstName,
                            lastName: t.name.lastName,
                        },
                        gender: t.gender,
                        contact: {
                            emailAddress: t.contact.emailAddress,
                            phones: t.contact.phones,
                        },
                        documents: t.documents.map((doc) => ({
                            number: doc.passportNumber || doc.number,
                            documentType: doc.documentType || "PASSPORT",
                            issuanceCountry: doc.issuanceCountry,
                            issuanceLocation: doc.issuanceLocation,
                            issuanceDate: doc.issuanceDate,
                            holder: true,
                            expiryDate: doc.expiryDate,
                            validityCountry: doc.validityCountry,
                            nationality: doc.nationality,
                            birthPlace: doc.birthPlace,
                        })),
                    })),
                    holder: {
                        name: {
                            firstName: travelers[0].name.firstName,
                            lastName: travelers[0].name.lastName,
                        },
                    },
                },
            };
            // Call Amadeus booking API
            const bookingResponse = yield axios_1.default.post(`${baseURL}/v1/booking/flight-orders`, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            const bookingData = bookingResponse.data;
            // Save booking in DB, including location and airline details
            const booking = yield prisma_1.prisma.booking.create({
                data: {
                    userId,
                    referenceId: bookingData.data.id,
                    type: "FLIGHT",
                    verified: true,
                    status: "CONFIRMED",
                    apiResponse: bookingData,
                    bookingDetails: flightOffer,
                    totalAmount: parseFloat(flightOffer.price.total),
                    currency: (_d = flightOffer === null || flightOffer === void 0 ? void 0 : flightOffer.price) === null || _d === void 0 ? void 0 : _d.currency,
                    apiProvider: "AMADEUS",
                    apiReferenceId: bookingData.data.id,
                    locationDetails: locationDetailsMap,
                    airlineDetails: airlineDetailsMap, // <-- Automatically fetched airline names here
                    travelers: {
                        create: travelers.map((traveler) => ({
                            firstName: traveler.name.firstName,
                            lastName: traveler.name.lastName,
                            dateOfBirth: new Date(traveler.dateOfBirth),
                            gender: traveler.gender,
                            email: traveler.contact.emailAddress,
                            phone: traveler.contact.phones[0].number,
                            countryCode: traveler.documents[0].issuanceCountry,
                            birthPlace: traveler.documents[0].birthPlace,
                            passportNumber: traveler.documents[0].number,
                            passportExpiry: new Date(traveler.documents[0].expiryDate),
                            issuanceCountry: traveler.documents[0].issuanceCountry,
                            validityCountry: traveler.documents[0].validityCountry,
                            nationality: traveler.documents[0].nationality,
                            issuanceDate: new Date(traveler.documents[0].issuanceDate),
                            issuanceLocation: traveler.documents[0].issuanceLocation,
                        })),
                    },
                },
            });
            bookings.push(booking);
        }
        // 4. Clear cart
        yield prisma_1.prisma.flightCart.deleteMany({ where: { userId } });
        return (0, apiResponse_1.sendSuccess)(res, "Flight(s) booked successfully", bookings);
    }
    catch (error) {
        console.error("Booking API Error:", ((_e = error.response) === null || _e === void 0 ? void 0 : _e.data) || error.message);
        return (0, apiResponse_1.sendError)(res, "Error booking flight", 500, error);
    }
});
exports.bookUserFlight = bookUserFlight;
function deleteBooking(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { bookingId } = req.params;
            if (!bookingId) {
                return (0, apiResponse_1.sendError)(res, "Missing required parameters: bookingId", 400);
            }
            const bookings = yield prisma_1.prisma.booking.findUnique({
                where: { id: bookingId },
            });
            if (!bookings) {
                return (0, apiResponse_1.sendError)(res, "Booking does not exist", 404);
            }
            return (0, apiResponse_1.sendSuccess)(res, "Booking deleted successfully");
        }
        catch (error) {
            console.error(`Error: `, error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
const getUserBookingStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        if (!userId) {
            return (0, apiResponse_1.sendError)(res, "User ID is required", 400);
        }
        const bookings = yield prisma_1.prisma.booking.findMany({
            where: { userId },
            select: {
                id: true,
                status: true,
                bookingDetails: true,
            },
        });
        let total = bookings.length;
        let pending = 0; // Represents Upcoming flights
        let completed = 0; // Represents Past flights
        const now = new Date();
        bookings.forEach((booking) => {
            let flightDate = null;
            // Attempt to extract flight date from Amadeus flight offer structure
            if (booking.bookingDetails &&
                booking.bookingDetails.itineraries &&
                Array.isArray(booking.bookingDetails.itineraries) &&
                booking.bookingDetails.itineraries.length > 0) {
                const firstItinerary = booking.bookingDetails.itineraries[0];
                if (firstItinerary.segments &&
                    Array.isArray(firstItinerary.segments) &&
                    firstItinerary.segments.length > 0) {
                    const firstSegment = firstItinerary.segments[0];
                    if (firstSegment.departure && firstSegment.departure.at) {
                        flightDate = new Date(firstSegment.departure.at);
                    }
                }
            }
            if (flightDate) {
                if (flightDate > now) {
                    pending++;
                }
                else {
                    completed++;
                }
            }
            else {
                // Fallback: If no flight date is found, assume completed
                completed++;
            }
        });
        return (0, apiResponse_1.sendSuccess)(res, "User booking stats retrieved successfully", {
            total,
            pending,
            completed,
        });
    }
    catch (error) {
        console.error("Error fetching booking stats:", error);
        return (0, apiResponse_1.sendError)(res, "Error occurred while fetching booking stats", 500, error);
    }
});
exports.getUserBookingStats = getUserBookingStats;
