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
exports.getFlightOfferById = exports.getFlightOffers = exports.saveSelectedFlightOffer = void 0;
exports.searchFlights = searchFlights;
exports.searchFlightPrice = searchFlightPrice;
exports.retrieveFlightDetails = retrieveFlightDetails;
exports.deleteFlightBooking = deleteFlightBooking;
exports.getSeatMapsByFlightId = getSeatMapsByFlightId;
exports.getOneFlightDetails = getOneFlightDetails;
exports.updateFlightStatus = updateFlightStatus;
exports.bookFlightAsGuest = bookFlightAsGuest;
exports.updateBookingStatus = updateBookingStatus;
exports.getAirportDetails = getAirportDetails;
exports.getAirlineDetailsEndpoint = getAirlineDetailsEndpoint;
exports.getAirlinesByAirport = getAirlinesByAirport;
exports.getAirlinesByMultipleLocations = getAirlinesByMultipleLocations;
exports.getFlightOffersRandom = getFlightOffersRandom;
exports.getFlightOfferDetails = getFlightOfferDetails;
exports.bookFlightWithOptionalAddons = bookFlightWithOptionalAddons;
const axios_1 = __importDefault(require("axios"));
const getToken_1 = __importDefault(require("../utils/getToken"));
const prisma_1 = require("../lib/prisma");
const amadeusHelper_1 = require("../utils/amadeusHelper");
const helper_1 = require("../utils/helper");
const zeptomail_1 = require("../utils/zeptomail");
const iata_1 = require("../utils/iata");
const apiResponse_1 = require("../utils/apiResponse");
const baseURL = "https://test.api.amadeus.com";
function searchFlights(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const { origin: queryOrigin, destination: queryDestination, originLocationCode, destinationLocationCode, adults, departureDate, keyword, currency = "NGN", getAirportDetails = false, // New parameter to request airport details
         } = req.query;
        // Map alternate parameter names
        const origin = (queryOrigin || originLocationCode);
        const destination = (queryDestination || destinationLocationCode);
        try {
            const token = yield (0, getToken_1.default)();
            // If keyword is provided, return location suggestions
            if (keyword && typeof keyword === "string" && keyword.trim().length > 0) {
                try {
                    const { data } = yield axios_1.default.get(`${baseURL}/v1/reference-data/locations`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                        params: {
                            subType: "CITY,AIRPORT",
                            keyword,
                        },
                    });
                    const suggestions = data.data.map((item) => {
                        var _a, _b, _c, _d;
                        return (Object.assign({ name: item.name, iataCode: item.iataCode, cityCode: item.cityCode, countryName: item.countryName, stateCode: item.stateCode, regionCode: item.regionCode }, (getAirportDetails === "true" && {
                            detailedName: item.detailedName,
                            cityName: (_a = item.address) === null || _a === void 0 ? void 0 : _a.cityName,
                            countryCode: (_b = item.address) === null || _b === void 0 ? void 0 : _b.countryCode,
                            coordinates: {
                                latitude: (_c = item.geoCode) === null || _c === void 0 ? void 0 : _c.latitude,
                                longitude: (_d = item.geoCode) === null || _d === void 0 ? void 0 : _d.longitude,
                            },
                            timeZone: item.timeZoneOffset,
                            type: item.subType,
                            relevance: item.relevance,
                        })));
                    });
                    return (0, apiResponse_1.sendSuccess)(res, "Suggestions retrieved successfully", suggestions);
                }
                catch (suggestionError) {
                    console.error("Amadeus Location Search Error:", ((_a = suggestionError.response) === null || _a === void 0 ? void 0 : _a.data) || suggestionError.message);
                    return (0, apiResponse_1.sendSuccess)(res, "Failed to retrieve suggestions from provider", []);
                }
            }
            // NEW: If only getting airport details for specific IATA codes
            if (getAirportDetails === "true" && (origin || destination)) {
                const airportDetails = {};
                if (origin) {
                    try {
                        airportDetails.origin = yield (0, iata_1.getIataCodeDetails)(origin);
                    }
                    catch (error) {
                        console.error(`Failed to get details for origin ${origin}:`, error);
                        airportDetails.origin = { error: `Could not find details for ${origin}` };
                    }
                }
                if (destination) {
                    try {
                        airportDetails.destination = yield (0, iata_1.getIataCodeDetails)(destination);
                    }
                    catch (error) {
                        console.error(`Failed to get details for destination ${destination}:`, error);
                        airportDetails.destination = { error: `Could not find details for ${destination}` };
                    }
                }
                return (0, apiResponse_1.sendSuccess)(res, "Airport details retrieved successfully", airportDetails);
            }
            // For flight search, validate required fields
            if (!origin || !destination || !adults || !departureDate) {
                return (0, apiResponse_1.sendError)(res, "Missing required fields", 400);
            }
            const adultsNum = Number(adults);
            const originIata = yield (0, helper_1.getCachedIataCode)(origin, token);
            const destinationIata = yield (0, helper_1.getCachedIataCode)(destination, token);
            if (!originIata || !destinationIata) {
                return (0, apiResponse_1.sendError)(res, "Could not resolve IATA codes", 400);
            }
            let originInfo = null;
            let destinationInfo = null;
            if (getAirportDetails === "true") {
                try {
                    const [ori, dest] = yield Promise.allSettled([
                        (0, iata_1.getIataCodeDetails)(originIata),
                        (0, iata_1.getIataCodeDetails)(destinationIata),
                    ]);
                    originInfo = ori.status === "fulfilled" ? ori.value : null;
                    destinationInfo = dest.status === "fulfilled" ? dest.value : null;
                }
                catch (e) {
                    console.error("Error getting airport details:", e);
                }
            }
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
                max: 7,
            };
            if (excludedCodesArray.length > 0) {
                params.excludedAirlineCodes = excludedCodesArray.join(",");
            }
            const flightResponse = yield axios_1.default.get(`${baseURL}/v2/shopping/flight-offers`, {
                headers: { Authorization: `Bearer ${token}` },
                params,
            });
            const offers = flightResponse.data.data;
            const marginSetting = yield prisma_1.prisma.marginSetting.findFirst();
            const percent = (marginSetting === null || marginSetting === void 0 ? void 0 : marginSetting.amount) || 0;
            const adjustedOffers = offers.map((offer) => {
                const originalPrice = parseFloat(offer.price.total);
                const priceWithMargin = originalPrice * (1 + percent / 100);
                return Object.assign(Object.assign({}, offer), { price: Object.assign(Object.assign({}, offer.price), { total: parseFloat(priceWithMargin.toFixed(2)), grandTotal: parseFloat(priceWithMargin.toFixed(2)) }) });
            });
            // Enrichment optimization: Collect all unique IATA codes first
            const uniqueIatas = new Set();
            for (const offer of adjustedOffers) {
                for (const itinerary of offer.itineraries) {
                    for (const segment of itinerary.segments) {
                        uniqueIatas.add(segment.departure.iataCode);
                        uniqueIatas.add(segment.arrival.iataCode);
                    }
                }
            }
            // Fetch unique details with staggered delay to avoid 429
            const cityDetailsMap = new Map();
            const iataArray = Array.from(uniqueIatas);
            // Process unique IATAs in sequence with a delay
            for (const iataCode of iataArray) {
                const details = yield (0, helper_1.getCachedLocationDetails)(iataCode, token);
                if (details) {
                    cityDetailsMap.set(iataCode, details);
                }
            }
            // Assign details back to segments
            for (const offer of adjustedOffers) {
                for (const itinerary of offer.itineraries) {
                    for (const segment of itinerary.segments) {
                        segment.departure.details = cityDetailsMap.get(segment.departure.iataCode) || null;
                        segment.arrival.details = cityDetailsMap.get(segment.arrival.iataCode) || null;
                    }
                }
            }
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
                responseData.airportDetails = {
                    origin: originInfo,
                    destination: destinationInfo,
                };
            }
            return (0, apiResponse_1.sendSuccess)(res, "Flight offers retrieved successfully", responseData);
        }
        catch (error) {
            console.error("Flight Search Error:", ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Failed to fetch flight offers", ((_c = error.response) === null || _c === void 0 ? void 0 : _c.status) || 500, ((_d = error.response) === null || _d === void 0 ? void 0 : _d.data) || error);
        }
    });
}
function searchFlightPrice(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { flightOffer } = req.body;
            if (!flightOffer) {
                return (0, apiResponse_1.sendError)(res, "Missing flight offer in request body", 400);
            }
            const token = yield (0, getToken_1.default)();
            const payload = {
                data: {
                    type: "flight-offers-pricing",
                    flightOffers: [flightOffer],
                },
            };
            const response = yield axios_1.default.post(`${baseURL}/v1/shopping/flight-offers/pricing`, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    "X-HTTP-Method-Override": "GET",
                },
            });
            const marginSetting = yield prisma_1.prisma.marginSetting.findFirst({
                orderBy: { createdAt: "desc" },
            });
            if (!marginSetting) {
                return (0, apiResponse_1.sendError)(res, "Margin setting not configured", 500);
            }
            const marginPercentage = marginSetting.amount;
            const modifiedFlightOffers = response.data.data.flightOffers.map((offer) => {
                const originalTotal = parseFloat(offer.price.total);
                const originalGrandTotal = parseFloat(offer.price.grandTotal);
                const marginAdded = (marginPercentage / 100) * originalGrandTotal;
                return Object.assign(Object.assign({}, offer), { price: Object.assign(Object.assign({}, offer.price), { total: (originalTotal + marginAdded).toFixed(2), grandTotal: (originalGrandTotal + marginAdded).toFixed(2), originalTotal: originalTotal.toFixed(2), originalGrandTotal: originalGrandTotal.toFixed(2), marginAdded: {
                            value: marginAdded.toFixed(2),
                            percentage: marginPercentage,
                        } }) });
            });
            // Enrich segments with detailed location info
            for (const offer of modifiedFlightOffers) {
                for (const itinerary of offer.itineraries) {
                    for (const segment of itinerary.segments) {
                        const originDetails = yield (0, helper_1.getCachedLocationDetails)(segment.departure.iataCode, token);
                        const destinationDetails = yield (0, helper_1.getCachedLocationDetails)(segment.arrival.iataCode, token);
                        segment.departure.details = originDetails;
                        segment.arrival.details = destinationDetails;
                    }
                }
            }
            return (0, apiResponse_1.sendSuccess)(res, "Flight pricing retrieved successfully", Object.assign(Object.assign({}, response.data), { data: Object.assign(Object.assign({}, response.data.data), { flightOffers: modifiedFlightOffers }) }));
        }
        catch (error) {
            console.error("Flight pricing error:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Failed to fetch flight pricing", 500, error);
        }
    });
}
const saveSelectedFlightOffer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { offerData } = req.body;
        if (!offerData) {
            return (0, apiResponse_1.sendError)(res, "Missing offer data", 400);
        }
        const savedOffer = yield prisma_1.prisma.flightOffer.create({
            data: {
                offerData,
            },
        });
        return (0, apiResponse_1.sendSuccess)(res, "Flight offer saved successfully", { flightOfferId: savedOffer.id }, 201);
    }
    catch (error) {
        console.error("Error saving flight offer:", error);
        return (0, apiResponse_1.sendError)(res, "Server error", 500, error);
    }
});
exports.saveSelectedFlightOffer = saveSelectedFlightOffer;
const getFlightOffers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const flightOffers = yield prisma_1.prisma.flightOffer.findMany({
            orderBy: { createdAt: "desc" },
        });
        return (0, apiResponse_1.sendSuccess)(res, "Flight offers retrieved successfully", flightOffers);
    }
    catch (error) {
        console.error("Error fetching flight offers:", error);
        return (0, apiResponse_1.sendError)(res, "Server error", 500, error);
    }
});
exports.getFlightOffers = getFlightOffers;
const getFlightOfferById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!id) {
            return (0, apiResponse_1.sendError)(res, "Flight offer ID is required", 400);
        }
        const flightOffer = yield prisma_1.prisma.flightOffer.findUnique({
            where: { id },
            include: {
                travelers: true,
                addons: true,
            },
        });
        if (!flightOffer) {
            return (0, apiResponse_1.sendError)(res, "Flight offer not found", 404);
        }
        return (0, apiResponse_1.sendSuccess)(res, "Flight offer retrieved successfully", flightOffer);
    }
    catch (error) {
        console.error("Error fetching flight offer:", error);
        return (0, apiResponse_1.sendError)(res, "Server error", 500, error);
    }
});
exports.getFlightOfferById = getFlightOfferById;
function retrieveFlightDetails(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const rawReferenceId = req.params.referenceId;
            if (!rawReferenceId) {
                return (0, apiResponse_1.sendError)(res, "Reference parameter is required", 400);
            }
            // Decode incoming param
            const decodedReferenceId = decodeURIComponent(rawReferenceId);
            // Re-encode for URL safety
            const encodedReferenceId = encodeURIComponent(decodedReferenceId);
            // console.log("Raw referenceId param:", rawReferenceId);
            // console.log("Decoded referenceId:", decodedReferenceId);
            // console.log("Encoded referenceId for URL:", encodedReferenceId);
            const token = yield (0, getToken_1.default)();
            const response = yield axios_1.default.get(`${baseURL}/v1/booking/flight-orders/${encodedReferenceId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            return (0, apiResponse_1.sendSuccess)(res, "Flight details retrieved successfully", response.data);
        }
        catch (error) {
            console.error("Error retrieving flight details:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function deleteFlightBooking(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const rawReferenceId = req.params.referenceId; // Kept this line as it was already there
            if (!rawReferenceId) {
                return (0, apiResponse_1.sendError)(res, "Reference ID is required", 400);
            }
            const decodedReferenceId = decodeURIComponent(rawReferenceId);
            const encodedReferenceId = encodeURIComponent(decodedReferenceId);
            const booking = yield prisma_1.prisma.booking.findUnique({
                where: { referenceId: encodedReferenceId },
            });
            if (!booking) {
                return (0, apiResponse_1.sendError)(res, "Booking not found in local database", 404);
            }
            const token = yield (0, getToken_1.default)();
            yield axios_1.default.delete(`${baseURL}/v1/booking/flight-orders/${encodedReferenceId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            yield prisma_1.prisma.booking.delete({
                where: { referenceId: encodedReferenceId },
            });
            return (0, apiResponse_1.sendSuccess)(res, "Booking successfully cancelled and deleted");
        }
        catch (error) {
            console.error("Error deleting booking:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            if (((_b = error.response) === null || _b === void 0 ? void 0 : _b.status) === 404) {
                return (0, apiResponse_1.sendError)(res, "Booking not found in Amadeus or already deleted", 404);
            }
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function getSeatMapsByFlightId(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { referenceId } = req.params; // Kept this line as it was already there
            if (!referenceId) {
                return (0, apiResponse_1.sendError)(res, "Flight order ID is required", 400);
            }
            const token = yield (0, getToken_1.default)();
            // Call Amadeus Seat Maps API with correct parameter name and no manual encoding
            const response = yield axios_1.default.get(`${baseURL}/v1/shopping/seatmaps`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                params: {
                    flightOrderId: referenceId, // Correct parameter name (camelCase, no hyphen)
                },
            });
            return (0, apiResponse_1.sendSuccess)(res, "Seat maps fetched successfully", response.data);
        }
        catch (error) {
            console.error("Error occurred while fetching seat maps:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function getOneFlightDetails(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { flightId } = req.params;
            if (!flightId) {
                return (0, apiResponse_1.sendError)(res, "Reference parameter is required", 400);
            }
            const response = yield prisma_1.prisma.booking.findUnique({
                where: { id: flightId },
            });
            if (!response) {
                return (0, apiResponse_1.sendError)(res, "This Flight cannot be found", 404);
            }
            return (0, apiResponse_1.sendSuccess)(res, "Flight details retrieved successfully", response);
        }
        catch (error) {
            console.error("Error retrieving flight details:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function updateFlightStatus(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { flightId } = req.params;
            const { status } = req.body;
            if (!flightId) {
                return (0, apiResponse_1.sendError)(res, "Reference parameter is required", 400);
            }
            const flightInfo = yield prisma_1.prisma.booking.update({
                where: { id: flightId },
                data: {
                    status: status,
                },
            });
            return (0, apiResponse_1.sendSuccess)(res, "Flight status updated successfully", flightInfo);
        }
        catch (error) {
            console.error("Error retrieving flight details:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function bookFlightAsGuest(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const { flightOffer, travelers, addonIds = [], guestUserId } = req.body;
        try {
            console.log("Received booking request with:", {
                flightOfferExists: !!flightOffer,
                travelersCount: (travelers === null || travelers === void 0 ? void 0 : travelers.length) || 0,
                addonIds,
                travelers,
                flightOffer,
                guestUserId,
            });
            if (!flightOffer || !travelers) {
                return (0, apiResponse_1.sendError)(res, "Missing required fields: flightOffer or travelers", 400);
            }
            // Validate guestUserId
            if (!guestUserId) {
                return (0, apiResponse_1.sendError)(res, "guestUserId is required for guest booking.", 400);
            }
            const guestExists = yield prisma_1.prisma.guestUser.findUnique({
                where: { id: guestUserId },
            });
            if (!guestExists) {
                return (0, apiResponse_1.sendError)(res, "Invalid guestUserId: guest user not found", 400);
            }
            // Transform travelers to Amadeus format if needed
            const amadeusTravelers = travelers.map((t, idx) => t.name && t.contact && t.documents
                ? Object.assign(Object.assign({}, t), { id: (idx + 1).toString() }) : (0, amadeusHelper_1.mapTravelerToAmadeusFormat)(t, (idx + 1).toString()));
            const token = yield (0, getToken_1.default)();
            // Prepare Amadeus booking payload
            const payload = {
                data: {
                    type: "flight-order",
                    flightOffers: [flightOffer],
                    travelers: amadeusTravelers,
                    holder: {
                        name: {
                            firstName: amadeusTravelers[0].name.firstName,
                            lastName: amadeusTravelers[0].name.lastName,
                        },
                    },
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
            // Extract base price from Amadeus response
            const flightOffersFromResp = ((_a = amadeusBooking === null || amadeusBooking === void 0 ? void 0 : amadeusBooking.data) === null || _a === void 0 ? void 0 : _a.flightOffers) || [];
            if (flightOffersFromResp.length === 0) {
                return (0, apiResponse_1.sendError)(res, "No flight offers found in Amadeus response", 500);
            }
            const basePriceNGN = parseFloat(((_b = flightOffersFromResp[0].price) === null || _b === void 0 ? void 0 : _b.grandTotal) || "0");
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
                guestUserId,
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
                yield prisma_1.prisma.traveler.create({
                    data: {
                        bookingId: booking.id,
                        guestUserId, // link traveler to guest user
                        firstName: t.name.firstName,
                        lastName: t.name.lastName,
                        dateOfBirth: new Date(t.dateOfBirth),
                        gender: t.gender,
                        email: t.contact.emailAddress,
                        phone: (_d = (_c = t.contact.phones) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.number,
                        countryCode: (_f = (_e = t.contact.phones) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.countryCallingCode,
                        passportNumber: (_h = (_g = t.documents) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.number,
                        passportExpiry: ((_k = (_j = t.documents) === null || _j === void 0 ? void 0 : _j[0]) === null || _k === void 0 ? void 0 : _k.expiryDate)
                            ? new Date(t.documents[0].expiryDate)
                            : undefined,
                        nationality: (_m = (_l = t.documents) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.nationality,
                    },
                });
            }
            // Step 4: Fetch booking with addons included
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
            console.error("Booking Error:", ((_o = error.response) === null || _o === void 0 ? void 0 : _o.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Flight booking failed", 500, error);
        }
    });
}
// PATCH /booking/:referenceId/status
function updateBookingStatus(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { referenceId } = req.params;
        const { status, verified } = req.body;
        if (!referenceId) {
            return (0, apiResponse_1.sendError)(res, "referenceId is required", 400);
        }
        if (!status && typeof verified === "undefined") {
            return (0, apiResponse_1.sendError)(res, "At least one of status or verified must be provided", 400);
        }
        try {
            const booking = yield prisma_1.prisma.booking.findUnique({ where: { referenceId } });
            if (!booking) {
                return (0, apiResponse_1.sendError)(res, "Booking not found", 404);
            }
            const updatedBooking = yield prisma_1.prisma.booking.update({
                where: { referenceId },
                data: Object.assign(Object.assign({}, (status && { status })), (typeof verified === "boolean" && { verified })),
            });
            return (0, apiResponse_1.sendSuccess)(res, "Booking status updated successfully", updatedBooking);
        }
        catch (error) {
            console.error("Error updating booking status:", error.message);
            return (0, apiResponse_1.sendError)(res, "Failed to update booking status", 500, error);
        }
    });
}
// New endpoint to get airport name/details by IATA code
function getAirportDetails(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        try {
            const { iataCode } = req.query;
            if (!iataCode || typeof iataCode !== "string") {
                return (0, apiResponse_1.sendError)(res, "Missing or invalid IATA code", 400);
            }
            const token = yield (0, getToken_1.default)();
            const airportDetails = yield (0, helper_1.getCachedLocationDetails)(iataCode, token);
            if (!airportDetails) {
                return (0, apiResponse_1.sendError)(res, "Airport not found", 404);
            }
            return (0, apiResponse_1.sendSuccess)(res, "Airport details fetched successfully", {
                iataCode: airportDetails.iataCode,
                name: airportDetails.name,
                detailedName: airportDetails.detailedName,
                city: (_a = airportDetails.address) === null || _a === void 0 ? void 0 : _a.cityName,
                cityCode: (_b = airportDetails.address) === null || _b === void 0 ? void 0 : _b.cityCode,
                country: (_c = airportDetails.address) === null || _c === void 0 ? void 0 : _c.countryName,
                countryCode: (_d = airportDetails.address) === null || _d === void 0 ? void 0 : _d.countryCode,
                regionCode: (_e = airportDetails.address) === null || _e === void 0 ? void 0 : _e.regionCode,
                timeZone: airportDetails.timeZoneOffset,
                coordinates: airportDetails.geoCode,
                analytics: airportDetails.analytics,
                type: airportDetails.type,
                subType: airportDetails.subType,
                id: airportDetails.id,
                selfLink: (_f = airportDetails.self) === null || _f === void 0 ? void 0 : _f.href,
            });
        }
        catch (error) {
            console.error("Airport details error:", ((_g = error.response) === null || _g === void 0 ? void 0 : _g.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Failed to fetch airport details", 500, error);
        }
    });
}
// Function to get airline details by IATA code
function getAirlineDetails(iataCode, token) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield axios_1.default.get(`${baseURL}/v1/reference-data/airlines?airlineCodes=${iataCode}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (response.data && response.data.data && response.data.data.length > 0) {
            return response.data.data[0]; // airline details object
        }
        return null;
    });
}
// Express route handler to get airline details
function getAirlineDetailsEndpoint(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { iataCode } = req.query;
            if (!iataCode || typeof iataCode !== "string") {
                return (0, apiResponse_1.sendError)(res, "Missing or invalid IATA code", 400);
            }
            const token = yield (0, getToken_1.default)();
            const airlineDetails = yield getAirlineDetails(iataCode, token);
            if (!airlineDetails) {
                return (0, apiResponse_1.sendError)(res, "Airline not found", 404);
            }
            return (0, apiResponse_1.sendSuccess)(res, "Airline details fetched successfully", {
                iataCode,
                type: airlineDetails === null || airlineDetails === void 0 ? void 0 : airlineDetails.type,
                icaoCode: airlineDetails === null || airlineDetails === void 0 ? void 0 : airlineDetails.icaoCode,
                businessName: airlineDetails === null || airlineDetails === void 0 ? void 0 : airlineDetails.businessName,
                commonName: airlineDetails === null || airlineDetails === void 0 ? void 0 : airlineDetails.businessName,
            });
        }
        catch (error) {
            console.error("Airline details error:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Failed to fetch airline details", 500, error);
        }
    });
}
// Search flights departing from the airport to any destination (limited results)
function searchFlightsFromAirport(originIata, destinationIata, departureDate, adults, token) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield axios_1.default.get(`${baseURL}/v2/shopping/flight-offers`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            params: {
                originLocationCode: originIata,
                destinationLocationCode: destinationIata,
                departureDate: departureDate,
                adults: adults,
                max: 50,
            },
        });
        return response.data.data || [];
    });
}
// Fetch airline details by multiple airline codes (comma separated)
function getAirlinesDetails(airlineCodes, token) {
    return __awaiter(this, void 0, void 0, function* () {
        if (airlineCodes.length === 0)
            return [];
        const codesParam = airlineCodes.join(",");
        const response = yield axios_1.default.get(`${baseURL}/v1/reference-data/airlines?airlineCodes=${codesParam}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data.data || [];
    });
}
// Express route handler to get airlines operating at an airport via flight offers
function getAirlinesByAirport(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { iataCode, destinationCode, departureDate, adults } = req.query;
            if (!iataCode ||
                typeof iataCode !== "string" ||
                !destinationCode ||
                typeof destinationCode !== "string" ||
                !departureDate ||
                typeof departureDate !== "string" ||
                !adults ||
                isNaN(Number(adults))) {
                return (0, apiResponse_1.sendError)(res, "Missing or invalid parameters: iataCode, destinationCode, departureDate, adults are required", 400);
            }
            const iataCodeUpper = iataCode.toUpperCase();
            const destinationCodeUpper = destinationCode.toUpperCase();
            const token = yield (0, getToken_1.default)();
            console.log(`token`, token);
            // Step 1: Search flight offers departing from the airport
            const flightOffers = yield searchFlightsFromAirport(iataCodeUpper, destinationCodeUpper, departureDate, Number(adults), token);
            console.log(`flightOffers`, flightOffers);
            // Step 2: Extract unique airline codes from flight offers
            const airlineCodesSet = new Set();
            for (const offer of flightOffers) {
                if (offer.validatingAirlineCodes &&
                    offer.validatingAirlineCodes.length > 0) {
                    offer.validatingAirlineCodes.forEach((code) => airlineCodesSet.add(code));
                }
                // Also consider segments airline codes if needed:
                if (offer.itineraries) {
                    offer.itineraries.forEach((itinerary) => {
                        itinerary.segments.forEach((segment) => {
                            if (segment.carrierCode)
                                airlineCodesSet.add(segment.carrierCode);
                        });
                    });
                }
            }
            const airlineCodes = Array.from(airlineCodesSet);
            console.log(`airlineCodes`, airlineCodes);
            if (airlineCodes.length === 0) {
                return (0, apiResponse_1.sendSuccess)(res, "No airlines found for the given airport", {
                    airport: iataCodeUpper,
                    airlines: [],
                });
            }
            // Step 3: Fetch airline details for these airline codes
            const airlinesDetails = yield getAirlinesDetails(airlineCodes, token);
            console.log(`airlinesDetails`, airlinesDetails);
            // Step 4: Return airline details
            return (0, apiResponse_1.sendSuccess)(res, "Airline details fetched successfully", {
                airport: iataCodeUpper,
                airlines: airlinesDetails.map((airline) => ({
                    iataCode: airline.iataCode,
                    icaoCode: airline.icaoCode,
                    businessName: airline.businessName || airline.name || null,
                    type: airline.type,
                })),
            });
        }
        catch (error) {
            console.error("Error fetching airlines by airport:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Failed to fetch airlines for the airport", 500, error);
        }
    });
}
function getAirlinesByMultipleLocations(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const { iataCodes } = req.query;
            if (!iataCodes || typeof iataCodes !== "string") {
                return res
                    .status(400)
                    .json({ error: "Missing or invalid 'iataCodes' query parameter" });
            }
            // Split comma-separated IATA codes and uppercase them
            const airports = iataCodes
                .split(",")
                .map((code) => code.trim().toUpperCase())
                .filter((code) => code.length === 3);
            if (airports.length === 0) {
                return res
                    .status(400)
                    .json({ error: "No valid IATA codes provided in 'iataCodes'" });
            }
            const token = yield (0, getToken_1.default)();
            const airlineCodesSet = new Set();
            // Fetch routes for each airport to get airline codes
            for (const airport of airports) {
                try {
                    const response = yield axios_1.default.get(`${baseURL}/v1/airport/routes`, {
                        params: { departureAirportCode: airport },
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    });
                    const routes = response.data.data || [];
                    for (const route of routes) {
                        if (route.airlineCode) {
                            airlineCodesSet.add(route.airlineCode);
                        }
                    }
                }
                catch (err) {
                    console.warn(`Failed to fetch routes for airport ${airport}:`, ((_a = err.response) === null || _a === void 0 ? void 0 : _a.data) || err.message);
                    // Continue for other airports even if one fails
                }
            }
            const airlineCodes = Array.from(airlineCodesSet);
            if (airlineCodes.length === 0) {
                return (0, apiResponse_1.sendSuccess)(res, "No airlines found for the provided airports", {
                    airlines: [],
                });
            }
            // Fetch airline details in bulk
            const airlinesResponse = yield axios_1.default.get(`${baseURL}/v1/reference-data/airlines`, {
                params: { airlineCodes: airlineCodes.join(",") },
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const airlines = airlinesResponse.data.data || [];
            return (0, apiResponse_1.sendSuccess)(res, "Airline details retrieved successfully", {
                airports,
                airlines,
            });
        }
        catch (error) {
            console.error("Error fetching airlines by multiple locations:", ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Failed to fetch airlines for the provided locations", 500, error);
        }
    });
}
// Fallback random IATA codes if input invalid or missing
const fallbackOrigins = [
    "JFK",
    "LHR",
    "CDG",
    "FRA",
    "DXB",
    "NRT",
    "HKG",
    "YYZ",
    "ORD",
    "ATL",
    "ICN",
    "MAD",
    "GRU",
    "JNB",
    "DEL",
];
const fallbackDestinations = [
    "LAX",
    "AMS",
    "HND",
    "SIN",
    "SYD",
    "BKK",
    "SFO",
    "MIA",
    "MEX",
    "BCN",
    "MUC",
    "KUL",
    "DOH",
    "IST",
    "CAI",
];
const flightOfferCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
const extendedFallbacks = new Map([
    ["JFK", "New York"],
    ["LHR", "London"],
    ["CDG", "Paris"],
    ["FRA", "Frankfurt"],
    ["DXB", "Dubai"],
    ["NRT", "Tokyo"],
    // Add more mappings as needed
]);
function getRandomFromArray(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function isValidIataCode(code) {
    return (typeof code === "string" && code.length === 3 && /^[A-Z]{3}$/.test(code));
}
function getCityOrFallback(iataCode, token) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!isValidIataCode(iataCode))
            return "Unknown Location";
        if (extendedFallbacks.has(iataCode)) {
            return extendedFallbacks.get(iataCode);
        }
        try {
            const response = yield axios_1.default.get(`${baseURL}/v1/reference-data/locations`, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    keyword: iataCode,
                    subType: "AIRPORT",
                    "page[limit]": 1,
                },
            });
            const location = (_a = response.data.data) === null || _a === void 0 ? void 0 : _a[0];
            return ((_b = location === null || location === void 0 ? void 0 : location.address) === null || _b === void 0 ? void 0 : _b.cityName) || iataCode;
        }
        catch (error) {
            console.error(`Failed to fetch city for IATA code ${iataCode}:`, error.message);
            return iataCode;
        }
    });
}
function enrichFlightOffersWithLocations(offers, token) {
    return __awaiter(this, void 0, void 0, function* () {
        const uniqueIatas = new Set();
        const locationMap = new Map();
        offers.forEach((offer) => {
            var _a, _b, _c, _d, _e;
            const segment = (_c = (_b = (_a = offer.itineraries) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.segments) === null || _c === void 0 ? void 0 : _c[0];
            if ((_d = segment === null || segment === void 0 ? void 0 : segment.departure) === null || _d === void 0 ? void 0 : _d.iataCode)
                uniqueIatas.add(segment.departure.iataCode);
            if ((_e = segment === null || segment === void 0 ? void 0 : segment.arrival) === null || _e === void 0 ? void 0 : _e.iataCode)
                uniqueIatas.add(segment.arrival.iataCode);
        });
        // Process in batches to avoid rate limiting
        const batchSize = 6;
        const iataArray = Array.from(uniqueIatas);
        for (let i = 0; i < iataArray.length; i += batchSize) {
            const batch = iataArray.slice(i, i + batchSize);
            yield Promise.all(batch.map((iata) => __awaiter(this, void 0, void 0, function* () {
                const city = yield getCityOrFallback(iata, token);
                locationMap.set(iata, city);
            })));
            // Add delay between batches if needed
            if (i + batchSize < iataArray.length) {
                yield new Promise((resolve) => setTimeout(resolve, 200));
            }
        }
        return offers.map((offer) => {
            var _a, _b, _c, _d, _e;
            const segment = (_c = (_b = (_a = offer.itineraries) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.segments) === null || _c === void 0 ? void 0 : _c[0];
            const fromIata = (_d = segment === null || segment === void 0 ? void 0 : segment.departure) === null || _d === void 0 ? void 0 : _d.iataCode;
            const toIata = (_e = segment === null || segment === void 0 ? void 0 : segment.arrival) === null || _e === void 0 ? void 0 : _e.iataCode;
            return Object.assign(Object.assign({}, offer), { fromCity: fromIata
                    ? locationMap.get(fromIata) || fromIata
                    : "Unknown Location", toCity: toIata ? locationMap.get(toIata) || toIata : "Unknown Location" });
        });
    });
}
function removeDuplicateOffers(offers) {
    const seen = new Set();
    return offers.filter((offer) => {
        if (!offer.id)
            return true;
        if (seen.has(offer.id))
            return false;
        seen.add(offer.id);
        return true;
    });
}
function getFlightOffersRandom(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const cacheKey = JSON.stringify(req.query);
            const cachedResponse = flightOfferCache.get(cacheKey);
            if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL) {
                return (0, apiResponse_1.sendSuccess)(res, "Flight offers retrieved successfully (from cache)", cachedResponse.data);
            }
            const token = yield (0, getToken_1.default)();
            let { origin, destination, adults, departureDate, currencyCode } = req.query;
            if (!isValidIataCode(origin)) {
                origin = getRandomFromArray(fallbackOrigins);
            }
            if (!isValidIataCode(destination)) {
                destination = getRandomFromArray(fallbackDestinations);
            }
            const adultsNum = adults && !isNaN(Number(adults)) && Number(adults) > 0
                ? Number(adults)
                : 1;
            const today = new Date();
            const defaultDeparture = new Date(today.setDate(today.getDate() + 7))
                .toISOString()
                .split("T")[0];
            if (!departureDate ||
                typeof departureDate !== "string" ||
                !/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) {
                departureDate = defaultDeparture;
            }
            if (!currencyCode ||
                typeof currencyCode !== "string" ||
                currencyCode.length !== 3) {
                currencyCode = "USD";
            }
            const params = {
                originLocationCode: origin.toUpperCase(),
                destinationLocationCode: destination.toUpperCase(),
                departureDate,
                adults: adultsNum,
                max: 6,
                currencyCode: currencyCode.toUpperCase(),
            };
            const response = yield axios_1.default.get(`${baseURL}/v2/shopping/flight-offers`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Cache-Control": "public, max-age=300",
                },
                params,
            });
            const offers = response.data.data || [];
            const uniqueOffers = removeDuplicateOffers(offers);
            const enrichedOffers = yield enrichFlightOffersWithLocations(uniqueOffers, token);
            flightOfferCache.set(cacheKey, {
                data: enrichedOffers,
                timestamp: Date.now(),
            });
            return (0, apiResponse_1.sendSuccess)(res, "Flight offers retrieved successfully", enrichedOffers);
        }
        catch (error) {
            console.error("Amadeus flight offers error:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            const cacheKey = JSON.stringify(req.query);
            const cachedResponse = flightOfferCache.get(cacheKey);
            if (cachedResponse) {
                return (0, apiResponse_1.sendSuccess)(res, "Flight offers retrieved successfully (from cache)", cachedResponse.data);
            }
            return (0, apiResponse_1.sendError)(res, "Failed to fetch flight offers", 500, error);
        }
    });
}
// const flightPricingCache = new Map<string, any>();
function getFlightOfferDetails(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const { flightOffer } = req.body;
            // Basic validation
            if (!flightOffer || typeof flightOffer !== "object") {
                return (0, apiResponse_1.sendError)(res, "Flight offer object is required", 400);
            }
            // Verify required fields
            if (!flightOffer.id || !flightOffer.itineraries || !flightOffer.price) {
                return (0, apiResponse_1.sendError)(res, "Invalid flight offer structure", 400, { requiredFields: ["id", "itineraries", "price"] });
            }
            // Get Amadeus token
            const token = yield (0, getToken_1.default)();
            if (!token) {
                return (0, apiResponse_1.sendError)(res, "Failed to authenticate with Amadeus", 500);
            }
            // Prepare request body for Amadeus API
            const requestBody = {
                data: {
                    type: "flight-offers-pricing",
                    flightOffers: [flightOffer],
                },
            };
            // Call Amadeus pricing API
            const response = yield axios_1.default.post(`${baseURL}/v2/shopping/flight-offers/pricing`, requestBody, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                timeout: 10000,
            });
            // Return the priced flight offer
            return (0, apiResponse_1.sendSuccess)(res, "Flight offer details retrieved successfully", response.data.data);
        }
        catch (error) {
            console.error("Flight offer details error:", error.message);
            // Handle Amadeus API errors
            if ((_b = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.errors) {
                const errors = error.response.data.errors
                    .map((err) => `${err.code}: ${err.detail}`)
                    .join("; ");
                return (0, apiResponse_1.sendError)(res, "Amadeus API error", 400, { details: errors });
            }
            // Handle other errors
            return (0, apiResponse_1.sendError)(res, "Failed to get flight details", 500, error);
        }
    });
}
// export async function bookFlightWithOptionalAddons(
//   req: Request,
//   res: Response
// ): Promise<any> {
//   const { flightOffer, travelers, addonIds = [], userId } = req.body;
//   try {
//     console.log("Received booking request with:", {
//       flightOfferExists: !!flightOffer,
//       travelersCount: travelers?.length || 0,
//       addonIds,
//       userId,
//       travelers,
//       flightOffer,
//     });
//     if (!flightOffer || !travelers) {
//       return res.status(400).json({
//         error: "Missing required fields: flightOffer or travelers",
//       });
//     }
//     if (!userId) {
//       return res
//         .status(400)
//         .json({ error: "userId is required for this booking endpoint." });
//     }
//     const userExists = await prisma.user.findUnique({ where: { id: userId } });
//     if (!userExists) {
//       return res.status(400).json({ error: "Invalid userId: user not found" });
//     }
//     const amadeusTravelers = travelers.map((t: any, idx: number) =>
//       t.name && t.contact && t.documents
//         ? { ...t, id: (idx + 1).toString() }
//         : mapTravelerToAmadeusFormat(t, (idx + 1).toString())
//     );
//     if (!amadeusTravelers[0]?.name?.firstName) {
//       return res.status(400).json({
//         error: "Missing firstName in traveler data",
//       });
//     }
//     const token = await getAmadeusToken();
//     const payload = {
//       data: {
//         type: "flight-order",
//         flightOffers: [flightOffer],
//         travelers: amadeusTravelers,
//         holder: {
//           name: {
//             firstName:
//               amadeusTravelers[0]?.name?.firstName || "UNKNOWN_FIRSTNAME",
//             lastName: amadeusTravelers[0]?.name?.lastName || "UNKNOWN_LASTNAME",
//           },
//         },
//       },
//     };
//     const response: any = await axios.post(
//       `${baseURL}/v1/booking/flight-orders`,
//       payload,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );
//     const amadeusBooking: any = response.data;
//     const marginSetting: any = await prisma.marginSetting.findFirst({
//       orderBy: { createdAt: "desc" },
//     });
//     if (!marginSetting) {
//       return res.status(500).json({ error: "Margin setting not configured" });
//     }
//     const marginPercentage = marginSetting.amount;
//     const flightOffers = amadeusBooking?.data?.flightOffers || [];
//     if (flightOffers.length === 0) {
//       return res
//         .status(500)
//         .json({ error: "No flight offers found in Amadeus response" });
//     }
//     const basePriceNGN = parseFloat(flightOffers[0].price?.grandTotal || "0");
//     const marginAdded = (marginPercentage / 100) * basePriceNGN;
//     const originalTotalAmount = basePriceNGN + marginAdded;
//     const conversionRate = await getConversionRate("USD", "NGN");
//     let addons: any[] = [];
//     let addonTotalNGN = 0;
//     if (addonIds.length > 0) {
//       addons = await prisma.flightAddon.findMany({
//         where: { id: { in: addonIds } },
//       });
//       if (addons.length !== addonIds.length) {
//         return res.status(400).json({
//           success: false,
//           message: "One or more addonIds are invalid",
//         });
//       }
//       addonTotalNGN = addons.reduce((sum, addon) => {
//         const priceInUsd = addon.price;
//         const priceInNgn = priceInUsd * conversionRate;
//         return sum + priceInNgn;
//       }, 0);
//     }
//     const totalAmountNGN = originalTotalAmount + addonTotalNGN;
//     const bookingData: any = {
//       userId,
//       referenceId: amadeusBooking.data.id,
//       type: "FLIGHT",
//       status: "CONFIRMED",
//       verified: true,
//       apiProvider: "AMADEUS",
//       apiReferenceId: amadeusBooking.data.id,
//       apiResponse: amadeusBooking,
//       bookingDetails: flightOffer,
//       totalAmount: +totalAmountNGN.toFixed(2),
//       currency: "NGN",
//       locationDetails: {},
//       airlineDetails: {},
//     };
//     const booking = await prisma.booking.create({ data: bookingData });
//     if (addonIds.length > 0) {
//       await prisma.flightAddon.updateMany({
//         where: { id: { in: addonIds } },
//         data: { bookingId: booking.id },
//       });
//     }
//     for (const t of travelers) {
//       await prisma.traveler.create({
//         data: {
//           bookingId: booking.id,
//           userId,
//           firstName: t.name.firstName || t.firstName,
//           lastName: t.name.lastName || t.lastName,
//           dateOfBirth: new Date(t.dateOfBirth),
//           gender: t.gender,
//           email: t.contact.emailAddress,
//           phone: t.contact.phones?.[0]?.number,
//           countryCode: t.contact.phones?.[0]?.countryCallingCode,
//           passportNumber: t.documents?.[0]?.number,
//           passportExpiry: t.documents?.[0]?.expiryDate
//             ? new Date(t.documents[0].expiryDate)
//             : undefined,
//           nationality: t.documents?.[0]?.nationality,
//         },
//       });
//       // Send booking confirmation email to each traveler
//       if (t.contact.emailAddress) {
//         await sendBookingConfirmationEmail({
//           toEmail: t.contact.emailAddress,
//           toName: `${t.name.firstName || t.firstName} ${
//             t.name.lastName || t.lastName
//           }`,
//           bookingId: booking.id,
//           flightOffer,
//         });
//       }
//     }
//     const bookingWithAddons = await prisma.booking.findUnique({
//       where: { id: booking.id },
//       include: { FlightAddon: true },
//     });
//     return res.status(201).json({
//       success: true,
//       message:
//         "Flight successfully booked with addons and confirmation emails sent",
//       booking: bookingWithAddons,
//       amadeus: amadeusBooking,
//       originalTotalAmount: +originalTotalAmount.toFixed(2),
//       addonTotal: +addonTotalNGN.toFixed(2),
//       totalAmount: +totalAmountNGN.toFixed(2),
//     });
//   } catch (error: any) {
//     console.error("Booking Error:", error.response?.data || error.message);
//     return res.status(500).json({
//       success: false,
//       message: "Flight booking failed",
//       error: error.response?.data || error.message,
//     });
//   }
// }
function bookFlightWithOptionalAddons(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6;
        const { flightOffer, travelers, addonIds = [], userId } = req.body;
        console.log("=== BOOKING FUNCTION STARTED ===");
        console.log("Request body keys:", Object.keys(req.body));
        console.log("Full request body:", JSON.stringify(req.body, null, 2));
        try {
            console.log("Received booking request with:", {
                flightOfferExists: !!flightOffer,
                travelersCount: (travelers === null || travelers === void 0 ? void 0 : travelers.length) || 0,
                addonIds,
                userId,
                travelers,
                flightOffer,
            });
            // Validation checks with detailed logging
            console.log("=== VALIDATION PHASE ===");
            if (!flightOffer || !travelers) {
                console.error("Validation failed: Missing flightOffer or travelers");
                console.error("flightOffer exists:", !!flightOffer);
                console.error("travelers exists:", !!travelers);
                return (0, apiResponse_1.sendError)(res, "Missing required fields: flightOffer or travelers", 400);
            }
            console.log("✓ flightOffer and travelers validation passed");
            if (!userId) {
                console.error("Validation failed: userId is missing");
                return (0, apiResponse_1.sendError)(res, "userId is required for this booking endpoint.", 400);
            }
            console.log("✓ userId validation passed:", userId);
            // Database user check
            console.log("=== USER VERIFICATION ===");
            console.log("Checking if user exists with ID:", userId);
            const userExists = yield prisma_1.prisma.user.findUnique({ where: { id: userId } });
            console.log("User query result:", userExists ? "User found" : "User not found");
            if (!userExists) {
                console.error("User verification failed: User not found for ID:", userId);
                return (0, apiResponse_1.sendError)(res, "Invalid userId: user not found", 400);
            }
            console.log("✓ User verification passed");
            // Traveler mapping
            console.log("=== TRAVELER MAPPING ===");
            console.log("Original travelers data:", JSON.stringify(travelers, null, 2));
            const amadeusTravelers = travelers.map((t, idx) => {
                console.log(`Mapping traveler ${idx + 1}:`, JSON.stringify(t, null, 2));
                const mapped = t.name && t.contact && t.documents
                    ? Object.assign(Object.assign({}, t), { id: (idx + 1).toString() }) : (0, amadeusHelper_1.mapTravelerToAmadeusFormat)(t, (idx + 1).toString());
                console.log(`Mapped traveler ${idx + 1}:`, JSON.stringify(mapped, null, 2));
                return mapped;
            });
            console.log("All amadeusTravelers:", JSON.stringify(amadeusTravelers, null, 2));
            // First traveler validation
            console.log("=== FIRST TRAVELER VALIDATION ===");
            console.log("First traveler name object:", (_a = amadeusTravelers[0]) === null || _a === void 0 ? void 0 : _a.name);
            console.log("First traveler firstName:", (_c = (_b = amadeusTravelers[0]) === null || _b === void 0 ? void 0 : _b.name) === null || _c === void 0 ? void 0 : _c.firstName);
            if (!((_e = (_d = amadeusTravelers[0]) === null || _d === void 0 ? void 0 : _d.name) === null || _e === void 0 ? void 0 : _e.firstName)) {
                console.error("First traveler validation failed: Missing firstName");
                console.error("First traveler data:", JSON.stringify(amadeusTravelers[0], null, 2));
                return (0, apiResponse_1.sendError)(res, "Missing firstName in traveler data", 400);
            }
            console.log("✓ First traveler validation passed");
            // Amadeus token acquisition
            console.log("=== AMADEUS TOKEN ACQUISITION ===");
            console.log("Requesting Amadeus token...");
            const token = yield (0, getToken_1.default)();
            console.log("Amadeus token acquired:", token ? "Success" : "Failed");
            console.log("Token length:", (token === null || token === void 0 ? void 0 : token.length) || 0);
            // Clean flight offer - remove enriched fields added by backend
            console.log("=== CLEANING FLIGHT OFFER ===");
            const cleanFlightOffer = JSON.parse(JSON.stringify(flightOffer));
            // Remove backend-added fields from price
            if (cleanFlightOffer.price) {
                delete cleanFlightOffer.price.originalTotal;
                delete cleanFlightOffer.price.originalGrandTotal;
                delete cleanFlightOffer.price.marginAdded;
                delete cleanFlightOffer.price.billingCurrency;
                // Convert string prices to numbers if needed
                if (typeof cleanFlightOffer.price.total === 'string') {
                    cleanFlightOffer.price.total = parseFloat(cleanFlightOffer.price.total);
                }
                if (typeof cleanFlightOffer.price.grandTotal === 'string') {
                    cleanFlightOffer.price.grandTotal = parseFloat(cleanFlightOffer.price.grandTotal);
                }
                if (typeof cleanFlightOffer.price.base === 'string') {
                    cleanFlightOffer.price.base = parseFloat(cleanFlightOffer.price.base);
                }
            }
            // Remove details from segments
            if (cleanFlightOffer.itineraries) {
                for (const itinerary of cleanFlightOffer.itineraries) {
                    if (itinerary.segments) {
                        for (const segment of itinerary.segments) {
                            if ((_f = segment.departure) === null || _f === void 0 ? void 0 : _f.details) {
                                delete segment.departure.details;
                            }
                            if ((_g = segment.arrival) === null || _g === void 0 ? void 0 : _g.details) {
                                delete segment.arrival.details;
                            }
                        }
                    }
                }
            }
            console.log("Cleaned flight offer:", JSON.stringify(cleanFlightOffer, null, 2));
            // Payload construction
            console.log("=== PAYLOAD CONSTRUCTION ===");
            const payload = {
                data: {
                    type: "flight-order",
                    flightOffers: [cleanFlightOffer], // Use cleaned offer
                    travelers: amadeusTravelers,
                    holder: {
                        name: {
                            firstName: ((_j = (_h = amadeusTravelers[0]) === null || _h === void 0 ? void 0 : _h.name) === null || _j === void 0 ? void 0 : _j.firstName) || "UNKNOWN_FIRSTNAME",
                            lastName: ((_l = (_k = amadeusTravelers[0]) === null || _k === void 0 ? void 0 : _k.name) === null || _l === void 0 ? void 0 : _l.lastName) || "UNKNOWN_LASTNAME",
                        },
                    },
                },
            };
            console.log("Final Amadeus API payload:", JSON.stringify(payload, null, 2));
            console.log("Payload size (bytes):", JSON.stringify(payload).length);
            // Amadeus API call
            console.log("=== AMADEUS API CALL ===");
            console.log("Making request to:", `${baseURL}/v1/booking/flight-orders`);
            console.log("Request headers:", {
                Authorization: `Bearer ${token.substring(0, 10)}...`,
                "Content-Type": "application/json",
            });
            const response = yield axios_1.default.post(`${baseURL}/v1/booking/flight-orders`, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            console.log("Amadeus API response status:", response.status);
            console.log("Amadeus API response headers:", response.headers);
            console.log("Amadeus API response data:", JSON.stringify(response.data, null, 2));
            const amadeusBooking = response.data;
            console.log("✓ Amadeus booking created successfully");
            // Margin setting retrieval
            console.log("=== MARGIN SETTING RETRIEVAL ===");
            console.log("Fetching latest margin setting...");
            const marginSetting = yield prisma_1.prisma.marginSetting.findFirst({
                orderBy: { createdAt: "desc" },
            });
            console.log("Margin setting query result:", marginSetting ? "Found" : "Not found");
            console.log("Margin setting data:", JSON.stringify(marginSetting, null, 2));
            if (!marginSetting) {
                console.error("Margin setting not found in database");
                return (0, apiResponse_1.sendError)(res, "Margin setting not configured", 500);
            }
            const marginPercentage = marginSetting.amount;
            console.log("✓ Margin percentage:", marginPercentage);
            // Flight offers processing
            console.log("=== FLIGHT OFFERS PROCESSING ===");
            const flightOffers = ((_m = amadeusBooking === null || amadeusBooking === void 0 ? void 0 : amadeusBooking.data) === null || _m === void 0 ? void 0 : _m.flightOffers) || [];
            console.log("Flight offers count:", flightOffers.length);
            console.log("Flight offers data:", JSON.stringify(flightOffers, null, 2));
            if (flightOffers.length === 0) {
                console.error("No flight offers found in Amadeus response");
                console.error("Amadeus booking data structure:", Object.keys((amadeusBooking === null || amadeusBooking === void 0 ? void 0 : amadeusBooking.data) || {}));
                return (0, apiResponse_1.sendError)(res, "No flight offers found in Amadeus response", 500);
            }
            const basePriceNGN = parseFloat(((_o = flightOffers[0].price) === null || _o === void 0 ? void 0 : _o.grandTotal) || "0");
            console.log("Base price (NGN):", basePriceNGN);
            console.log("Flight offer price object:", flightOffers[0].price);
            // Price calculations
            console.log("=== PRICE CALCULATIONS ===");
            const marginAdded = (marginPercentage / 100) * basePriceNGN;
            const originalTotalAmount = basePriceNGN + marginAdded;
            console.log("Margin added:", marginAdded);
            console.log("Original total amount:", originalTotalAmount);
            // Currency conversion
            console.log("=== CURRENCY CONVERSION ===");
            console.log("Getting USD to NGN conversion rate...");
            const conversionRate = yield (0, amadeusHelper_1.getConversionRate)("USD", "NGN");
            console.log("Conversion rate (USD to NGN):", conversionRate);
            // Addon processing
            console.log("=== ADDON PROCESSING ===");
            console.log("Addon IDs to process:", addonIds);
            console.log("Addon IDs count:", addonIds.length);
            let addons = [];
            let addonTotalNGN = 0;
            if (addonIds.length > 0) {
                console.log("Fetching addons from database...");
                addons = yield prisma_1.prisma.flightAddon.findMany({
                    where: { id: { in: addonIds } },
                });
                console.log("Addons found in database:", addons.length);
                console.log("Addons data:", JSON.stringify(addons, null, 2));
                if (addons.length !== addonIds.length) {
                    console.error("Addon validation failed:");
                    console.error("Requested addon IDs:", addonIds);
                    console.error("Found addon IDs:", addons.map((a) => a.id));
                    return (0, apiResponse_1.sendError)(res, "One or more addonIds are invalid", 400);
                }
                console.log("Processing addon prices...");
                addonTotalNGN = addons.reduce((sum, addon) => {
                    const priceInUsd = addon.price;
                    const priceInNgn = priceInUsd * conversionRate;
                    console.log(`Addon ${addon.id}: $${priceInUsd} = ₦${priceInNgn}`);
                    return sum + priceInNgn;
                }, 0);
                console.log("Total addon amount (NGN):", addonTotalNGN);
            }
            else {
                console.log("No addons to process");
            }
            // Final total calculation
            console.log("=== FINAL TOTAL CALCULATION ===");
            const totalAmountNGN = originalTotalAmount + addonTotalNGN;
            console.log("Final breakdown:");
            console.log("- Base price + margin:", originalTotalAmount);
            console.log("- Addon total:", addonTotalNGN);
            console.log("- Grand total:", totalAmountNGN);
            // Database booking creation
            console.log("=== DATABASE BOOKING CREATION ===");
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
            console.log("Booking data to insert:", JSON.stringify(bookingData, null, 2));
            console.log("Creating booking in database...");
            const booking = yield prisma_1.prisma.booking.create({ data: bookingData });
            console.log("✓ Booking created with ID:", booking.id);
            console.log("Created booking data:", JSON.stringify(booking, null, 2));
            // Addon association
            console.log("=== ADDON ASSOCIATION ===");
            if (addonIds.length > 0) {
                console.log("Associating addons with booking...");
                const addonUpdateResult = yield prisma_1.prisma.flightAddon.updateMany({
                    where: { id: { in: addonIds } },
                    data: { bookingId: booking.id },
                });
                console.log("Addon update result:", addonUpdateResult);
                console.log("✓ Addons associated with booking");
            }
            else {
                console.log("No addons to associate");
            }
            // Traveler creation
            console.log("=== TRAVELER CREATION ===");
            for (let i = 0; i < travelers.length; i++) {
                const t = travelers[i];
                console.log(`Processing traveler ${i + 1}/${travelers.length}:`, JSON.stringify(t, null, 2));
                const travelerData = {
                    bookingId: booking.id,
                    userId,
                    firstName: ((_p = t.name) === null || _p === void 0 ? void 0 : _p.firstName) || t.firstName,
                    lastName: ((_q = t.name) === null || _q === void 0 ? void 0 : _q.lastName) || t.lastName,
                    dateOfBirth: new Date(t.dateOfBirth),
                    gender: t.gender,
                    email: (_r = t.contact) === null || _r === void 0 ? void 0 : _r.emailAddress,
                    phone: (_u = (_t = (_s = t.contact) === null || _s === void 0 ? void 0 : _s.phones) === null || _t === void 0 ? void 0 : _t[0]) === null || _u === void 0 ? void 0 : _u.number,
                    countryCode: (_x = (_w = (_v = t.contact) === null || _v === void 0 ? void 0 : _v.phones) === null || _w === void 0 ? void 0 : _w[0]) === null || _x === void 0 ? void 0 : _x.countryCallingCode,
                    passportNumber: (_z = (_y = t.documents) === null || _y === void 0 ? void 0 : _y[0]) === null || _z === void 0 ? void 0 : _z.number,
                    passportExpiry: ((_1 = (_0 = t.documents) === null || _0 === void 0 ? void 0 : _0[0]) === null || _1 === void 0 ? void 0 : _1.expiryDate)
                        ? new Date(t.documents[0].expiryDate)
                        : undefined,
                    nationality: (_3 = (_2 = t.documents) === null || _2 === void 0 ? void 0 : _2[0]) === null || _3 === void 0 ? void 0 : _3.nationality,
                };
                console.log(`Traveler ${i + 1} data to insert:`, JSON.stringify(travelerData, null, 2));
                const createdTraveler = yield prisma_1.prisma.traveler.create({
                    data: travelerData,
                });
                console.log(`✓ Traveler ${i + 1} created with ID:`, createdTraveler.id);
                // Email sending
                console.log(`=== EMAIL SENDING FOR TRAVELER ${i + 1} ===`);
                if ((_4 = t.contact) === null || _4 === void 0 ? void 0 : _4.emailAddress) {
                    const emailData = {
                        toEmail: t.contact.emailAddress,
                        toName: `${((_5 = t.name) === null || _5 === void 0 ? void 0 : _5.firstName) || t.firstName} ${((_6 = t.name) === null || _6 === void 0 ? void 0 : _6.lastName) || t.lastName}`,
                        bookingId: booking.id,
                        flightOffer,
                    };
                    console.log(`Sending confirmation email to:`, emailData.toEmail);
                    console.log(`Email data:`, JSON.stringify(emailData, null, 2));
                    try {
                        yield (0, zeptomail_1.sendBookingConfirmationEmails)(emailData);
                        console.log(`✓ Confirmation email sent to traveler ${i + 1}`);
                    }
                    catch (emailError) {
                        console.error(`Email sending failed for traveler ${i + 1}:`, emailError);
                        // Don't fail the entire booking for email issues
                    }
                }
                else {
                    console.warn(`No email address for traveler ${i + 1}, skipping email`);
                }
            }
            // Final booking retrieval
            console.log("=== FINAL BOOKING RETRIEVAL ===");
            console.log("Fetching complete booking with addons...");
            const bookingWithAddons = yield prisma_1.prisma.booking.findUnique({
                where: { id: booking.id },
                include: { FlightAddon: true },
            });
            console.log("Final booking with addons:", JSON.stringify(bookingWithAddons, null, 2));
            // Clear cart after successful booking
            if (userId) {
                yield prisma_1.prisma.flightCart.deleteMany({ where: { userId } });
            }
            console.log("=== SUCCESS RESPONSE ===");
            const finalData = {
                booking: bookingWithAddons,
                amadeus: amadeusBooking,
                originalTotalAmount: +originalTotalAmount.toFixed(2),
                addonTotal: +addonTotalNGN.toFixed(2),
                totalAmount: +totalAmountNGN.toFixed(2),
                referenceId: booking.id,
            };
            console.log("Success response data:", JSON.stringify(finalData, null, 2));
            console.log("=== BOOKING FUNCTION COMPLETED SUCCESSFULLY ===");
            return (0, apiResponse_1.sendSuccess)(res, "Flight successfully booked with addons and confirmation emails sent", finalData, 201);
        }
        catch (error) {
            console.error("=== BOOKING ERROR OCCURRED ===");
            console.error("Error type:", typeof error);
            console.error("Error name:", error.name);
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
            if (error.response) {
                console.error("HTTP Error Response:");
                console.error("- Status:", error.response.status);
                console.error("- Status Text:", error.response.statusText);
                console.error("- Headers:", error.response.headers);
                console.error("- Data:", JSON.stringify(error.response.data, null, 2));
            }
            if (error.request) {
                console.error("HTTP Request Error:");
                console.error("- Request config:", error.config);
                console.error("- Request data:", error.request);
            }
            console.error("=== END ERROR DETAILS ===");
            return (0, apiResponse_1.sendError)(res, "Flight booking failed", 500, error);
        }
    });
}
