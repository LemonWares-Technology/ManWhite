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
exports.searchLocations = searchLocations;
exports.searchFlights = searchFlights;
exports.searchFlightPrice = searchFlightPrice;
exports.saveSelectedFlightOffer = saveSelectedFlightOffer;
exports.getFlightOffers = getFlightOffers;
exports.getFlightOfferById = getFlightOfferById;
exports.retrieveFlightDetails = retrieveFlightDetails;
exports.deleteFlightBooking = deleteFlightBooking;
exports.getSeatMapsByFlightId = getSeatMapsByFlightId;
exports.getOneFlightDetails = getOneFlightDetails;
exports.updateFlightStatus = updateFlightStatus;
exports.bookFlight = bookFlight;
exports.bookFlightAsGuest = bookFlightAsGuest;
exports.updateBookingStatus = updateBookingStatus;
exports.getAirportDetails = getAirportDetails;
exports.getAirlineDetailsEndpoint = getAirlineDetailsEndpoint;
exports.getAirlinesByAirport = getAirlinesByAirport;
exports.getAirlinesByMultipleLocations = getAirlinesByMultipleLocations;
exports.getFlightOffersRandom = getFlightOffersRandom;
exports.getFlightOfferDetails = getFlightOfferDetails;
const axios_1 = __importDefault(require("axios"));
const getToken_1 = __importDefault(require("../utils/getToken"));
const prisma_1 = require("../lib/prisma");
const amadeusHelper_1 = require("../utils/amadeusHelper");
const helper_1 = require("../utils/helper");
const iata_1 = require("../utils/iata");
const apiResponse_1 = require("../utils/apiResponse");
const baseURL = process.env.AMADEUS_BASE_URL;
// ==========================================
// NEW: Search Locations (Autocomplete)
// ==========================================
function searchLocations(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { keyword, subType = "CITY,AIRPORT" } = req.query;
        if (!keyword || typeof keyword !== "string" || keyword.trim().length === 0) {
            return (0, apiResponse_1.sendError)(res, "Keyword is required", 400);
        }
        try {
            const token = yield (0, getToken_1.default)();
            const { data } = yield axios_1.default.get(`${baseURL}/v1/reference-data/locations`, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    subType,
                    keyword,
                    "page[limit]": 10,
                },
            });
            const suggestions = data.data.map((item) => {
                var _a, _b, _c;
                return ({
                    name: item.name,
                    iataCode: item.iataCode,
                    cityCode: item.cityCode,
                    cityName: (_a = item.address) === null || _a === void 0 ? void 0 : _a.cityName,
                    countryName: (_b = item.address) === null || _b === void 0 ? void 0 : _b.countryName,
                    countryCode: (_c = item.address) === null || _c === void 0 ? void 0 : _c.countryCode,
                    timeZone: item.timeZoneOffset,
                    type: item.subType,
                    relevance: item.relevance,
                    geoCode: item.geoCode,
                });
            });
            return (0, apiResponse_1.sendSuccess)(res, "Locations retrieved successfully", suggestions);
        }
        catch (error) {
            console.error("Location Search Error:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Failed to search locations", 500, error);
        }
    });
}
// ==========================================
// Refactored: Search Flights
// ==========================================
function searchFlights(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { origin, destination, adults, departureDate, currency = "NGN", getAirportDetails = "false", } = req.query;
        try {
            const token = yield (0, getToken_1.default)();
            // 1. Validate required fields
            if (!origin || !destination || !adults || !departureDate) {
                return (0, apiResponse_1.sendError)(res, "Missing required fields: origin, destination, adults, departureDate", 400);
            }
            const adultsNum = Number(adults);
            if (isNaN(adultsNum) || adultsNum < 1) {
                return (0, apiResponse_1.sendError)(res, "Invalid 'adults' parameter", 400);
            }
            // 2. Get IATA codes
            const [originIata, destinationIata] = yield Promise.all([
                (0, helper_1.getCachedIataCode)(origin, token),
                (0, helper_1.getCachedIataCode)(destination, token),
            ]);
            if (!originIata || !destinationIata) {
                return (0, apiResponse_1.sendError)(res, "Could not find IATA code for origin or destination", 400);
            }
            // 3. Fetch flight offers
            // Get excluded airlines
            const excludedAirlines = yield prisma_1.prisma.excludedAirline.findMany();
            const excludedCodesArray = excludedAirlines
                .map((a) => { var _a; return (_a = a.airlineCode) === null || _a === void 0 ? void 0 : _a.trim(); })
                .filter((code) => code && /^[A-Z0-9]+$/.test(code));
            const params = {
                originLocationCode: originIata,
                destinationLocationCode: destinationIata,
                adults: adultsNum,
                departureDate,
                currencyCode: currency,
                max: 10, // Limit results for performance
            };
            if (excludedCodesArray.length > 0) {
                params.excludedAirlineCodes = excludedCodesArray.join(",");
            }
            const response = yield axios_1.default.get(`${baseURL}/v2/shopping/flight-offers`, {
                headers: { Authorization: `Bearer ${token}` },
                params,
            });
            const offers = response.data.data;
            // 4. Apply Margin
            const marginSetting = yield prisma_1.prisma.marginSetting.findFirst();
            const percent = (marginSetting === null || marginSetting === void 0 ? void 0 : marginSetting.amount) || 0;
            const adjustedOffers = offers.map((offer) => {
                const originalPrice = parseFloat(offer.price.total);
                const priceWithMargin = originalPrice * (1 + percent / 100);
                return Object.assign(Object.assign({}, offer), { price: Object.assign(Object.assign({}, offer.price), { total: parseFloat(priceWithMargin.toFixed(2)) }) });
            });
            // 5. Optimization: Fetch needed location details in parallel
            // Collect all unique IATA codes from segments
            const iataCodes = new Set();
            adjustedOffers.forEach((offer) => {
                offer.itineraries.forEach((it) => {
                    it.segments.forEach((seg) => {
                        iataCodes.add(seg.departure.iataCode);
                        iataCodes.add(seg.arrival.iataCode);
                    });
                });
            });
            // Fetch all details once
            const locationDetailsMap = new Map();
            yield Promise.all(Array.from(iataCodes).map((code) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const details = yield (0, helper_1.getCachedLocationDetails)(code, token);
                    locationDetailsMap.set(code, details);
                }
                catch (e) {
                    // Ignore failures, just don't have details
                }
            })));
            // Map details back to segments
            for (const offer of adjustedOffers) {
                for (const itinerary of offer.itineraries) {
                    for (const segment of itinerary.segments) {
                        segment.departure.details = locationDetailsMap.get(segment.departure.iataCode);
                        segment.arrival.details = locationDetailsMap.get(segment.arrival.iataCode);
                    }
                }
            }
            // 6. Construct Response
            const responseData = {
                data: adjustedOffers,
                meta: {
                    origin: originIata,
                    destination: destinationIata,
                    currency,
                    adults: adultsNum,
                    departureDate,
                },
            };
            if (getAirportDetails === "true") {
                try {
                    const [originDetails, destinationDetails] = yield Promise.all([
                        (0, iata_1.getIataCodeDetails)(originIata),
                        (0, iata_1.getIataCodeDetails)(destinationIata),
                    ]);
                    responseData.airportDetails = {
                        origin: originDetails,
                        destination: destinationDetails,
                    };
                }
                catch (e) {
                    console.error("Failed to fetch detailed airport info:", e);
                }
            }
            return (0, apiResponse_1.sendSuccess)(res, "Flight offers retrieved successfully", responseData);
        }
        catch (error) {
            console.error("Search Flights Error:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Failed to fetch flight offers", 500, error);
        }
    });
}
function searchFlightPrice(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const { flightOffer } = req.body;
        try {
            const token = yield (0, getToken_1.default)();
            const response = yield axios_1.default.post(`${baseURL}/v1/shopping/flight-offers/pricing`, {
                data: {
                    type: "flight-offers-pricing",
                    flightOffers: [flightOffer],
                },
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const responseData = response.data;
            const pricedOffer = (_b = (_a = responseData === null || responseData === void 0 ? void 0 : responseData.data) === null || _a === void 0 ? void 0 : _a.flightOffers) === null || _b === void 0 ? void 0 : _b[0];
            if (!pricedOffer) {
                return (0, apiResponse_1.sendError)(res, "No priced offer returned", 500);
            }
            // Apply Margin
            const marginSetting = yield prisma_1.prisma.marginSetting.findFirst();
            const percent = (marginSetting === null || marginSetting === void 0 ? void 0 : marginSetting.amount) || 0;
            const originalPrice = parseFloat(pricedOffer.price.total);
            const priceWithMargin = originalPrice * (1 + percent / 100);
            // Amadeus usually uses strings for prices
            pricedOffer.price.total = priceWithMargin.toFixed(2);
            return (0, apiResponse_1.sendSuccess)(res, "Flight price confirmed", pricedOffer);
        }
        catch (error) {
            console.error("Pricing Error:", ((_c = error.response) === null || _c === void 0 ? void 0 : _c.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Failed to confirm flight price", 500, error);
        }
    });
}
function saveSelectedFlightOffer(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { flightOffer, userId } = req.body; // Keeping userId in destructuring but not usage if schema doesn't support it
        if (!flightOffer) {
            return (0, apiResponse_1.sendError)(res, "Missing flight offer data", 400);
        }
        try {
            const savedOffer = yield prisma_1.prisma.flightOffer.create({
                data: {
                    offerData: flightOffer, // Store JSON
                },
            });
            return (0, apiResponse_1.sendSuccess)(res, "Flight offer saved successfully", { flightOfferId: savedOffer.id }, 201);
        }
        catch (error) {
            console.error("Save Offer Error:", error);
            return (0, apiResponse_1.sendError)(res, "Failed to save flight offer", 500, error);
        }
    });
}
function getFlightOffers(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const offers = yield prisma_1.prisma.flightOffer.findMany({
                orderBy: { createdAt: "desc" },
            });
            return (0, apiResponse_1.sendSuccess)(res, "Saved flight offers retrieved", offers);
        }
        catch (error) {
            return (0, apiResponse_1.sendError)(res, "Failed to retrieve flight offers", 500, error);
        }
    });
}
function getFlightOfferById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        try {
            const offer = yield prisma_1.prisma.flightOffer.findUnique({
                where: { id },
            });
            if (!offer) {
                return (0, apiResponse_1.sendError)(res, "Flight offer not found", 404);
            }
            return (0, apiResponse_1.sendSuccess)(res, "Flight offer retrieved", offer);
        }
        catch (error) {
            return (0, apiResponse_1.sendError)(res, "Failed to retrieve flight offer", 500, error);
        }
    });
}
function retrieveFlightDetails(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { referenceId } = req.params;
        try {
            const token = yield (0, getToken_1.default)();
            const response = yield axios_1.default.get(`${baseURL}/v1/booking/flight-orders/${referenceId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const responseData = response.data;
            return (0, apiResponse_1.sendSuccess)(res, "Flight details retrieved", responseData.data);
        }
        catch (error) {
            console.error("Retrieve Details Error:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Failed to retrieve flight details", 500, error);
        }
    });
}
function deleteFlightBooking(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { referenceId } = req.params;
        try {
            const token = yield (0, getToken_1.default)();
            yield axios_1.default.delete(`${baseURL}/v1/booking/flight-orders/${referenceId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            yield prisma_1.prisma.booking.updateMany({
                where: { apiReferenceId: referenceId },
                data: { status: "CANCELED" },
            });
            return (0, apiResponse_1.sendSuccess)(res, "Flight booking deleted successfully");
        }
        catch (error) {
            console.error("Delete Booking Error:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Failed to delete flight booking", 500, error);
        }
    });
}
function getSeatMapsByFlightId(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { referenceId } = req.params;
        if (!referenceId)
            return (0, apiResponse_1.sendError)(res, "Reference ID required", 400);
        try {
            const token = yield (0, getToken_1.default)();
            const response = yield axios_1.default.get(`${baseURL}/v1/shopping/seatmaps`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { flightOrderId: referenceId }
            });
            return (0, apiResponse_1.sendSuccess)(res, "Seat maps retrieved", response.data);
        }
        catch (e) {
            return (0, apiResponse_1.sendError)(res, "Failed to get seat maps", 500, e);
        }
    });
}
function getOneFlightDetails(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { flightId } = req.params;
        try {
            const booking = yield prisma_1.prisma.booking.findUnique({
                where: { id: flightId },
                include: {
                    travelers: true,
                    FlightAddon: true,
                },
            });
            if (!booking)
                return (0, apiResponse_1.sendError)(res, "Booking not found", 404);
            return (0, apiResponse_1.sendSuccess)(res, "Booking retrieved", booking);
        }
        catch (error) {
            return (0, apiResponse_1.sendError)(res, "Failed to get booking", 500, error);
        }
    });
}
function updateFlightStatus(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { flightId } = req.params;
        const { status } = req.body;
        try {
            const updated = yield prisma_1.prisma.booking.update({
                where: { id: flightId },
                data: { status }
            });
            return (0, apiResponse_1.sendSuccess)(res, "Status updated", updated);
        }
        catch (err) {
            return (0, apiResponse_1.sendError)(res, "Update Failed", 500, err);
        }
    });
}
// ==========================================
// Renamed: Book Flight
// ==========================================
function bookFlight(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
        const { flightOffer, travelers, addonIds = [], userId } = req.body;
        try {
            if (!flightOffer || !travelers) {
                return (0, apiResponse_1.sendError)(res, "Missing required fields: flightOffer or travelers", 400);
            }
            if (!userId) {
                return (0, apiResponse_1.sendError)(res, "userId is required for this booking endpoint.", 400);
            }
            const userExists = yield prisma_1.prisma.user.findUnique({ where: { id: userId } });
            if (!userExists) {
                return (0, apiResponse_1.sendError)(res, "Invalid userId: user not found", 400);
            }
            // Transform travelers to Amadeus format if needed
            const amadeusTravelers = travelers.map((t, idx) => t.name && t.contact && t.documents
                ? Object.assign(Object.assign({}, t), { id: (idx + 1).toString() }) : (0, amadeusHelper_1.mapTravelerToAmadeusFormat)(t, (idx + 1).toString()));
            if (!((_b = (_a = amadeusTravelers[0]) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.firstName)) {
                return (0, apiResponse_1.sendError)(res, "Missing firstName in traveler data", 400);
            }
            const token = yield (0, getToken_1.default)();
            // Prepare Amadeus booking payload
            const payload = {
                data: {
                    type: "flight-order",
                    flightOffers: [flightOffer],
                    travelers: amadeusTravelers,
                },
            };
            // Book flight on Amadeus
            const response = yield axios_1.default.post(`${baseURL}/v1/booking/flight-orders`, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            const amadeusBooking = response.data;
            // Margin settings
            const marginSetting = yield prisma_1.prisma.marginSetting.findFirst({
                orderBy: { createdAt: "desc" },
            });
            if (!marginSetting) {
                return (0, apiResponse_1.sendError)(res, "Margin setting not configured", 500);
            }
            const marginPercentage = marginSetting.amount;
            // Extract base price using safe checks
            const bookedOffer = (_d = (_c = amadeusBooking === null || amadeusBooking === void 0 ? void 0 : amadeusBooking.data) === null || _c === void 0 ? void 0 : _c.flightOffers) === null || _d === void 0 ? void 0 : _d[0];
            if (!bookedOffer) {
                return (0, apiResponse_1.sendError)(res, "No flight offers found in Amadeus response", 500);
            }
            const basePriceNGN = parseFloat(((_e = bookedOffer.price) === null || _e === void 0 ? void 0 : _e.grandTotal) || "0");
            // Calculate margin and total
            const marginAdded = (marginPercentage / 100) * basePriceNGN;
            const originalTotalAmount = basePriceNGN + marginAdded;
            // Get conversion rate USD -> NGN for addons
            const conversionRate = yield (0, amadeusHelper_1.getConversionRate)("USD", "NGN");
            // Fetch addons and calculate total addon price in NGN
            let addons = [];
            let addonTotalNGN = 0;
            if (addonIds.length > 0) {
                addons = yield prisma_1.prisma.flightAddon.findMany({
                    where: { id: { in: addonIds } },
                });
                if (addons.length !== addonIds.length) {
                    return (0, apiResponse_1.sendError)(res, "One or more addonIds are invalid", 400);
                }
                addonTotalNGN = addons.reduce((sum, addon) => {
                    const priceInUsd = addon.price;
                    const priceInNgn = priceInUsd * conversionRate;
                    return sum + priceInNgn;
                }, 0);
            }
            // Calculate grand total amount including addons
            const totalAmountNGN = originalTotalAmount + addonTotalNGN;
            // Step 1: Create booking (without addons)
            const bookingData = {
                userId,
                referenceId: amadeusBooking.data.id,
                type: "FLIGHT",
                status: "CONFIRMED",
                verified: true,
                apiProvider: "AMADEUS",
                apiReferenceId: amadeusBooking.data.id,
                apiResponse: amadeusBooking,
                bookingDetails: flightOffer,
                totalAmount: +totalAmountNGN.toFixed(2),
                currency: "NGN",
                locationDetails: {},
                airlineDetails: {},
            };
            const booking = yield prisma_1.prisma.booking.create({ data: bookingData });
            // Step 2: Link existing addons to booking by updating bookingId
            if (addonIds.length > 0) {
                yield prisma_1.prisma.flightAddon.updateMany({
                    where: { id: { in: addonIds } },
                    data: { bookingId: booking.id },
                });
            }
            // Step 3: Save travelers linked to booking
            for (const t of travelers) {
                // Safe mapping with fallbacks
                const firstName = ((_f = t.name) === null || _f === void 0 ? void 0 : _f.firstName) || t.firstName || "Unknown";
                const lastName = ((_g = t.name) === null || _g === void 0 ? void 0 : _g.lastName) || t.lastName || "Unknown";
                const dob = t.dateOfBirth ? new Date(t.dateOfBirth) : new Date();
                const email = (_h = t.contact) === null || _h === void 0 ? void 0 : _h.emailAddress;
                yield prisma_1.prisma.traveler.create({
                    data: {
                        bookingId: booking.id,
                        userId,
                        firstName,
                        lastName,
                        dateOfBirth: dob,
                        gender: t.gender,
                        email,
                        phone: (_l = (_k = (_j = t.contact) === null || _j === void 0 ? void 0 : _j.phones) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.number,
                        countryCode: (_p = (_o = (_m = t.contact) === null || _m === void 0 ? void 0 : _m.phones) === null || _o === void 0 ? void 0 : _o[0]) === null || _p === void 0 ? void 0 : _p.countryCallingCode,
                        passportNumber: (_r = (_q = t.documents) === null || _q === void 0 ? void 0 : _q[0]) === null || _r === void 0 ? void 0 : _r.number,
                        passportExpiry: ((_t = (_s = t.documents) === null || _s === void 0 ? void 0 : _s[0]) === null || _t === void 0 ? void 0 : _t.expiryDate)
                            ? new Date(t.documents[0].expiryDate)
                            : undefined,
                        nationality: (_v = (_u = t.documents) === null || _u === void 0 ? void 0 : _u[0]) === null || _v === void 0 ? void 0 : _v.nationality,
                    },
                });
            }
            // Step 4: Clear user's cart
            yield prisma_1.prisma.flightCart.deleteMany({
                where: { userId: userId },
            });
            // Step 5: Fetch booking with addons
            const bookingWithAddons = yield prisma_1.prisma.booking.findUnique({
                where: { id: booking.id },
                include: { FlightAddon: true },
            });
            return (0, apiResponse_1.sendSuccess)(res, "Flight successfully booked with addons", {
                booking: bookingWithAddons,
                amadeus: amadeusBooking,
                originalTotalAmount: +originalTotalAmount.toFixed(2),
                addonTotal: +addonTotalNGN.toFixed(2),
                totalAmount: +totalAmountNGN.toFixed(2),
            }, 201);
        }
        catch (error) {
            console.error("Booking Error:", ((_w = error.response) === null || _w === void 0 ? void 0 : _w.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Flight booking failed", 500, error);
        }
    });
}
function bookFlightAsGuest(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        return (0, apiResponse_1.sendError)(res, "Guest booking temporarily unavailable during refactor", 503);
    });
}
function updateBookingStatus(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { referenceId } = req.params;
        const { status } = req.body;
        try {
            yield prisma_1.prisma.booking.updateMany({
                where: { apiReferenceId: referenceId },
                data: { status }
            });
            return (0, apiResponse_1.sendSuccess)(res, "Booking status updated");
        }
        catch (e) {
            return (0, apiResponse_1.sendError)(res, "Update failed", 500, e);
        }
    });
}
function getAirportDetails(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { iataCode } = req.query;
        if (!iataCode)
            return (0, apiResponse_1.sendError)(res, "IATA code required", 400);
        try {
            const details = yield (0, iata_1.getIataCodeDetails)(iataCode);
            return (0, apiResponse_1.sendSuccess)(res, "Details found", details);
        }
        catch (e) {
            return (0, apiResponse_1.sendError)(res, "Error finding details", 500, e);
        }
    });
}
function getAirlineDetailsEndpoint(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        // Placeholder
        return (0, apiResponse_1.sendSuccess)(res, "Airline details");
    });
}
function getAirlinesByAirport(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        // Placeholder
        return (0, apiResponse_1.sendSuccess)(res, "Airlines by airport");
    });
}
function getAirlinesByMultipleLocations(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        // Placeholder
        return (0, apiResponse_1.sendSuccess)(res, "Airlines by locations");
    });
}
function getFlightOffersRandom(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        // Placeholder
        return (0, apiResponse_1.sendSuccess)(res, "Random offers");
    });
}
function getFlightOfferDetails(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        // Placeholder
        return (0, apiResponse_1.sendSuccess)(res, "Offer details");
    });
}
