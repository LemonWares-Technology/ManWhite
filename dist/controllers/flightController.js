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
exports.searchFlights = void 0;
const axios_1 = __importDefault(require("axios"));
const getToken_1 = __importDefault(require("../utils/getToken"));
const client_1 = require("@prisma/client");
const baseURL = "https://test.api.amadeus.com";
const prisma = new client_1.PrismaClient();
// Searching available flights
// export const searchFlights = async (
//   req: Request,
//   res: Response
// ): Promise<any> => {
//   try {
//     const {
//       originName,
//       destinationName,
//       departureDate,
//       returnDate,
//       adults,
//       travelClass,
//       nonStop,
//       keyword, // new param for autocomplete
//     } = req.query;
//     const token = await getAmadeusToken();
//     // Helper function to get airline logo URL
//     const getAirlineLogoUrl = (iataCode: string): string => {
//       if (!iataCode) return "";
//       return `https://content.airhex.com/content/logos/airlines_${iataCode.toLowerCase()}_50_50_r.png`;
//     };
//     // Simple delay helper to throttle requests
//     const delay = (ms: number) =>
//       new Promise((resolve) => setTimeout(resolve, ms));
//     // Autocomplete: airport/city search
//     if (keyword && typeof keyword === "string") {
//       const locationRes: any = await axios.get(
//         `${baseURL}/v1/reference-data/locations`,
//         {
//           headers: { Authorization: `Bearer ${token}` },
//           params: {
//             subType: "CITY,AIRPORT",
//             keyword,
//           },
//         }
//       );
//       const suggestions = locationRes.data.data.map((item: any) => ({
//         name: item.name,
//         iataCode: item.iataCode,
//         cityCode: item.cityCode,
//         countryName: item.address?.countryName,
//         stateCode: item.address?.stateCode,
//         regionCode: item.address?.regionCode,
//       }));
//       return res.json(suggestions);
//     }
//     if (!originName || !destinationName || !departureDate || !adults) {
//       return res
//         .status(400)
//         .json({ message: "Missing required query parameters" });
//     }
//     // Enhanced helper to get IATA code and location details
//     const getLocationDetails = async (city: string) => {
//       const locationRes: any = await axios.get(
//         `${baseURL}/v1/reference-data/locations`,
//         {
//           headers: { Authorization: `Bearer ${token}` },
//           params: {
//             subType: "CITY,AIRPORT",
//             keyword: city,
//           },
//         }
//       );
//       const data = locationRes.data?.data?.[0];
//       return {
//         iataCode: data?.iataCode || city,
//         name: data?.name,
//         cityName: data?.address?.cityName,
//         countryName: data?.address?.countryName,
//         stateCode: data?.address?.stateCode,
//         regionCode: data?.address?.regionCode,
//       };
//     };
//     // Get details for both origin and destination
//     const originLocation = await getLocationDetails(originName as string);
//     const destinationLocation = await getLocationDetails(
//       destinationName as string
//     );
//     const flightRes = await axios.get(`${baseURL}/v2/shopping/flight-offers`, {
//       headers: { Authorization: `Bearer ${token}` },
//       params: {
//         originLocationCode: originLocation.iataCode,
//         destinationLocationCode: destinationLocation.iataCode,
//         departureDate,
//         returnDate,
//         adults,
//         travelClass,
//         nonStop,
//       },
//     });
//     const flightData: any = flightRes.data;
//     // Extract carrier codes
//     const carrierCodes = [
//       ...new Set(
//         flightData.data.flatMap((offer: any) =>
//           offer.itineraries.flatMap((it: any) =>
//             it.segments.map((seg: any) => seg.carrierCode)
//           )
//         )
//       ),
//     ];
//     // Lookup airline names
//     const airlineRes: any = await axios.get(
//       `${baseURL}/v1/reference-data/airlines`,
//       {
//         headers: { Authorization: `Bearer ${token}` },
//         params: {
//           airlineCodes: carrierCodes.join(","),
//         },
//       }
//     );
//     const airlines = airlineRes.data.data;
//     // Map carrierCode to airline name and logo URL
//     const airlineMap: Record<string, string> = {};
//     const airlineLogoMap: Record<string, string> = {};
//     airlines.forEach((airline: any) => {
//       airlineMap[airline.iataCode] = airline.commonName || airline.businessName;
//       airlineLogoMap[airline.iataCode] = getAirlineLogoUrl(airline.iataCode);
//     });
//     // Get details for all locations in the segments
//     const locationCodes = new Set<string>();
//     flightData.data.forEach((offer: any) => {
//       offer.itineraries.forEach((itinerary: any) => {
//         itinerary.segments.forEach((segment: any) => {
//           locationCodes.add(segment.departure.iataCode);
//           locationCodes.add(segment.arrival.iataCode);
//         });
//       });
//     });
//     // Fetch location details individually to avoid parameter length limits
//     const locationMap: Record<string, any> = {};
//     // First, check if we already have origin and destination locations
//     if (originLocation.iataCode) {
//       locationMap[originLocation.iataCode] = originLocation;
//     }
//     if (destinationLocation.iataCode) {
//       locationMap[destinationLocation.iataCode] = destinationLocation;
//     }
//     // Then fetch any remaining locations with throttling to avoid 429 errors
//     for (const code of locationCodes) {
//       // Skip if we already have this location
//       if (locationMap[code]) continue;
//       try {
//         const locationRes: any = await axios.get(
//           `${baseURL}/v1/reference-data/locations`,
//           {
//             headers: { Authorization: `Bearer ${token}` },
//             params: {
//               subType: "CITY,AIRPORT",
//               keyword: code,
//             },
//           }
//         );
//         if (
//           locationRes.data &&
//           locationRes.data.data &&
//           locationRes.data.data.length > 0
//         ) {
//           const location = locationRes.data.data[0];
//           locationMap[code] = {
//             name: location.name,
//             cityName: location.address?.cityName,
//             countryName: location.address?.countryName,
//             stateCode: location.address?.stateCode,
//             regionCode: location.address?.regionCode,
//           };
//         } else {
//           locationMap[code] = { name: code };
//         }
//       } catch (err) {
//         console.error(`Could not fetch details for location code ${code}`, err);
//         locationMap[code] = { name: code };
//       }
//       // Delay 150ms between requests to respect API rate limits
//       await delay(150);
//     }
//     // Attach airline names, logos, and location details to each segment
//     flightData.data.forEach((offer: any) => {
//       offer.itineraries.forEach((itinerary: any) => {
//         itinerary.segments.forEach((segment: any) => {
//           // Add airline name
//           segment.airlineName =
//             airlineMap[segment.carrierCode] || segment.carrierCode;
//           // Add airline logo URL safely
//           segment.airlineLogo = airlineLogoMap[segment.carrierCode] || "";
//           // Add departure location details
//           segment.departure.locationDetails = locationMap[
//             segment.departure.iataCode
//           ] || {
//             name: segment.departure.iataCode,
//           };
//           // Add arrival location details
//           segment.arrival.locationDetails = locationMap[
//             segment.arrival.iataCode
//           ] || {
//             name: segment.arrival.iataCode,
//           };
//         });
//       });
//     });
//     // Add origin and destination details to the response
//     flightData.originDetails = originLocation;
//     flightData.destinationDetails = destinationLocation;
//     return res.json(flightData);
//   } catch (error: any) {
//     console.error(
//       "Amadeus API Error:",
//       error?.response?.data || error?.message
//     );
//     return res.status(500).json({
//       message: "Error searching flights",
//       error: error?.message,
//     });
//   }
// };
// In-memory cache objects
const locationCache = {};
const airlineCache = {};
const searchFlights = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    try {
        const { originName, destinationName, departureDate, returnDate, adults, travelClass, nonStop, keyword, // new param for autocomplete
         } = req.query;
        const token = yield (0, getToken_1.default)();
        // Helper function to get airline logo URL
        const getAirlineLogoUrl = (iataCode) => {
            if (!iataCode)
                return "";
            return `https://content.airhex.com/content/logos/airlines_${iataCode.toLowerCase()}_50_50_r.png`;
        };
        // Simple delay helper to throttle requests
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        // Autocomplete: airport/city search
        if (keyword && typeof keyword === "string") {
            const locationRes = yield axios_1.default.get(`${baseURL}/v1/reference-data/locations`, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    subType: "CITY,AIRPORT",
                    keyword,
                },
            });
            const suggestions = locationRes.data.data.map((item) => {
                var _a, _b, _c;
                return ({
                    name: item.name,
                    iataCode: item.iataCode,
                    cityCode: item.cityCode,
                    countryName: (_a = item.address) === null || _a === void 0 ? void 0 : _a.countryName,
                    stateCode: (_b = item.address) === null || _b === void 0 ? void 0 : _b.stateCode,
                    regionCode: (_c = item.address) === null || _c === void 0 ? void 0 : _c.regionCode,
                });
            });
            return res.json(suggestions);
        }
        if (!originName || !destinationName || !departureDate || !adults) {
            return res
                .status(400)
                .json({ message: "Missing required query parameters" });
        }
        // Enhanced helper to get IATA code and location details
        const getLocationDetails = (city) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            if (locationCache[city]) {
                return locationCache[city]; // Use cached value
            }
            const locationRes = yield axios_1.default.get(`${baseURL}/v1/reference-data/locations`, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    subType: "CITY,AIRPORT",
                    keyword: city,
                },
            });
            const data = (_b = (_a = locationRes.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b[0];
            const location = {
                iataCode: (data === null || data === void 0 ? void 0 : data.iataCode) || city,
                name: data === null || data === void 0 ? void 0 : data.name,
                cityName: (_c = data === null || data === void 0 ? void 0 : data.address) === null || _c === void 0 ? void 0 : _c.cityName,
                countryName: (_d = data === null || data === void 0 ? void 0 : data.address) === null || _d === void 0 ? void 0 : _d.countryName,
                stateCode: (_e = data === null || data === void 0 ? void 0 : data.address) === null || _e === void 0 ? void 0 : _e.stateCode,
                regionCode: (_f = data === null || data === void 0 ? void 0 : data.address) === null || _f === void 0 ? void 0 : _f.regionCode,
            };
            locationCache[city] = location; // Cache the result
            return location;
        });
        // Get details for both origin and destination
        const originLocation = yield getLocationDetails(originName);
        const destinationLocation = yield getLocationDetails(destinationName);
        const flightRes = yield axios_1.default.get(`${baseURL}/v2/shopping/flight-offers`, {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                originLocationCode: originLocation.iataCode,
                destinationLocationCode: destinationLocation.iataCode,
                departureDate,
                returnDate,
                adults,
                travelClass,
                nonStop,
            },
        });
        const flightData = flightRes.data;
        // Extract carrier codes
        const carrierCodes = [
            ...new Set(flightData.data.flatMap((offer) => offer.itineraries.flatMap((it) => it.segments.map((seg) => seg.carrierCode)))),
        ];
        // Lookup airline names (with caching)
        const missingCarrierCodes = carrierCodes.filter((code) => !airlineCache[code]);
        if (missingCarrierCodes.length > 0) {
            const airlineRes = yield axios_1.default.get(`${baseURL}/v1/reference-data/airlines`, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    airlineCodes: missingCarrierCodes.join(","),
                },
            });
            airlineRes.data.data.forEach((airline) => {
                airlineCache[airline.iataCode] = airline; // Cache airline details
            });
        }
        // Build airlineMap and airlineLogoMap from cache
        const airlineMap = {};
        const airlineLogoMap = {};
        carrierCodes.forEach((code) => {
            const airline = airlineCache[code];
            if (airline) {
                airlineMap[code] = airline.commonName || airline.businessName;
                airlineLogoMap[code] = getAirlineLogoUrl(code);
            }
            else {
                airlineMap[code] = code;
                airlineLogoMap[code] = "";
            }
        });
        // Get details for all locations in the segments
        const locationCodes = new Set();
        flightData.data.forEach((offer) => {
            offer.itineraries.forEach((itinerary) => {
                itinerary.segments.forEach((segment) => {
                    locationCodes.add(segment.departure.iataCode);
                    locationCodes.add(segment.arrival.iataCode);
                });
            });
        });
        // Fetch location details individually to avoid parameter length limits
        const locationMap = {};
        // First, check if we already have origin and destination locations
        if (originLocation.iataCode) {
            locationMap[originLocation.iataCode] = originLocation;
        }
        if (destinationLocation.iataCode) {
            locationMap[destinationLocation.iataCode] = destinationLocation;
        }
        // Then fetch any remaining locations with throttling to avoid 429 errors
        for (const code of locationCodes) {
            if (locationMap[code])
                continue; // already fetched
            if (locationCache[code]) {
                locationMap[code] = locationCache[code]; // Use cached value
                continue;
            }
            try {
                const locationRes = yield axios_1.default.get(`${baseURL}/v1/reference-data/locations`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: {
                        subType: "CITY,AIRPORT",
                        keyword: code,
                    },
                });
                if (locationRes.data &&
                    locationRes.data.data &&
                    locationRes.data.data.length > 0) {
                    const location = locationRes.data.data[0];
                    const locObj = {
                        name: location.name,
                        cityName: (_a = location.address) === null || _a === void 0 ? void 0 : _a.cityName,
                        countryName: (_b = location.address) === null || _b === void 0 ? void 0 : _b.countryName,
                        stateCode: (_c = location.address) === null || _c === void 0 ? void 0 : _c.stateCode,
                        regionCode: (_d = location.address) === null || _d === void 0 ? void 0 : _d.regionCode,
                    };
                    locationMap[code] = locObj;
                    locationCache[code] = locObj; // cache it
                }
                else {
                    locationMap[code] = { name: code };
                    locationCache[code] = { name: code }; // cache it
                }
            }
            catch (err) {
                console.error(`Could not fetch details for location code ${code}`, err);
                locationMap[code] = { name: code };
                locationCache[code] = { name: code }; // cache it
            }
            yield delay(150); // Delay 150ms between requests to respect API rate limits
        }
        // Attach airline names, logos, and location details to each segment
        flightData.data.forEach((offer) => {
            offer.itineraries.forEach((itinerary) => {
                itinerary.segments.forEach((segment) => {
                    // Add airline name
                    segment.airlineName =
                        airlineMap[segment.carrierCode] || segment.carrierCode;
                    // Add airline logo URL safely
                    segment.airlineLogo = airlineLogoMap[segment.carrierCode] || "";
                    // Add departure location details
                    segment.departure.locationDetails = locationMap[segment.departure.iataCode] || {
                        name: segment.departure.iataCode,
                    };
                    // Add arrival location details
                    segment.arrival.locationDetails = locationMap[segment.arrival.iataCode] || {
                        name: segment.arrival.iataCode,
                    };
                });
            });
        });
        // Add origin and destination details to the response
        flightData.originDetails = originLocation;
        flightData.destinationDetails = destinationLocation;
        return res.json(flightData);
    }
    catch (error) {
        console.error("Amadeus API Error:", ((_e = error === null || error === void 0 ? void 0 : error.response) === null || _e === void 0 ? void 0 : _e.data) || (error === null || error === void 0 ? void 0 : error.message));
        return res.status(500).json({
            message: "Error searching flights",
            error: error === null || error === void 0 ? void 0 : error.message,
        });
    }
});
exports.searchFlights = searchFlights;
