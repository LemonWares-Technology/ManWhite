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
exports.searchToursByCity = searchToursByCity;
exports.getTourDetailsById = getTourDetailsById;
const axios_1 = __importDefault(require("axios"));
const getToken_1 = __importDefault(require("../utils/getToken"));
const apiResponse_1 = require("../utils/apiResponse");
const baseURL = `https://test.api.amadeus.com`;
// export async function searchToursByCity(
//   req: Request,
//   res: Response
// ): Promise<any> {
//   try {
//     const { cityName, radiusKM = 5 } = req.query;
//     if (!cityName || typeof cityName !== "string") {
//       return res
//         .status(400)
//         .json({ error: "cityName query parameter is required" });
//     }
//     // 1. Get Amadeus OAuth token
//     const token = await getAmadeusToken();
//     // 2. Search cities to get coordinates for all matches
//     const cityResponse: any = await axios.get(
//       `${baseURL}/v1/reference-data/locations/cities`,
//       {
//         params: {
//           keyword: cityName,
//         },
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       }
//     );
//     const cities = cityResponse.data?.data || [];
//     if (cities.length === 0) {
//       return res.status(404).json({ message: "No cities found" });
//     }
//     // 3. For each city, fetch tours/activities by radius using latitude and longitude
//     const radius = Number(radiusKM);
//     const city = cities[0];
//     const longitude = city.geoCode?.longitude;
//     const latitude = city.geoCode?.latitude;
//     const activitiesResponse: any = await axios.get(`${baseURL}/v1/shopping/activities`, {
//         params: {
//             longitude,
//             latitude,
//             radius: radius,
//         },
//         headers: {
//             Authorization: `Bearer ${token}`
//         }
//     })
//     const activities = activitiesResponse.data.data
//     return res.status(200).json({
//       message: `Found ${activities.length} tours near ${cities[0]} cities matching '${cityName}'`,
//       results: activities,
//     });
//   } catch (error: any) {
//     console.error(
//       "Error in searchToursByCity:",
//       error.response?.data || error.message
//     );
//     return res.status(500).json({
//       error: "Failed to search tours",
//       details:
//         process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// }
function searchToursByCity(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        try {
            const { cityName, radiusKM = 5 } = req.query;
            if (!cityName || typeof cityName !== "string") {
                return (0, apiResponse_1.sendError)(res, "cityName query parameter is required", 400);
            }
            // 1. Get Amadeus OAuth token
            const token = yield (0, getToken_1.default)();
            // 2. Search cities to get coordinates for all matches
            const cityResponse = yield axios_1.default.get(`${baseURL}/v1/reference-data/locations/cities`, {
                params: {
                    keyword: cityName,
                },
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const cities = ((_a = cityResponse.data) === null || _a === void 0 ? void 0 : _a.data) || [];
            if (cities.length === 0) {
                return (0, apiResponse_1.sendError)(res, "No cities found", 404);
            }
            // 3. Use the first city’s coordinates
            const radius = Number(radiusKM);
            const city = cities[0];
            const longitude = (_b = city.geoCode) === null || _b === void 0 ? void 0 : _b.longitude;
            const latitude = (_c = city.geoCode) === null || _c === void 0 ? void 0 : _c.latitude;
            if (longitude === undefined || latitude === undefined) {
                return (0, apiResponse_1.sendError)(res, "City coordinates not found", 500);
            }
            // 4. Fetch tours/activities by radius
            const activitiesResponse = yield axios_1.default.get(`${baseURL}/v1/shopping/activities`, {
                params: {
                    longitude,
                    latitude,
                    radius,
                },
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const activities = ((_d = activitiesResponse.data) === null || _d === void 0 ? void 0 : _d.data) || [];
            // 5. Filter out tours without price or pictures
            const filteredActivities = activities.filter((tour) => tour.price &&
                typeof tour.price.amount === "string" &&
                tour.price.amount.trim() !== "" &&
                Array.isArray(tour.pictures) &&
                tour.pictures.length > 0);
            return (0, apiResponse_1.sendSuccess)(res, `Found ${filteredActivities.length} tours near ${city.name} matching '${cityName}'`, filteredActivities);
        }
        catch (error) {
            console.error("Error in searchToursByCity:", ((_e = error.response) === null || _e === void 0 ? void 0 : _e.data) || error.message);
            return (0, apiResponse_1.sendError)(res, "Failed to search tours", 500, error);
        }
    });
}
function getTourDetailsById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { activityId } = req.params;
            if (!activityId) {
                return (0, apiResponse_1.sendError)(res, "Missing required parameters: activityId", 400);
            }
            const token = yield (0, getToken_1.default)();
            const activity = yield axios_1.default.get(`${baseURL}/v1/shopping/activities/${activityId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const activityResponse = (_a = activity.data) === null || _a === void 0 ? void 0 : _a.data;
            return (0, apiResponse_1.sendSuccess)(res, "Success", activityResponse);
        }
        catch (error) {
            console.error(`Error:`, error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
