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
exports.searchHotels = void 0;
exports.hotelAutocomplete = hotelAutocomplete;
exports.hotelOfferSearch = hotelOfferSearch;
exports.searchHotelsWithOffers = searchHotelsWithOffers;
exports.getOfferPricing = getOfferPricing;
exports.getHotelRating = getHotelRating;
exports.bookHotel = bookHotel;
const getToken_1 = __importDefault(require("../utils/getToken"));
const axios_1 = __importDefault(require("axios"));
const prisma_1 = require("../lib/prisma");
const zeptomail_1 = require("../utils/zeptomail");
const apiResponse_1 = require("../utils/apiResponse");
const helper_1 = require("../utils/helper");
const baseURL = "https://test.api.amadeus.com";
// Autocomplete Hotel
function hotelAutocomplete(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        try {
            const { keyword, subType } = req.query;
            if (!keyword || typeof keyword !== "string") {
                return (0, apiResponse_1.sendError)(res, "keyword query parameter is required", 400);
            }
            if (keyword.length < 3) {
                return (0, apiResponse_1.sendError)(res, "keyword must be at least 3 characters long", 400);
            }
            const token = yield (0, getToken_1.default)();
            // Build query parameters
            const params = {
                keyword: keyword.trim(),
            };
            // Add subType if provided and valid
            if (subType && typeof subType === "string") {
                // Amadeus supports: HOTEL_LEISURE, HOTEL_GDS
                const validSubTypes = ["HOTEL_LEISURE", "HOTEL_GDS"];
                if (validSubTypes.includes(subType.toUpperCase())) {
                    params.subType = subType.toUpperCase();
                }
            }
            // Call Amadeus Hotel List API by keyword (city or hotel name)
            const response = yield axios_1.default.get(`${baseURL}/v1/reference-data/locations/hotel`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                params: {
                    keyword,
                    subType: "HOTEL_GDS",
                },
                timeout: 10000, // 10 second timeout for autocomplete
            });
            // Check if response has data
            const hotels = ((_a = response.data) === null || _a === void 0 ? void 0 : _a.data) || [];
            if (hotels.length === 0) {
                return (0, apiResponse_1.sendSuccess)(res, "No hotels found for the given keyword", []);
            }
            // Extract relevant hotel info for autocomplete
            // const suggestions = hotels.map((hotel: any) => ({
            //   id: hotel.id,
            //   iataCode: hotel.iataCode,
            //   hotelId: hotel?.hotelIds[0],
            //   name: hotel.name,
            //   cityCode: hotel.address?.cityCode,
            //   cityName: hotel.address?.cityName,
            //   countryCode: hotel.address?.countryCode,
            //   countryName: hotel.address?.countryName,
            //   // Include coordinates if available for mapping
            //   ...(hotel.geoCode && {
            //     latitude: hotel.geoCode.latitude,
            //     longitude: hotel.geoCode.longitude,
            //   }),
            //   // Include distance if search was location-based
            // }));
            return (0, apiResponse_1.sendSuccess)(res, "Hotels fetched successfully", hotels);
        }
        catch (error) {
            console.error("Error fetching hotel autocomplete:", ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Failed to fetch hotel autocomplete suggestions", ((_c = error.response) === null || _c === void 0 ? void 0 : _c.status) || 500, error);
        }
    });
}
// Hotel List / Search
const searchHotels = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { cityCode } = req.query;
        if (!cityCode) {
            return (0, apiResponse_1.sendError)(res, "Missing required query parameters: CityCode is required.", 400);
        }
        const token = yield (0, getToken_1.default)();
        console.log("Token:", token); // Log the token for debugging
        const hotelResponse = yield axios_1.default.get(`${baseURL}/v1/reference-data/locations/hotels/by-city`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            params: {
                cityCode,
            },
        });
        console.log("Keyword:", cityCode); // Log the keyword for debugging
        return (0, apiResponse_1.sendSuccess)(res, "Hotels fetched successfully", hotelResponse.data);
    }
    catch (error) {
        console.error("Error fetching hotels:", error);
        return (0, apiResponse_1.sendError)(res, "Error occurred while searching for hotels", 500, error);
    }
});
exports.searchHotels = searchHotels;
// Hotel Offers Search
function hotelOfferSearch(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        try {
            const { hotelIds, checkInDate, checkOutDate, adults, children, rooms, currency, roomQuantity, } = req.query;
            // Validate required parameters
            if (!hotelIds) {
                return (0, apiResponse_1.sendError)(res, "Missing required parameter: hotelIds", 400);
            }
            if (!checkInDate || !checkOutDate) {
                return (0, apiResponse_1.sendError)(res, "Missing required parameters: checkInDate and checkOutDate are required", 400);
            }
            // Validate date format (YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(checkInDate) ||
                !dateRegex.test(checkOutDate)) {
                return (0, apiResponse_1.sendError)(res, "Invalid date format. Use YYYY-MM-DD format", 400);
            }
            // Validate that check-in is before check-out
            if (new Date(checkInDate) >= new Date(checkOutDate)) {
                return (0, apiResponse_1.sendError)(res, "checkInDate must be before checkOutDate", 400);
            }
            const token = yield (0, getToken_1.default)();
            // Build query parameters
            const params = {
                hotelIds,
                checkInDate,
                checkOutDate,
                adults: adults || 1, // Default to 1 adult
            };
            // Add optional parameters if provided
            if (children)
                params.children = children;
            if (rooms)
                params.rooms = rooms;
            if (currency)
                params.currency = currency;
            if (roomQuantity)
                params.roomQuantity = roomQuantity;
            console.log("Hotel offer search params:", params);
            const response = yield axios_1.default.get(`${baseURL}/v3/shopping/hotel-offers`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                params,
                timeout: 30000, // 30 second timeout
            });
            // Extract and format the response data
            const offers = ((_a = response.data) === null || _a === void 0 ? void 0 : _a.data) || [];
            // Transform the data for easier frontend consumption
            const formattedOffers = offers.map((hotel) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
                return ({
                    hotelId: (_a = hotel.hotel) === null || _a === void 0 ? void 0 : _a.hotelId,
                    hotelName: (_b = hotel.hotel) === null || _b === void 0 ? void 0 : _b.name,
                    hotelRating: (_c = hotel.hotel) === null || _c === void 0 ? void 0 : _c.rating,
                    address: {
                        cityCode: (_d = hotel.hotel) === null || _d === void 0 ? void 0 : _d.cityCode,
                        cityName: (_f = (_e = hotel.hotel) === null || _e === void 0 ? void 0 : _e.address) === null || _f === void 0 ? void 0 : _f.cityName,
                        countryCode: (_h = (_g = hotel.hotel) === null || _g === void 0 ? void 0 : _g.address) === null || _h === void 0 ? void 0 : _h.countryCode,
                        lines: (_k = (_j = hotel.hotel) === null || _j === void 0 ? void 0 : _j.address) === null || _k === void 0 ? void 0 : _k.lines,
                        postalCode: (_m = (_l = hotel.hotel) === null || _l === void 0 ? void 0 : _l.address) === null || _m === void 0 ? void 0 : _m.postalCode,
                    },
                    contact: (_o = hotel.hotel) === null || _o === void 0 ? void 0 : _o.contact,
                    amenities: (_p = hotel.hotel) === null || _p === void 0 ? void 0 : _p.amenities,
                    offers: ((_q = hotel.offers) === null || _q === void 0 ? void 0 : _q.map((offer) => {
                        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                        return ({
                            id: offer.id,
                            checkInDate: offer.checkInDate,
                            checkOutDate: offer.checkOutDate,
                            roomQuantity: offer.roomQuantity,
                            rateCode: offer.rateCode,
                            rateFamilyEstimated: offer.rateFamilyEstimated,
                            room: {
                                type: (_a = offer.room) === null || _a === void 0 ? void 0 : _a.type,
                                typeEstimated: (_b = offer.room) === null || _b === void 0 ? void 0 : _b.typeEstimated,
                                description: (_d = (_c = offer.room) === null || _c === void 0 ? void 0 : _c.description) === null || _d === void 0 ? void 0 : _d.text,
                            },
                            guests: offer.guests,
                            price: {
                                currency: (_e = offer.price) === null || _e === void 0 ? void 0 : _e.currency,
                                base: (_f = offer.price) === null || _f === void 0 ? void 0 : _f.base,
                                total: (_g = offer.price) === null || _g === void 0 ? void 0 : _g.total,
                                variations: (_h = offer.price) === null || _h === void 0 ? void 0 : _h.variations,
                            },
                            policies: {
                                paymentType: (_j = offer.policies) === null || _j === void 0 ? void 0 : _j.paymentType,
                                cancellation: (_k = offer.policies) === null || _k === void 0 ? void 0 : _k.cancellation,
                            },
                            self: offer.self, // Important: This contains the offer URL for booking
                        });
                    })) || [],
                });
            });
            return (0, apiResponse_1.sendSuccess)(res, "Hotel offers retrieved successfully", formattedOffers);
        }
        catch (error) {
            console.error("Error fetching hotel offers:", ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
            if (((_c = error.response) === null || _c === void 0 ? void 0 : _c.status) === 400) {
                const errorDetails = (_f = (_e = (_d = error.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.errors) === null || _f === void 0 ? void 0 : _f[0];
                // Handle specific "No rooms available" error
                if ((errorDetails === null || errorDetails === void 0 ? void 0 : errorDetails.code) === 3664 ||
                    ((_g = errorDetails === null || errorDetails === void 0 ? void 0 : errorDetails.title) === null || _g === void 0 ? void 0 : _g.includes("NO ROOMS AVAILABLE"))) {
                    return (0, apiResponse_1.sendSuccess)(res, "No rooms available for the selected dates", []);
                }
                // Handle "ROOM OR RATE NOT FOUND" error (code 11226)
                if ((errorDetails === null || errorDetails === void 0 ? void 0 : errorDetails.code) === 11226 ||
                    (errorDetails === null || errorDetails === void 0 ? void 0 : errorDetails.title) === "ROOM OR RATE NOT FOUND") {
                    return (0, apiResponse_1.sendError)(res, "Room or rate not found for the specified hotel and dates.", 404);
                }
                // Default 400 error handler
                return (0, apiResponse_1.sendError)(res, "Failed to fetch hotel offers", 500, error);
            }
            return (0, apiResponse_1.sendError)(res, "An unexpected error occurred", 500, error);
        }
    });
}
// export async function searchHotelsAndOffers(
//   req: Request,
//   res: Response
// ): Promise<any> {
//   try {
//     // Extract query parameters
//     const {
//       cityCode,
//       checkInDate,
//       checkOutDate,
//       adults,
//       children,
//       rooms,
//       currency,
//       roomQuantity,
//     } = req.query;
//     console.log("Received combined search request with params:", req.query);
//     // Validate cityCode
//     if (!cityCode || typeof cityCode !== "string") {
//       console.warn("Missing or invalid cityCode parameter");
//       return res.status(400).json({
//         error: "Missing or invalid required parameter: cityCode",
//       });
//     }
//     // Validate checkInDate and checkOutDate presence and format
//     if (!checkInDate || !checkOutDate) {
//       console.warn("Missing checkInDate or checkOutDate parameter");
//       return res.status(400).json({
//         error: "Missing required parameters: checkInDate and checkOutDate are required",
//       });
//     }
//     const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
//     if (!dateRegex.test(checkInDate as string) || !dateRegex.test(checkOutDate as string)) {
//       console.warn("Invalid date format for checkInDate or checkOutDate");
//       return res.status(400).json({
//         error: "Invalid date format. Use YYYY-MM-DD format",
//       });
//     }
//     if (new Date(checkInDate as string) >= new Date(checkOutDate as string)) {
//       console.warn("checkInDate must be before checkOutDate");
//       return res.status(400).json({
//         error: "checkInDate must be before checkOutDate",
//       });
//     }
//     // Get Amadeus API token
//     console.log("Fetching Amadeus API token...");
//     const token = await getAmadeusToken();
//     console.log("Amadeus token acquired");
//     // Step 1: Fetch hotels by cityCode
//     console.log(`Fetching hotels for cityCode: ${cityCode}`);
//     const hotelResponse:any = await axios.get(
//       `${baseURL}/v1/reference-data/locations/hotels/by-city`,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//         params: { cityCode },
//       }
//     );
//     // After fetching hotels by cityCode
// const hotels = hotelResponse.data?.data || [];
// console.log(`Found ${hotels.length} hotels for cityCode ${cityCode}`);
// if (hotels.length === 0) {
//   console.info("No hotels found for the specified cityCode");
//   return res.status(200).json({
//     message: "No hotels found for the given cityCode",
//     data: [],
//   });
// }
// // Limit the number of hotels to 30 to reduce load
// const limitedHotels = hotels.slice(0, 30);
// console.log(`Limiting to ${limitedHotels.length} hotels for offer search`);
// // Extract hotelIds from limited hotels only
// const hotelIdsArray = limitedHotels
//   .map((hotel: any) => hotel.hotelId)
//   .filter((id: string | undefined) => !!id);
// if (hotelIdsArray.length === 0) {
//   console.info("No hotelIds found in the limited hotels data");
//   return res.status(200).json({
//     message: "No hotelIds found for hotels in the specified city",
//     data: [],
//   });
// }
// console.log(`Extracted ${hotelIdsArray.length} hotelIds from limited hotels`);
//     // Step 2: Fetch hotel offers for these hotelIds
//     const params: any = {
//       hotelIds: hotelIdsArray.join(','), // Comma-separated hotelIds string
//       checkInDate,
//       checkOutDate,
//       adults: adults || 1,
//     };
//     // Add optional parameters if provided
//     if (children) params.children = children;
//     if (rooms) params.rooms = rooms;
//     if (currency) params.currency = currency;
//     if (roomQuantity) params.roomQuantity = roomQuantity;
//     console.log("Fetching hotel offers with params:", params);
//     const offersResponse:any = await axios.get(
//       `${baseURL}/v3/shopping/hotel-offers`,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//         params,
//         timeout: 30000,
//       }
//     );
//     const offers = offersResponse.data?.data || [];
//     console.log(`Received ${offers.length} hotel offers`);
//     // Format offers for frontend consumption
//     const formattedOffers = offers.map((hotel: any) => ({
//       hotelId: hotel.hotel?.hotelId,
//       hotelName: hotel.hotel?.name,
//       hotelRating: hotel.hotel?.rating,
//       address: {
//         cityCode: hotel.hotel?.cityCode,
//         cityName: hotel.hotel?.address?.cityName,
//         countryCode: hotel.hotel?.address?.countryCode,
//         lines: hotel.hotel?.address?.lines,
//         postalCode: hotel.hotel?.address?.postalCode,
//       },
//       contact: hotel.hotel?.contact,
//       amenities: hotel.hotel?.amenities,
//       offers:
//         hotel.offers?.map((offer: any) => ({
//           id: offer.id,
//           checkInDate: offer.checkInDate,
//           checkOutDate: offer.checkOutDate,
//           roomQuantity: offer.roomQuantity,
//           rateCode: offer.rateCode,
//           rateFamilyEstimated: offer.rateFamilyEstimated,
//           room: {
//             type: offer.room?.type,
//             typeEstimated: offer.room?.typeEstimated,
//             description: offer.room?.description?.text,
//           },
//           guests: offer.guests,
//           price: {
//             currency: offer.price?.currency,
//             base: offer.price?.base,
//             total: offer.price?.total,
//             variations: offer.price?.variations,
//           },
//           policies: {
//             paymentType: offer.policies?.paymentType,
//             cancellation: offer.policies?.cancellation,
//           },
//           self: offer.self,
//         })) || [],
//     }));
//     console.log("Sending response with hotels and offers data");
//     return res.status(200).json({
//       message: "Hotels and offers retrieved successfully",
//       hotelsCount: hotels.length,
//       offersCount: formattedOffers.length,
//       hotels,
//       offers: formattedOffers,
//       searchParams: {
//         cityCode,
//         checkInDate,
//         checkOutDate,
//         adults: adults || 1,
//         ...(children && { children }),
//         ...(rooms && { rooms }),
//         ...(currency && { currency }),
//       },
//     });
//   } catch (error: any) {
//     console.error("Error fetching hotels and offers:", error.response?.data || error.message);
//     if (error.response?.status === 400) {
//       const errorDetails = error.response?.data?.errors?.[0];
//       if (
//         errorDetails?.code === 3664 ||
//         errorDetails?.title?.includes("NO ROOMS AVAILABLE")
//       ) {
//         console.warn("No rooms available for the requested property and dates");
//         return res.status(200).json({
//           message: "Search completed successfully",
//           data: [],
//           availability: {
//             status: "NO_ROOMS_AVAILABLE",
//             hotelId:
//               errorDetails?.source?.parameter?.split("=")?.[1] || "unknown",
//             reason:
//               "No rooms available at the requested property for the selected dates",
//             suggestions: [
//               "Try different dates",
//               "Check nearby hotels",
//               "Modify guest count",
//               "Contact hotel directly for availability",
//             ],
//           },
//         });
//       }
//       console.error("Failed to fetch hotel offers due to bad request");
//       return res.status(500).json({
//         error: "Failed to fetch hotel offers",
//         ...(process.env.NODE_ENV === "development" && {
//           details: error.message,
//         }),
//       });
//     }
//     return res.status(500).json({
//       error: "An error occurred while fetching hotels and offers",
//       ...(process.env.NODE_ENV === "development" && {
//         details: error.message,
//       }),
//     });
//   }
// }
/// Get Hotel Offer Details by ID
function searchHotelsWithOffers(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        try {
            console.log("Received searchHotelsWithOffers request with query:", req.query);
            const { cityCode, checkInDate, checkOutDate, adults, children, rooms, currency, roomQuantity, } = req.query;
            // Validate cityCode
            if (!cityCode || typeof cityCode !== "string") {
                return (0, apiResponse_1.sendError)(res, "Missing or invalid cityCode", 400);
            }
            // Validate checkInDate and checkOutDate presence and format
            if (!checkInDate || !checkOutDate) {
                return (0, apiResponse_1.sendError)(res, "Missing checkInDate or checkOutDate", 400);
            }
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(checkInDate) ||
                !dateRegex.test(checkOutDate)) {
                return (0, apiResponse_1.sendError)(res, "Dates must be in YYYY-MM-DD format", 400);
            }
            if (new Date(checkInDate) >= new Date(checkOutDate)) {
                return (0, apiResponse_1.sendError)(res, "checkInDate must be before checkOutDate", 400);
            }
            console.log("Validation passed for input parameters");
            // Get Amadeus API token
            console.log("Requesting Amadeus API token...");
            const token = yield (0, getToken_1.default)();
            console.log("Amadeus API token acquired");
            // Step 1: Fetch hotels by cityCode
            console.log(`Fetching hotels for cityCode: ${cityCode}`);
            const hotelResponse = yield axios_1.default.get(`${baseURL}/v1/reference-data/locations/hotels/by-city`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { cityCode },
            });
            const hotels = ((_a = hotelResponse.data) === null || _a === void 0 ? void 0 : _a.data) || [];
            console.log(`Fetched ${hotels.length} hotels for cityCode ${cityCode}`);
            if (hotels.length === 0) {
                return (0, apiResponse_1.sendSuccess)(res, "No hotels found", []);
            }
            // Limit hotels to 50 to control load
            const limitedHotels = hotels.slice(0, 50);
            console.log(`Limiting to ${limitedHotels.length} hotels for offer search`);
            // Extract hotelIds
            const hotelIds = limitedHotels
                .map((hotel) => hotel.hotelId)
                .filter((id) => !!id);
            if (hotelIds.length === 0) {
                return (0, apiResponse_1.sendSuccess)(res, "No hotelIds found", []);
            }
            console.log(`Extracted ${hotelIds.length} hotelIds`);
            // Step 2: Fetch offers for hotelIds
            const offerParams = {
                hotelIds: hotelIds.join(","),
                checkInDate,
                checkOutDate,
                adults: adults || 1,
            };
            if (children)
                offerParams.children = children;
            if (rooms)
                offerParams.rooms = rooms;
            if (currency)
                offerParams.currency = currency;
            if (roomQuantity)
                offerParams.roomQuantity = roomQuantity;
            console.log("Fetching hotel offers with parameters:", offerParams);
            const offersResponse = yield axios_1.default.get(`${baseURL}/v3/shopping/hotel-offers`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                params: offerParams,
                timeout: 30000,
            });
            const offersData = ((_b = offersResponse.data) === null || _b === void 0 ? void 0 : _b.data) || [];
            console.log(`Received ${offersData.length} hotels with offers`);
            if (offersData.length === 0) {
                return (0, apiResponse_1.sendSuccess)(res, "No hotel offers available for the selected dates", []);
            }
            // Format hotels with offers for response
            const formattedHotelsWithOffers = offersData.map((hotel) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
                return ({
                    hotelId: (_a = hotel.hotel) === null || _a === void 0 ? void 0 : _a.hotelId,
                    hotelName: (_b = hotel.hotel) === null || _b === void 0 ? void 0 : _b.name,
                    hotelRating: (_c = hotel.hotel) === null || _c === void 0 ? void 0 : _c.rating,
                    address: {
                        cityCode: (_d = hotel.hotel) === null || _d === void 0 ? void 0 : _d.cityCode,
                        cityName: (_f = (_e = hotel.hotel) === null || _e === void 0 ? void 0 : _e.address) === null || _f === void 0 ? void 0 : _f.cityName,
                        countryCode: (_h = (_g = hotel.hotel) === null || _g === void 0 ? void 0 : _g.address) === null || _h === void 0 ? void 0 : _h.countryCode,
                        lines: (_k = (_j = hotel.hotel) === null || _j === void 0 ? void 0 : _j.address) === null || _k === void 0 ? void 0 : _k.lines,
                        postalCode: (_m = (_l = hotel.hotel) === null || _l === void 0 ? void 0 : _l.address) === null || _m === void 0 ? void 0 : _m.postalCode,
                    },
                    contact: (_o = hotel.hotel) === null || _o === void 0 ? void 0 : _o.contact,
                    amenities: (_p = hotel.hotel) === null || _p === void 0 ? void 0 : _p.amenities,
                    offers: ((_q = hotel.offers) === null || _q === void 0 ? void 0 : _q.map((offer) => {
                        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                        return ({
                            id: offer.id,
                            checkInDate: offer.checkInDate,
                            checkOutDate: offer.checkOutDate,
                            roomQuantity: offer.roomQuantity,
                            rateCode: offer.rateCode,
                            rateFamilyEstimated: offer.rateFamilyEstimated,
                            room: {
                                type: (_a = offer.room) === null || _a === void 0 ? void 0 : _a.type,
                                typeEstimated: (_b = offer.room) === null || _b === void 0 ? void 0 : _b.typeEstimated,
                                description: (_d = (_c = offer.room) === null || _c === void 0 ? void 0 : _c.description) === null || _d === void 0 ? void 0 : _d.text,
                            },
                            guests: offer.guests,
                            price: {
                                currency: (_e = offer.price) === null || _e === void 0 ? void 0 : _e.currency,
                                base: (_f = offer.price) === null || _f === void 0 ? void 0 : _f.base,
                                total: (_g = offer.price) === null || _g === void 0 ? void 0 : _g.total,
                                variations: (_h = offer.price) === null || _h === void 0 ? void 0 : _h.variations,
                            },
                            policies: {
                                paymentType: (_j = offer.policies) === null || _j === void 0 ? void 0 : _j.paymentType,
                                cancellation: (_k = offer.policies) === null || _k === void 0 ? void 0 : _k.cancellation,
                            },
                            self: offer.self,
                        });
                    })) || [],
                });
            });
            return (0, apiResponse_1.sendSuccess)(res, "Hotels with offers retrieved successfully", formattedHotelsWithOffers);
        }
        catch (error) {
            console.error("Error in searchHotelsWithOffers:", ((_c = error.response) === null || _c === void 0 ? void 0 : _c.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Failed to fetch hotels with offers", 500, error);
        }
    });
}
function getOfferPricing(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { offerId } = req.params;
            if (!offerId) {
                return (0, apiResponse_1.sendError)(res, "Missing required parameter: offerId", 400);
            }
            const token = yield (0, getToken_1.default)();
            const response = yield axios_1.default.get(`${baseURL}/v3/shopping/hotel-offers/${offerId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            return (0, apiResponse_1.sendSuccess)(res, "Success", response.data);
        }
        catch (error) {
            console.error(`Error fetching hotel offer:`, error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
/// Get Hotel Rating
function getHotelRating(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { hotelIds } = req.query;
            if (!hotelIds) {
                return (0, apiResponse_1.sendError)(res, "Missing required parameter: hotelIds", 400);
            }
            const token = yield (0, getToken_1.default)();
            const response = yield axios_1.default.get(`${baseURL}/v2/e-reputation/hotel-sentiments`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                params: {
                    hotelIds: hotelIds, // Ensure this is a string of comma-separated IDs
                },
            });
            return (0, apiResponse_1.sendSuccess)(res, "Success", response.data);
        }
        catch (error) {
            console.error(`Error fetching hotel ratings:`, error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
// /// Booking Hotel
// export async function bookHotel(req: Request, res: Response): Promise<any> {
//   try {
//     const { data } = req.body;
//     if (!data) {
//       return res
//         .status(400)
//         .json({ error: "Missing 'data' object in request body" });
//     }
//     const { guests, roomAssociations, payment, travelAgent } = data;
//     // Basic validation
//     if (!guests || !Array.isArray(guests) || guests.length === 0) {
//       return res.status(400).json({ error: "At least one guest is required" });
//     }
//     if (
//       !roomAssociations ||
//       !Array.isArray(roomAssociations) ||
//       roomAssociations.length === 0
//     ) {
//       return res
//         .status(400)
//         .json({ error: "roomAssociations with hotelOfferId is required" });
//     }
//     if (!payment) {
//       return res.status(400).json({ error: "Payment information is required" });
//     }
//     // Validate presence of tid in each guest and guestReferences in roomAssociations
//     for (const guest of guests) {
//       if (typeof guest.tid === "undefined") {
//         return res
//           .status(400)
//           .json({ error: "Each guest must have a 'tid' field" });
//       }
//     }
//     for (const room of roomAssociations) {
//       if (
//         !room.guestReferences ||
//         !Array.isArray(room.guestReferences) ||
//         room.guestReferences.length === 0
//       ) {
//         return res.status(400).json({
//           error:
//             "Each roomAssociation must have a non-empty 'guestReferences' array",
//         });
//       }
//       for (const ref of room.guestReferences) {
//         if (typeof ref.guestReference === "undefined") {
//           return res.status(400).json({
//             error:
//               "Each guestReference in roomAssociations must have a 'guestReference' field",
//           });
//         }
//       }
//     }
//     // Ensure the 'type' field is set to "hotel-order"
//     if (data.type !== "hotel-order") {
//       data.type = "hotel-order";
//     }
//     // Build the booking payload exactly as required by Amadeus API
//     const bookingPayload = { data };
//     // Get Amadeus OAuth token
//     const token = await getAmadeusToken();
//     // Log payload for debugging (remove in production)
//     console.log("Booking payload:", JSON.stringify(bookingPayload, null, 2));
//     // Call Amadeus Hotel Booking API
//     const response: any = await axios.post(
//       `${baseURL}/v2/booking/hotel-orders`,
//       bookingPayload,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//           Accept: "application/json",
//         },
//         timeout: 30000,
//       }
//     );
//     const amadeusResponse = response.data?.data;
//     // Generate your own unique reference for internal tracking
//     const referenceId = uuid();
//     // Extract booking details for your DB storage
//     const bookingDetails = {
//       guests,
//       roomAssociations,
//       hotelOfferId: roomAssociations[0]?.hotelOfferId,
//       checkInDate: amadeusResponse?.hotelBookings?.[0]?.hotelOffer?.checkInDate,
//       checkOutDate:
//         amadeusResponse?.hotelBookings?.[0]?.hotelOffer?.checkOutDate,
//       hotelName: amadeusResponse?.hotelBookings?.[0]?.hotel?.name,
//       address: amadeusResponse?.hotelBookings?.[0]?.hotel?.address,
//       confirmationNumber:
//         amadeusResponse?.hotelBookings?.[0]?.hotelProviderInformation?.[0]
//           ?.confirmationNumber,
//     };
//     // Save booking record in your database
//     const booking = await prisma.booking.create({
//       data: {
//         referenceId,
//         type: "HOTEL",
//         status: "CONFIRMED",
//         apiProvider: "AMADEUS",
//         apiReferenceId: amadeusResponse?.id,
//         apiResponse: amadeusResponse,
//         bookingDetails,
//         totalAmount: amadeusResponse?.hotelBookings?.[0]?.hotelOffer?.price
//           ?.total
//           ? parseFloat(amadeusResponse.hotelBookings[0].hotelOffer.price.total)
//           : undefined,
//         currency:
//           amadeusResponse?.hotelBookings?.[0]?.hotelOffer?.price?.currency ||
//           "EUR",
//       },
//     });
//     return res.status(200).json({
//       message: "Hotel successfully booked",
//       bookingId: amadeusResponse?.id,
//       confirmationNumber: bookingDetails.confirmationNumber,
//       data: amadeusResponse,
//       bookingRecord: booking,
//     });
//   } catch (error: any) {
//     console.error(
//       "Error booking hotel:",
//       error.response?.data || error.message
//     );
//     if (error.response) {
//       return res.status(error.response.status).json({
//         error: error.response.data || error.message,
//       });
//     }
//     return res.status(500).json({
//       error: "Internal server error",
//     });
//   }
// }
// /// Booking Hotel
// Helper function to extract Amadeus reference ID
function bookHotel(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        try {
            const { data } = req.body;
            // @ts-ignore
            const currentUserId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || null; // Assuming you have user in req from auth middleware
            if (!data) {
                return (0, apiResponse_1.sendError)(res, "Missing booking data", 400);
            }
            // Validate required fields
            if (!data.guests || data.guests.length === 0) {
                return (0, apiResponse_1.sendError)(res, "At least one guest is required", 400);
            }
            // Get Amadeus access token
            const token = yield (0, getToken_1.default)();
            // Make booking request to Amadeus
            const amadeusResponse = yield axios_1.default.post(`${process.env.AMADEUS_BASE_URL || `${baseURL}`}/v2/booking/hotel-orders`, { data }, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            // Extract guest information
            const primaryGuest = data.guests[0];
            const guestEmail = primaryGuest.email;
            let userId = null;
            let guestUserId = null;
            // If we have a current user and their email matches, use their ID
            if (currentUserId) {
                const currentUser = yield prisma_1.prisma.user.findUnique({
                    where: { id: currentUserId },
                });
                if (currentUser && currentUser.email === guestEmail) {
                    userId = currentUserId;
                }
            }
            // If no user match, try to find existing user by email
            if (!userId) {
                const existingUser = yield prisma_1.prisma.user.findUnique({
                    where: { email: guestEmail },
                });
                if (existingUser) {
                    userId = existingUser.id;
                }
                else {
                    // Create or update guest user
                    const guestUser = yield prisma_1.prisma.guestUser.upsert({
                        where: { email: guestEmail },
                        update: {
                            firstName: primaryGuest.firstName,
                            lastName: primaryGuest.lastName,
                            phone: primaryGuest.phone || null,
                        },
                        create: {
                            email: guestEmail,
                            firstName: primaryGuest.firstName,
                            lastName: primaryGuest.lastName,
                            phone: primaryGuest.phone || null,
                        },
                    });
                    guestUserId = guestUser.id;
                }
            }
            // Create booking in database
            const booking = yield prisma_1.prisma.booking.create({
                data: {
                    userId: userId,
                    guestUserId: guestUserId,
                    referenceId: (0, helper_1.generateBookingReference)(),
                    type: "HOTEL",
                    status: "CONFIRMED", // Assuming successful Amadeus booking means confirmed
                    apiResponse: amadeusResponse.data,
                    bookingDetails: {
                        hotelOfferId: ((_c = (_b = data.roomAssociations) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.hotelOfferId) || null,
                        guests: data.guests,
                        roomAssociations: data.roomAssociations || [],
                        travelAgent: data.travelAgent || null,
                        checkIn: data.checkIn || null,
                        checkOut: data.checkOut || null,
                    },
                    totalAmount: (0, helper_1.extractTotalAmount)(amadeusResponse),
                    currency: (0, helper_1.extractCurrency)(amadeusResponse),
                    apiProvider: "AMADEUS",
                    apiReferenceId: (0, helper_1.extractAmadeusReference)(amadeusResponse),
                    verified: true, // Assuming Amadeus booking is verified
                },
            });
            // Create traveler records for each guest
            const travelerPromises = data.guests.map((guest, index) => {
                return prisma_1.prisma.traveler.create({
                    data: {
                        bookingId: booking.id,
                        userId: userId,
                        guestUserId: guestUserId,
                        firstName: guest.firstName,
                        lastName: guest.lastName,
                        email: guest.email,
                        phone: guest.phone || "",
                        countryCode: guest.countryCode || "",
                        gender: guest.title === "MR"
                            ? "MALE"
                            : guest.title === "MRS" || guest.title === "MS"
                                ? "FEMALE"
                                : "OTHER",
                        dateOfBirth: guest.dateOfBirth
                            ? new Date(guest.dateOfBirth)
                            : new Date("1990-01-01"), // Default if not provided
                        // Add other fields as available in your guest data
                    },
                });
            });
            yield Promise.all(travelerPromises);
            // Fetch the complete booking with relations
            const completeBooking = yield prisma_1.prisma.booking.findUnique({
                where: { id: booking.id },
                include: {
                    user: true,
                    guestUser: true,
                    travelers: true,
                },
            });
            // Send confirmation email
            if (completeBooking) {
                const emailRecipient = completeBooking.user || completeBooking.guestUser;
                if (emailRecipient && emailRecipient.email) {
                    yield (0, zeptomail_1.sendHotelBookingConfirmationEmail)({
                        hotelName: data.hotelName,
                        checkInDate: data.checkInDate,
                        checkOutDate: data.checkOutDate,
                        guests: data.guests,
                        totalAmount: booking.totalAmount,
                        currency: booking.currency,
                        bookingId: booking.referenceId,
                    }, {
                        email: emailRecipient.email,
                        name: emailRecipient.name ||
                            `${emailRecipient.firstName || ''} ${emailRecipient.lastName || ''}`.trim() ||
                            "Guest",
                    });
                }
            }
            // Return success response
            return (0, apiResponse_1.sendSuccess)(res, "Hotel booking completed successfully", {
                booking: {
                    id: completeBooking === null || completeBooking === void 0 ? void 0 : completeBooking.id,
                    referenceId: completeBooking === null || completeBooking === void 0 ? void 0 : completeBooking.referenceId,
                    status: completeBooking === null || completeBooking === void 0 ? void 0 : completeBooking.status,
                    totalAmount: completeBooking === null || completeBooking === void 0 ? void 0 : completeBooking.totalAmount,
                    currency: completeBooking === null || completeBooking === void 0 ? void 0 : completeBooking.currency,
                    apiReferenceId: completeBooking === null || completeBooking === void 0 ? void 0 : completeBooking.apiReferenceId,
                    createdAt: completeBooking === null || completeBooking === void 0 ? void 0 : completeBooking.createdAt,
                    travelers: completeBooking === null || completeBooking === void 0 ? void 0 : completeBooking.travelers,
                },
                amadeusResponse: amadeusResponse.data,
            }, 201);
        }
        catch (error) {
            console.error("Error booking hotel:", ((_d = error.response) === null || _d === void 0 ? void 0 : _d.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Hotel booking failed", ((_e = error.response) === null || _e === void 0 ? void 0 : _e.status) || 500, error);
        }
    });
}
