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
exports.bookFlightWithOptionalAddons = bookFlightWithOptionalAddons;
exports.bookFlightAsGuest = bookFlightAsGuest;
exports.updateBookingStatus = updateBookingStatus;
const axios_1 = __importDefault(require("axios"));
const getToken_1 = __importDefault(require("../utils/getToken"));
const client_1 = require("@prisma/client");
const amadeusHelper_1 = require("../utils/amadeusHelper");
const helper_1 = require("../utils/helper");
const baseURL = "https://test.api.amadeus.com";
const prisma = new client_1.PrismaClient();
function searchFlights(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { origin, destination, adults, departureDate, keyword } = req.query;
        try {
            const token = yield (0, getToken_1.default)();
            console.log(token);
            // If keyword is provided, return location suggestions
            if (keyword && typeof keyword === "string" && keyword.trim().length > 0) {
                const { data } = yield axios_1.default.get(`${baseURL}/v1/reference-data/locations`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    params: {
                        subType: "CITY,AIRPORT",
                        keyword,
                    },
                });
                const suggestions = data.data.map((item) => ({
                    name: item.name,
                    iataCode: item.iataCode,
                    cityCode: item.cityCode,
                    countryName: item.countryName,
                    stateCode: item.stateCode,
                    regionCode: item.regionCode,
                }));
                return res.json(suggestions);
            }
            // For flight search, validate required fields
            if (!origin || !destination || !adults || !departureDate) {
                return res.status(400).json({
                    error: "Missing required field(s): origin, destination, adults, departureDate",
                });
            }
            const adultsNum = Number(adults);
            if (isNaN(adultsNum) || adultsNum < 1) {
                return res.status(400).json({ error: "Invalid 'adults' parameter" });
            }
            // Get IATA codes for origin and destination
            const originIata = yield (0, helper_1.getCachedIataCode)(origin, token);
            const destinationIata = yield (0, helper_1.getCachedIataCode)(destination, token);
            if (!originIata || !destinationIata) {
                return res
                    .status(400)
                    .json({ error: "Could not find IATA code for origin or destination" });
            }
            // Get excluded airlines from your database
            const excludedAirlines = yield prisma.excludedAirline.findMany();
            const excludedCodesArray = excludedAirlines
                .map((a) => { var _a; return (_a = a.airlineCode) === null || _a === void 0 ? void 0 : _a.trim(); })
                .filter((code) => code && /^[A-Z0-9]+$/.test(code));
            const params = {
                originLocationCode: originIata,
                destinationLocationCode: destinationIata,
                adults: adultsNum,
                departureDate,
                currencyCode: "NGN",
                max: 7,
            };
            if (excludedCodesArray.length > 0) {
                params.excludedAirlineCodes = excludedCodesArray.join(",");
            }
            const response = yield axios_1.default.get(`${baseURL}/v2/shopping/flight-offers`, {
                headers: { Authorization: `Bearer ${token}` },
                params,
            });
            const offers = response.data.data;
            // Apply margin from your settings
            const marginSetting = yield prisma.marginSetting.findFirst();
            const percent = (marginSetting === null || marginSetting === void 0 ? void 0 : marginSetting.amount) || 0;
            const adjustedOffers = offers.map((offer) => {
                const originalPrice = parseFloat(offer.price.total);
                const priceWithMargin = originalPrice * (1 + percent / 100);
                return Object.assign(Object.assign({}, offer), { price: Object.assign(Object.assign({}, offer.price), { total: parseFloat(priceWithMargin.toFixed(2)) }) });
            });
            // Enrich segments with location details
            for (const offer of adjustedOffers) {
                for (const itinerary of offer.itineraries) {
                    for (const segment of itinerary.segments) {
                        const originDetails = yield (0, helper_1.getCachedLocationDetails)(segment.departure.iataCode, token);
                        const destinationDetails = yield (0, helper_1.getCachedLocationDetails)(segment.arrival.iataCode, token);
                        segment.departure.details = originDetails;
                        segment.arrival.details = destinationDetails;
                    }
                }
            }
            return res.status(200).json({ data: adjustedOffers });
        }
        catch (error) {
            console.error("Error occurred:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            return res.status(500).json({ error: "Failed to fetch flight offers" });
        }
    });
}
function searchFlightPrice(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const { flightOffer } = req.body;
            if (!flightOffer) {
                return res
                    .status(400)
                    .json({ error: "Missing flight offer in request body" });
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
            const marginSetting = yield prisma.marginSetting.findFirst({
                orderBy: { createdAt: "desc" },
            });
            if (!marginSetting) {
                return res.status(500).json({ error: "Margin setting not configured" });
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
            return res.status(200).json(Object.assign(Object.assign({}, response.data), { data: Object.assign(Object.assign({}, response.data.data), { flightOffers: modifiedFlightOffers }) }));
        }
        catch (error) {
            console.error("Flight pricing error:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            return res.status(500).json({
                error: "Failed to fetch flight pricing",
                details: ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message,
            });
        }
    });
}
const saveSelectedFlightOffer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { offerData } = req.body;
        if (!offerData) {
            return res.status(400).json({ message: "Missing offer data" });
        }
        const savedOffer = yield prisma.flightOffer.create({
            data: {
                offerData,
            },
        });
        return res.status(201).json({
            message: "Flight offer saved successfully",
            flightOfferId: savedOffer.id,
        });
    }
    catch (error) {
        console.error("Error saving flight offer:", error);
        return res
            .status(500)
            .json({ message: "Server error", error: error.message });
    }
});
exports.saveSelectedFlightOffer = saveSelectedFlightOffer;
const getFlightOffers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const flightOffers = yield prisma.flightOffer.findMany({
            orderBy: { createdAt: "desc" },
        });
        return res.status(200).json({
            message: "Flight offers retrieved successfully",
            data: flightOffers,
        });
    }
    catch (error) {
        console.error("Error fetching flight offers:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message,
        });
    }
});
exports.getFlightOffers = getFlightOffers;
const getFlightOfferById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: "Flight offer ID is required" });
        }
        const flightOffer = yield prisma.flightOffer.findUnique({
            where: { id },
            include: {
                travelers: true,
                addons: true,
            },
        });
        if (!flightOffer) {
            return res.status(404).json({ message: "Flight offer not found" });
        }
        return res.status(200).json({
            message: "Flight offer retrieved successfully",
            data: flightOffer,
        });
    }
    catch (error) {
        console.error("Error fetching flight offer:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message,
        });
    }
});
exports.getFlightOfferById = getFlightOfferById;
function retrieveFlightDetails(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const rawReferenceId = req.params.referenceId;
            if (!rawReferenceId) {
                return res.status(400).json({ error: "Reference parameter is required" });
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
            return res.status(200).json(response.data);
        }
        catch (error) {
            console.error("Error retrieving flight details:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            return res.status(500).json({ error: "Internal server error" });
        }
    });
}
function deleteFlightBooking(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const rawReferenceId = req.params.referenceId;
            if (!rawReferenceId) {
                return res.status(400).json({ error: "Reference ID is required" });
            }
            const decodedReferenceId = decodeURIComponent(rawReferenceId);
            const encodedReferenceId = encodeURIComponent(decodedReferenceId);
            const booking = yield prisma.booking.findUnique({
                where: { referenceId: encodedReferenceId },
            });
            if (!booking) {
                return res
                    .status(404)
                    .json({ error: "Booking not found in local database" });
            }
            const token = yield (0, getToken_1.default)();
            yield axios_1.default.delete(`${baseURL}/v1/booking/flight-orders/${encodedReferenceId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            yield prisma.booking.delete({
                where: { referenceId: encodedReferenceId },
            });
            return res.status(200).json({
                message: "Booking successfully cancelled and deleted",
            });
        }
        catch (error) {
            console.error("Error deleting booking:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            if (((_b = error.response) === null || _b === void 0 ? void 0 : _b.status) === 404) {
                return res
                    .status(404)
                    .json({ error: "Booking not found in Amadeus or already deleted" });
            }
            return res.status(500).json({ error: "Internal server error" });
        }
    });
}
function getSeatMapsByFlightId(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { referenceId } = req.params;
            if (!referenceId) {
                return res.status(400).json({ error: "Flight order ID is required" });
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
            return res.status(200).json(response.data);
        }
        catch (error) {
            console.error("Error occurred while fetching seat maps:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            return res.status(500).json({
                error: "Internal server error",
            });
        }
    });
}
function getOneFlightDetails(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { flightId } = req.params;
            if (!flightId) {
                return res.status(400).json({ error: "Reference parameter is required" });
            }
            const response = yield prisma.booking.findUnique({
                where: { id: flightId },
            });
            if (!response) {
                return res.status(404).json({
                    message: "This Flight cannot be found",
                });
            }
            return res.status(200).json(response);
        }
        catch (error) {
            console.error("Error retrieving flight details:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            return res.status(500).json({ error: "Internal server error" });
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
                return res.status(400).json({ error: "Reference parameter is required" });
            }
            const flightInfo = yield prisma.booking.update({
                where: { id: flightId },
                data: {
                    status: status,
                },
            });
            return res.status(201).json(flightInfo);
        }
        catch (error) {
            console.error("Error retrieving flight details:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            return res.status(500).json({ error: "Internal server error" });
        }
    });
}
// export async function bookFlightWithOptionalAddons(
//   req: Request,
//   res: Response
// ): Promise<any> {
//   const {
//     flightOffer,
//     travelers,
//     addonIds = [],
//     userId,
//     guestUserId,
//   } = req.body;
//   try {
//     if (!flightOffer || !travelers) {
//       return res.status(400).json({
//         error: "Missing required fields: flightOffer or travelers",
//       });
//     }
//     const token = await getAmadeusToken();
//     // Prepare Amadeus booking payload
//     const payload = {
//       data: {
//         type: "flight-order",
//         flightOffers: [flightOffer],
//         travelers: travelers.map((t: any) => ({
//           id: t.id,
//           dateOfBirth: t.dateOfBirth,
//           name: {
//             firstName: t.name.firstName,
//             lastName: t.name.lastName,
//           },
//           gender: t.gender,
//           contact: {
//             emailAddress: t.contact.emailAddress,
//             phones: t.contact.phones,
//           },
//           documents: t.documents.map((doc: any) => ({
//             number: doc.passportNumber || doc.number,
//             documentType: doc.documentType || "PASSPORT",
//             issuanceCountry: doc.issuanceCountry,
//             issuanceLocation: doc.issuanceLocation,
//             issuanceDate: doc.issuanceDate,
//             holder: true,
//             expiryDate: doc.expiryDate,
//             validityCountry: doc.validityCountry,
//             nationality: doc.nationality,
//             birthPlace: doc.birthPlace,
//           })),
//         })),
//         holder: {
//           name: {
//             firstName: travelers[0].name.firstName,
//             lastName: travelers[0].name.lastName,
//           },
//         },
//       },
//     };
//     // Book flight on Amadeus
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
//     // Margin
//     const marginSetting: any = await prisma.marginSetting.findFirst({
//       orderBy: { createdAt: "desc" },
//     });
//     console.log(`Margin settings:`, marginSetting);
//     if (!marginSetting) {
//       return res.status(500).json({ error: "Margin setting not configured" });
//     }
//     const marginPercentage = marginSetting?.amount;
//     // Extract base price from the first flight offer (assuming at least one)
//     const flightOffers = amadeusBooking?.data?.flightOffers || [];
//     if (flightOffers.length === 0) {
//       return res
//         .status(500)
//         .json({ error: "No flight offers found in Amadeus response" });
//     }
//     const basePriceNGN = parseFloat(flightOffers[0].price?.grandTotal || "0");
//     // Apply margin to base price (if needed)
//     const marginAdded = (marginPercentage / 100) * basePriceNGN;
//     const originalTotalAmount = basePriceNGN + marginAdded;
//     // Get conversion rate for addons (USD -> NGN)
//     const conversionRate = await getConversionRate("USD", "NGN");
//     // Fetch addons and convert prices from USD to NGN
//     let addons: any[] = [];
//     let addonTotalNGN = 0;
//     if (addonIds.length > 0) {
//       addons = await prisma.flightAddon.findMany({
//         where: { id: { in: addonIds } },
//       });
//       addonTotalNGN = addons.reduce((sum, addon) => {
//         const priceInUsd = addon.price;
//         const priceInNgn = priceInUsd * conversionRate;
//         return sum + priceInNgn;
//       }, 0);
//     }
//     // Calculate grand total (base + margin + addons)
//     const totalAmountNGN = originalTotalAmount + addonTotalNGN;
//     // Save booking with converted addon prices
//     const booking = await prisma.booking.create({
//       data: {
//         userId,
//         guestUserId,
//         referenceId: amadeusBooking.data.id,
//         type: "FLIGHT",
//         status: "CONFIRMED",
//         verified: true,
//         apiProvider: "AMADEUS",
//         apiReferenceId: amadeusBooking.data.id,
//         apiResponse: amadeusBooking,
//         bookingDetails: flightOffer,
//         totalAmount: +totalAmountNGN.toFixed(2),
//         currency: "NGN",
//         locationDetails: {},
//         airlineDetails: {},
//         FlightAddon: {
//           create: addons.map((addon) => ({
//             type: addon.type,
//             name: addon.name,
//             description: addon.description,
//             price: +(addon.price * conversionRate).toFixed(2),
//             currency: "NGN",
//           })),
//         },
//       },
//       include: { FlightAddon: true },
//     });
//     // Save travelers
//     for (const t of travelers) {
//       await prisma.traveler.create({
//         data: {
//           bookingId: booking.id,
//           firstName: t.name.firstName,
//           lastName: t.name.lastName,
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
//     }
//     // Debug logs
//     console.log("Base price (NGN):", basePriceNGN);
//     console.log("Margin added (NGN):", marginAdded);
//     console.log("Addon total (NGN):", addonTotalNGN);
//     console.log("Total amount (NGN):", totalAmountNGN);
//     return res.status(201).json({
//       success: true,
//       message: "Flight successfully booked with addons",
//       booking,
//       amadeus: amadeusBooking,
//       originalTotalAmount: +originalTotalAmount.toFixed(2), // base + margin
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        const { flightOffer, travelers, addonIds = [], userId, } = req.body;
        try {
            console.log("Received booking request with:", {
                flightOfferExists: !!flightOffer,
                travelersCount: (travelers === null || travelers === void 0 ? void 0 : travelers.length) || 0,
                addonIds,
                userId,
                travelers,
                flightOffer,
            });
            if (!flightOffer || !travelers) {
                return res.status(400).json({
                    error: "Missing required fields: flightOffer or travelers",
                });
            }
            // Validate userId
            if (!userId) {
                return res.status(400).json({ error: "userId is required for this booking endpoint." });
            }
            const userExists = yield prisma.user.findUnique({ where: { id: userId } });
            if (!userExists) {
                return res.status(400).json({ error: "Invalid userId: user not found" });
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
            const marginSetting = yield prisma.marginSetting.findFirst({
                orderBy: { createdAt: "desc" },
            });
            if (!marginSetting) {
                return res.status(500).json({ error: "Margin setting not configured" });
            }
            const marginPercentage = marginSetting.amount;
            // Extract base price from Amadeus response
            const flightOffers = ((_a = amadeusBooking === null || amadeusBooking === void 0 ? void 0 : amadeusBooking.data) === null || _a === void 0 ? void 0 : _a.flightOffers) || [];
            if (flightOffers.length === 0) {
                return res.status(500).json({ error: "No flight offers found in Amadeus response" });
            }
            const basePriceNGN = parseFloat(((_b = flightOffers[0].price) === null || _b === void 0 ? void 0 : _b.grandTotal) || "0");
            // Calculate margin and total
            const marginAdded = (marginPercentage / 100) * basePriceNGN;
            const originalTotalAmount = basePriceNGN + marginAdded;
            // Get conversion rate USD -> NGN for addons
            const conversionRate = yield (0, amadeusHelper_1.getConversionRate)("USD", "NGN");
            // Fetch addons and calculate total addon price in NGN
            let addons = [];
            let addonTotalNGN = 0;
            if (addonIds.length > 0) {
                addons = yield prisma.flightAddon.findMany({
                    where: { id: { in: addonIds } },
                });
                if (addons.length !== addonIds.length) {
                    return res.status(400).json({
                        success: false,
                        message: "One or more addonIds are invalid",
                    });
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
            const booking = yield prisma.booking.create({ data: bookingData });
            // Step 2: Link existing addons to booking by updating bookingId
            if (addonIds.length > 0) {
                yield prisma.flightAddon.updateMany({
                    where: { id: { in: addonIds } },
                    data: { bookingId: booking.id },
                });
            }
            // Step 3: Save travelers linked to booking
            for (const t of travelers) {
                yield prisma.traveler.create({
                    data: {
                        bookingId: booking.id,
                        userId, // link traveler to registered user
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
            const bookingWithAddons = yield prisma.booking.findUnique({
                where: { id: booking.id },
                include: { FlightAddon: true },
            });
            return res.status(201).json({
                success: true,
                message: "Flight successfully booked with addons",
                booking: bookingWithAddons,
                amadeus: amadeusBooking,
                originalTotalAmount: +originalTotalAmount.toFixed(2),
                addonTotal: +addonTotalNGN.toFixed(2),
                totalAmount: +totalAmountNGN.toFixed(2),
            });
        }
        catch (error) {
            console.error("Booking Error:", ((_o = error.response) === null || _o === void 0 ? void 0 : _o.data) || error.message);
            return res.status(500).json({
                success: false,
                message: "Flight booking failed",
                error: ((_p = error.response) === null || _p === void 0 ? void 0 : _p.data) || error.message,
            });
        }
    });
}
function bookFlightAsGuest(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        const { flightOffer, travelers, addonIds = [], guestUserId, } = req.body;
        try {
            console.log("Received booking request with:", {
                flightOfferExists: !!flightOffer,
                travelersCount: (travelers === null || travelers === void 0 ? void 0 : travelers.length) || 0,
                addonIds,
                travelers,
                flightOffer,
                guestUserId
            });
            if (!flightOffer || !travelers) {
                return res.status(400).json({
                    error: "Missing required fields: flightOffer or travelers",
                });
            }
            // Validate guestUserId
            if (!guestUserId) {
                return res.status(400).json({ error: "guestUserId is required for guest booking." });
            }
            const guestExists = yield prisma.guestUser.findUnique({ where: { id: guestUserId } });
            if (!guestExists) {
                return res.status(400).json({ error: "Invalid guestUserId: guest user not found" });
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
            const marginSetting = yield prisma.marginSetting.findFirst({
                orderBy: { createdAt: "desc" },
            });
            if (!marginSetting) {
                return res.status(500).json({ error: "Margin setting not configured" });
            }
            const marginPercentage = marginSetting.amount;
            // Extract base price from Amadeus response
            const flightOffers = ((_a = amadeusBooking === null || amadeusBooking === void 0 ? void 0 : amadeusBooking.data) === null || _a === void 0 ? void 0 : _a.flightOffers) || [];
            if (flightOffers.length === 0) {
                return res.status(500).json({ error: "No flight offers found in Amadeus response" });
            }
            const basePriceNGN = parseFloat(((_b = flightOffers[0].price) === null || _b === void 0 ? void 0 : _b.grandTotal) || "0");
            // Calculate margin and total
            const marginAdded = (marginPercentage / 100) * basePriceNGN;
            const originalTotalAmount = basePriceNGN + marginAdded;
            // Get conversion rate USD -> NGN for addons
            const conversionRate = yield (0, amadeusHelper_1.getConversionRate)("USD", "NGN");
            // Fetch addons and calculate total addon price in NGN
            let addons = [];
            let addonTotalNGN = 0;
            if (addonIds.length > 0) {
                addons = yield prisma.flightAddon.findMany({
                    where: { id: { in: addonIds } },
                });
                if (addons.length !== addonIds.length) {
                    return res.status(400).json({
                        success: false,
                        message: "One or more addonIds are invalid",
                    });
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
            const booking = yield prisma.booking.create({ data: bookingData });
            // Step 2: Link existing addons to booking by updating bookingId
            if (addonIds.length > 0) {
                yield prisma.flightAddon.updateMany({
                    where: { id: { in: addonIds } },
                    data: { bookingId: booking.id },
                });
            }
            // Step 3: Save travelers linked to booking
            for (const t of travelers) {
                yield prisma.traveler.create({
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
            const bookingWithAddons = yield prisma.booking.findUnique({
                where: { id: booking.id },
                include: { FlightAddon: true },
            });
            return res.status(201).json({
                success: true,
                message: "Flight successfully booked with addons",
                booking: bookingWithAddons,
                amadeus: amadeusBooking,
                originalTotalAmount: +originalTotalAmount.toFixed(2),
                addonTotal: +addonTotalNGN.toFixed(2),
                totalAmount: +totalAmountNGN.toFixed(2),
            });
        }
        catch (error) {
            console.error("Booking Error:", ((_o = error.response) === null || _o === void 0 ? void 0 : _o.data) || error.message);
            return res.status(500).json({
                success: false,
                message: "Flight booking failed",
                error: ((_p = error.response) === null || _p === void 0 ? void 0 : _p.data) || error.message,
            });
        }
    });
}
// PATCH /booking/:referenceId/status
function updateBookingStatus(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { referenceId } = req.params;
        const { status, verified } = req.body;
        if (!referenceId) {
            return res.status(400).json({ error: "referenceId is required" });
        }
        if (!status && typeof verified === "undefined") {
            return res.status(400).json({ error: "At least one of status or verified must be provided" });
        }
        try {
            const booking = yield prisma.booking.findUnique({ where: { referenceId } });
            if (!booking) {
                return res.status(404).json({ error: "Booking not found" });
            }
            const updatedBooking = yield prisma.booking.update({
                where: { referenceId },
                data: Object.assign(Object.assign({}, (status && { status })), (typeof verified === "boolean" && { verified })),
            });
            return res.status(200).json({
                success: true,
                message: "Booking status updated successfully",
                booking: updatedBooking,
            });
        }
        catch (error) {
            console.error("Error updating booking status:", error.message);
            return res.status(500).json({
                success: false,
                message: "Failed to update booking status",
                error: error.message,
            });
        }
    });
}
