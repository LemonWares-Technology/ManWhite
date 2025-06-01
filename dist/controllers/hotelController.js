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
const getToken_1 = __importDefault(require("../utils/getToken"));
const axios_1 = __importDefault(require("axios"));
const baseURL = "https://test.api.amadeus.com";
const searchHotels = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { keyword, subType } = req.query;
        if (!keyword || !subType) {
            return res.status(400).json({
                message: "Missing required query parameters: keyword and subType are required.",
            });
        }
        const allowedSubTypes = ["HOTEL_LEISURE", "HOTEL_GDS"];
        if (!allowedSubTypes.includes(String(subType).toUpperCase())) {
            return res.status(400).json({
                message: `Invalid subType. Allowed values are ${allowedSubTypes.join(", ")}`,
            });
        }
        const token = yield (0, getToken_1.default)();
        console.log("Token:", token); // Log the token for debugging
        const hotelResponse = yield axios_1.default.get(`${baseURL}/v1/reference-data/locations/hotels`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            params: {
                subType,
                keyword,
            },
        });
        console.log("Keyword:", keyword); // Log the keyword for debugging
        console.log("SubType:", subType); // Log the subType for debugging
        return res.status(200).json({
            message: "Hotels fetched successfully",
            data: hotelResponse.data, // Return only the data part
        });
    }
    catch (error) {
        console.error("Error fetching hotels:", error); // log the entire error
        console.error("Amadeus API Error Details:", (_a = error.response) === null || _a === void 0 ? void 0 : _a.data); // log details
        return res.status(500).json({
            message: "Error occurred while searching for hotels",
            error: error.message || "Unknown error",
            amadeusError: (_b = error.response) === null || _b === void 0 ? void 0 : _b.data, // include Amadeus error details in the response
        });
    }
});
exports.searchHotels = searchHotels;
// export const hotelOffers = async (req: Request, res: Response): Promise<any> => {
//     try {
//         const {}
//     } catch (error: any) {
//         return res.status(500).json({
//             message: `Error occured while searching for hotel offers`,
//             data: error?.message || "Unknown error",
//             amadeusError: error.response?.data, // include Amadeus error details in the response
//         })
//     }
// }
