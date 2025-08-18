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
exports.searchCars = searchCars;
exports.bookCarTransfer = bookCarTransfer;
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const getToken_1 = __importDefault(require("../utils/getToken"));
const helper_1 = require("../utils/helper");
const baseURL = "https://test.api.amadeus.com";
const prisma = new client_1.PrismaClient();
function searchCars(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        try {
            const { data } = req.body;
            // Get user context from request (adjust based on your auth implementation)
            const currentUserId = ((_a = req.User) === null || _a === void 0 ? void 0 : _a.id) || null; // Assuming you have user in req from auth middleware
            if (!data) {
                return res.status(400).json({
                    error: "Missing booking data",
                });
            }
            // Validate required fields for car booking
            if (!data.startLocationCode ||
                !data.endAddressLine ||
                !data.startDateTime) {
                return res.status(400).json({
                    error: "Required fields missing: startLocationCode, endAddressLine, and startDateTime are required",
                });
            }
            if (!data.passengers || data.passengers < 1) {
                return res.status(400).json({
                    error: "At least one passenger is required",
                });
            }
            if (!data.passengerCharacteristics ||
                data.passengerCharacteristics.length === 0) {
                return res.status(400).json({
                    error: "Passenger characteristics are required",
                });
            }
            // Get Amadeus access token
            const token = yield (0, getToken_1.default)();
            // Prepare the booking payload for Amadeus
            const bookingPayload = {
                data: {
                    startLocationCode: data.startLocationCode,
                    endAddressLine: data.endAddressLine,
                    endCityName: data.endCityName,
                    endZipCode: data.endZipCode,
                    endCountryCode: data.endCountryCode,
                    endName: data.endName,
                    endGeoCode: data.endGeoCode,
                    transferType: data.transferType || "PRIVATE",
                    startDateTime: data.startDateTime,
                    passengers: data.passengers,
                    stopOvers: data.stopOvers || [],
                    startConnectedSegment: data.startConnectedSegment || null,
                    passengerCharacteristics: data.passengerCharacteristics,
                    // Add any additional fields as needed
                    contactInfo: data.contactInfo || null,
                    paymentInfo: data.paymentInfo || null,
                },
            };
            // Make booking request to Amadeus
            const amadeusResponse = yield axios_1.default.post(`${process.env.AMADEUS_BASE_URL || `${baseURL}`}/v1/shopping/transfer-offers`, bookingPayload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            // Extract passenger information (assuming first passenger is primary contact)
            const primaryPassenger = data.passengerCharacteristics[0];
            const contactEmail = ((_b = data.contactInfo) === null || _b === void 0 ? void 0 : _b.email) || `passenger${Date.now()}@temp.com`; // Fallback if no email
            let userId = null;
            let guestUserId = null;
            // If we have a current user and their email matches, use their ID
            if (currentUserId) {
                const currentUser = yield prisma.user.findUnique({
                    where: { id: currentUserId },
                });
                if (currentUser &&
                    (currentUser.email === contactEmail || !((_c = data.contactInfo) === null || _c === void 0 ? void 0 : _c.email))) {
                    userId = currentUserId;
                }
            }
            // If no user match, try to find existing user by email
            if (!userId && ((_d = data.contactInfo) === null || _d === void 0 ? void 0 : _d.email)) {
                const existingUser = yield prisma.user.findUnique({
                    where: { email: contactEmail },
                });
                if (existingUser) {
                    userId = existingUser.id;
                }
                else {
                    // Create or update guest user
                    const guestUser = yield prisma.guestUser.upsert({
                        where: { email: contactEmail },
                        update: {
                            firstName: ((_e = data.contactInfo) === null || _e === void 0 ? void 0 : _e.firstName) || "Guest",
                            lastName: ((_f = data.contactInfo) === null || _f === void 0 ? void 0 : _f.lastName) || "User",
                            phone: ((_g = data.contactInfo) === null || _g === void 0 ? void 0 : _g.phone) || null,
                            address: data.endAddressLine,
                            city: data.endCityName,
                            postalCode: data.endZipCode,
                            country: data.endCountryCode,
                        },
                        create: {
                            email: contactEmail,
                            firstName: ((_h = data.contactInfo) === null || _h === void 0 ? void 0 : _h.firstName) || "Guest",
                            lastName: ((_j = data.contactInfo) === null || _j === void 0 ? void 0 : _j.lastName) || "User",
                            phone: ((_k = data.contactInfo) === null || _k === void 0 ? void 0 : _k.phone) || null,
                            address: data.endAddressLine,
                            city: data.endCityName,
                            postalCode: data.endZipCode,
                            country: data.endCountryCode,
                        },
                    });
                    guestUserId = guestUser.id;
                }
            }
            // Use transaction to ensure data consistency
            const result = yield prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // 1. Clear user's cart if they are logged in
                if (userId) {
                    yield tx.flightCart.deleteMany({
                        where: { userId },
                    });
                }
                // 2. Create booking in database
                const booking = yield tx.booking.create({
                    data: {
                        userId: userId,
                        guestUserId: guestUserId,
                        referenceId: (0, helper_1.generateCarBookingReference)(),
                        type: "CAR",
                        status: "CONFIRMED", // Assuming successful Amadeus booking means confirmed
                        apiResponse: amadeusResponse.data,
                        bookingDetails: {
                            startLocationCode: data.startLocationCode,
                            startDateTime: data.startDateTime,
                            endLocation: {
                                addressLine: data.endAddressLine,
                                cityName: data.endCityName,
                                zipCode: data.endZipCode,
                                countryCode: data.endCountryCode,
                                name: data.endName,
                                geoCode: data.endGeoCode,
                            },
                            transferType: data.transferType || "PRIVATE",
                            passengers: data.passengers,
                            passengerCharacteristics: data.passengerCharacteristics,
                            stopOvers: data.stopOvers || [],
                            startConnectedSegment: data.startConnectedSegment || null,
                            contactInfo: data.contactInfo || null,
                        },
                        totalAmount: (0, helper_1.extractCarTotalAmount)(amadeusResponse),
                        currency: (0, helper_1.extractCarCurrency)(amadeusResponse),
                        apiProvider: "AMADEUS",
                        apiReferenceId: (0, helper_1.extractCarAmadeusReference)(amadeusResponse),
                        locationDetails: {
                            pickup: {
                                code: data.startLocationCode,
                                dateTime: data.startDateTime,
                            },
                            dropoff: {
                                address: data.endAddressLine,
                                city: data.endCityName,
                                country: data.endCountryCode,
                            },
                        },
                        verified: true, // Assuming Amadeus booking is verified
                    },
                });
                // 3. Create traveler records for each passenger characteristic
                const travelerPromises = data.passengerCharacteristics.map((passenger, index) => {
                    var _a, _b, _c;
                    return tx.traveler.create({
                        data: {
                            bookingId: booking.id,
                            userId: userId,
                            guestUserId: guestUserId,
                            firstName: ((_a = data.contactInfo) === null || _a === void 0 ? void 0 : _a.firstName) || `Passenger ${index + 1}`,
                            lastName: ((_b = data.contactInfo) === null || _b === void 0 ? void 0 : _b.lastName) || "",
                            email: contactEmail,
                            phone: ((_c = data.contactInfo) === null || _c === void 0 ? void 0 : _c.phone) || "",
                            countryCode: data.endCountryCode || "",
                            gender: passenger.passengerTypeCode === "ADT" ? "OTHER" : "OTHER", // Default since we don't have gender info
                            dateOfBirth: passenger.age
                                ? new Date(new Date().getFullYear() - passenger.age, 0, 1)
                                : new Date("1990-01-01"), // Calculate approximate birth year from age
                            // Add other fields as available
                        },
                    });
                });
                yield Promise.all(travelerPromises);
                // 4. Fetch the complete booking with relations
                const completeBooking = yield tx.booking.findUnique({
                    where: { id: booking.id },
                    include: {
                        user: true,
                        guestUser: true,
                        travelers: true,
                    },
                });
                return completeBooking;
            }));
            // Return success response
            return res.status(201).json({
                success: true,
                message: userId
                    ? "Car transfer booking completed successfully and cart cleared"
                    : "Car transfer booking completed successfully",
                booking: {
                    id: result === null || result === void 0 ? void 0 : result.id,
                    referenceId: result === null || result === void 0 ? void 0 : result.referenceId,
                    status: result === null || result === void 0 ? void 0 : result.status,
                    type: result === null || result === void 0 ? void 0 : result.type,
                    totalAmount: result === null || result === void 0 ? void 0 : result.totalAmount,
                    currency: result === null || result === void 0 ? void 0 : result.currency,
                    apiReferenceId: result === null || result === void 0 ? void 0 : result.apiReferenceId,
                    createdAt: result === null || result === void 0 ? void 0 : result.createdAt,
                    bookingDetails: result === null || result === void 0 ? void 0 : result.bookingDetails,
                    travelers: result === null || result === void 0 ? void 0 : result.travelers,
                },
                amadeusResponse: amadeusResponse.data,
                cartCleared: userId ? true : false, // Indicate if cart was cleared
            });
        }
        catch (error) {
            console.error("Error booking car transfer:", ((_l = error.response) === null || _l === void 0 ? void 0 : _l.data) || error.message);
            // If it's an Amadeus API error, return specific error
            if ((_m = error.response) === null || _m === void 0 ? void 0 : _m.data) {
                return res.status(error.response.status || 500).json({
                    error: "Amadeus API Error",
                    details: error.response.data,
                    message: error.response.data.error_description ||
                        error.response.data.message ||
                        "Car transfer booking failed",
                });
            }
            // If it's a database error
            if (error.code === "P2002") {
                return res.status(409).json({
                    error: "Booking reference already exists",
                    message: "Please try again",
                });
            }
            // Generic error
            return res.status(500).json({
                error: "Internal server error",
                message: error.message || "An unexpected error occurred",
            });
        }
        finally {
            // Clean up Prisma connection
            yield prisma.$disconnect();
        }
    });
}
// Rename your existing function to bookCarTransfer
function bookCarTransfer(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        try {
            const { data } = req.body;
            // Get user context from request (adjust based on your auth implementation)
            const currentUserId = ((_a = req.User) === null || _a === void 0 ? void 0 : _a.id) || null;
            if (!data) {
                return res.status(400).json({
                    error: "Missing booking data",
                });
            }
            // Validate required fields for car booking
            if (!data.offerId ||
                !data.startLocationCode ||
                !data.endAddressLine ||
                !data.startDateTime) {
                return res.status(400).json({
                    error: "Required fields missing: offerId, startLocationCode, endAddressLine, and startDateTime are required",
                });
            }
            if (!data.passengers || data.passengers < 1) {
                return res.status(400).json({
                    error: "At least one passenger is required",
                });
            }
            if (!data.passengerCharacteristics ||
                data.passengerCharacteristics.length === 0) {
                return res.status(400).json({
                    error: "Passenger characteristics are required",
                });
            }
            // Get Amadeus access token
            const token = yield (0, getToken_1.default)();
            // Prepare the booking payload for Amadeus
            const bookingPayload = {
                data: {
                    offerId: data.offerId, // This should come from the search results
                    startLocationCode: data.startLocationCode,
                    endAddressLine: data.endAddressLine,
                    endCityName: data.endCityName,
                    endZipCode: data.endZipCode,
                    endCountryCode: data.endCountryCode,
                    endName: data.endName,
                    endGeoCode: data.endGeoCode,
                    transferType: data.transferType || "PRIVATE",
                    startDateTime: data.startDateTime,
                    passengers: data.passengers,
                    stopOvers: data.stopOvers || [],
                    startConnectedSegment: data.startConnectedSegment || null,
                    passengerCharacteristics: data.passengerCharacteristics,
                    contactInfo: data.contactInfo || null,
                    paymentInfo: data.paymentInfo || null,
                },
            };
            // Make booking request to Amadeus (this would typically be a POST to a booking endpoint)
            const amadeusResponse = yield axios_1.default.post(`${process.env.AMADEUS_BASE_URL || baseURL}/v1/booking/transfer-orders`, bookingPayload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            // Extract passenger information (assuming first passenger is primary contact)
            const primaryPassenger = data.passengerCharacteristics[0];
            const contactEmail = ((_b = data.contactInfo) === null || _b === void 0 ? void 0 : _b.email) || `passenger${Date.now()}@temp.com`;
            let userId = null;
            let guestUserId = null;
            // If we have a current user and their email matches, use their ID
            if (currentUserId) {
                const currentUser = yield prisma.user.findUnique({
                    where: { id: currentUserId },
                });
                if (currentUser &&
                    (currentUser.email === contactEmail || !((_c = data.contactInfo) === null || _c === void 0 ? void 0 : _c.email))) {
                    userId = currentUserId;
                }
            }
            // If no user match, try to find existing user by email
            if (!userId && ((_d = data.contactInfo) === null || _d === void 0 ? void 0 : _d.email)) {
                const existingUser = yield prisma.user.findUnique({
                    where: { email: contactEmail },
                });
                if (existingUser) {
                    userId = existingUser.id;
                }
                else {
                    // Create or update guest user
                    const guestUser = yield prisma.guestUser.upsert({
                        where: { email: contactEmail },
                        update: {
                            firstName: ((_e = data.contactInfo) === null || _e === void 0 ? void 0 : _e.firstName) || "Guest",
                            lastName: ((_f = data.contactInfo) === null || _f === void 0 ? void 0 : _f.lastName) || "User",
                            phone: ((_g = data.contactInfo) === null || _g === void 0 ? void 0 : _g.phone) || null,
                            address: data.endAddressLine,
                            city: data.endCityName,
                            postalCode: data.endZipCode,
                            country: data.endCountryCode,
                        },
                        create: {
                            email: contactEmail,
                            firstName: ((_h = data.contactInfo) === null || _h === void 0 ? void 0 : _h.firstName) || "Guest",
                            lastName: ((_j = data.contactInfo) === null || _j === void 0 ? void 0 : _j.lastName) || "User",
                            phone: ((_k = data.contactInfo) === null || _k === void 0 ? void 0 : _k.phone) || null,
                            address: data.endAddressLine,
                            city: data.endCityName,
                            postalCode: data.endZipCode,
                            country: data.endCountryCode,
                        },
                    });
                    guestUserId = guestUser.id;
                }
            }
            // Use transaction to ensure data consistency
            const result = yield prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // 1. Clear user's cart if they are logged in
                if (userId) {
                    yield tx.flightCart.deleteMany({
                        where: { userId },
                    });
                }
                // 2. Create booking in database
                const booking = yield tx.booking.create({
                    data: {
                        userId: userId,
                        guestUserId: guestUserId,
                        referenceId: (0, helper_1.generateCarBookingReference)(),
                        type: "CAR",
                        status: "CONFIRMED",
                        apiResponse: amadeusResponse.data,
                        bookingDetails: {
                            offerId: data.offerId,
                            startLocationCode: data.startLocationCode,
                            startDateTime: data.startDateTime,
                            endLocation: {
                                addressLine: data.endAddressLine,
                                cityName: data.endCityName,
                                zipCode: data.endZipCode,
                                countryCode: data.endCountryCode,
                                name: data.endName,
                                geoCode: data.endGeoCode,
                            },
                            transferType: data.transferType || "PRIVATE",
                            passengers: data.passengers,
                            passengerCharacteristics: data.passengerCharacteristics,
                            stopOvers: data.stopOvers || [],
                            startConnectedSegment: data.startConnectedSegment || null,
                            contactInfo: data.contactInfo || null,
                        },
                        totalAmount: (0, helper_1.extractCarTotalAmount)(amadeusResponse),
                        currency: (0, helper_1.extractCarCurrency)(amadeusResponse),
                        apiProvider: "AMADEUS",
                        apiReferenceId: (0, helper_1.extractCarAmadeusReference)(amadeusResponse),
                        locationDetails: {
                            pickup: {
                                code: data.startLocationCode,
                                dateTime: data.startDateTime,
                            },
                            dropoff: {
                                address: data.endAddressLine,
                                city: data.endCityName,
                                country: data.endCountryCode,
                            },
                        },
                        verified: true,
                    },
                });
                // 3. Create traveler records for each passenger characteristic
                const travelerPromises = data.passengerCharacteristics.map((passenger, index) => {
                    var _a, _b, _c;
                    return tx.traveler.create({
                        data: {
                            bookingId: booking.id,
                            userId: userId,
                            guestUserId: guestUserId,
                            firstName: ((_a = data.contactInfo) === null || _a === void 0 ? void 0 : _a.firstName) || `Passenger ${index + 1}`,
                            lastName: ((_b = data.contactInfo) === null || _b === void 0 ? void 0 : _b.lastName) || "",
                            email: contactEmail,
                            phone: ((_c = data.contactInfo) === null || _c === void 0 ? void 0 : _c.phone) || "",
                            countryCode: data.endCountryCode || "",
                            gender: passenger.passengerTypeCode === "ADT" ? "OTHER" : "OTHER",
                            dateOfBirth: passenger.age
                                ? new Date(new Date().getFullYear() - passenger.age, 0, 1)
                                : new Date("1990-01-01"),
                        },
                    });
                });
                yield Promise.all(travelerPromises);
                // 4. Fetch the complete booking with relations
                const completeBooking = yield tx.booking.findUnique({
                    where: { id: booking.id },
                    include: {
                        user: true,
                        guestUser: true,
                        travelers: true,
                    },
                });
                return completeBooking;
            }));
            // Return success response
            return res.status(201).json({
                success: true,
                message: userId
                    ? "Car transfer booking completed successfully and cart cleared"
                    : "Car transfer booking completed successfully",
                booking: {
                    id: result === null || result === void 0 ? void 0 : result.id,
                    referenceId: result === null || result === void 0 ? void 0 : result.referenceId,
                    status: result === null || result === void 0 ? void 0 : result.status,
                    type: result === null || result === void 0 ? void 0 : result.type,
                    totalAmount: result === null || result === void 0 ? void 0 : result.totalAmount,
                    currency: result === null || result === void 0 ? void 0 : result.currency,
                    apiReferenceId: result === null || result === void 0 ? void 0 : result.apiReferenceId,
                    createdAt: result === null || result === void 0 ? void 0 : result.createdAt,
                    bookingDetails: result === null || result === void 0 ? void 0 : result.bookingDetails,
                    travelers: result === null || result === void 0 ? void 0 : result.travelers,
                },
                amadeusResponse: amadeusResponse.data,
                cartCleared: userId ? true : false,
            });
        }
        catch (error) {
            console.error("Error booking car transfer:", ((_l = error.response) === null || _l === void 0 ? void 0 : _l.data) || error.message);
            if ((_m = error.response) === null || _m === void 0 ? void 0 : _m.data) {
                return res.status(error.response.status || 500).json({
                    error: "Amadeus API Error",
                    details: error.response.data,
                    message: error.response.data.error_description ||
                        error.response.data.message ||
                        "Car transfer booking failed",
                });
            }
            if (error.code === "P2002") {
                return res.status(409).json({
                    error: "Booking reference already exists",
                    message: "Please try again",
                });
            }
            return res.status(500).json({
                error: "Internal server error",
                message: error.message || "An unexpected error occurred",
            });
        }
        finally {
            yield prisma.$disconnect();
        }
    });
}
