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
exports.createCustomHotels = exports.searchHotels = void 0;
exports.getAllHotelDetails = getAllHotelDetails;
exports.getSingleHotelDetailsById = getSingleHotelDetailsById;
exports.deleteSingleHotel = deleteSingleHotel;
const getToken_1 = __importDefault(require("../utils/getToken"));
const axios_1 = __importDefault(require("axios"));
const streamifier_1 = require("../config/streamifier");
const client_1 = require("@prisma/client");
const baseURL = "https://test.api.amadeus.com";
const prisma = new client_1.PrismaClient();
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
const createCustomHotels = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, description, address, city, country, phone, email, website, rating, price, } = req.body;
        if (!name || !address || !city || !country) {
            return res.status(400).json({ error: `Missing required fields ` });
        }
        const files = req.files || [];
        if (files.length === 0) {
            return res.status(400).json({
                error: `Image is required`,
            });
        }
        if (files.length > 7) {
            return res.status(400).json({ error: "Maximum 7 images allowed" });
        }
        const uploadPromises = files.map((file) => (0, streamifier_1.streamUpload)(file.buffer));
        const imageUrls = yield Promise.all(uploadPromises);
        const hotel = yield prisma.hotel.create({
            data: {
                name,
                description,
                address,
                city,
                country,
                phone,
                email,
                website,
                rating: rating ? parseFloat(rating) : undefined,
                price: price ? parseFloat(price) : undefined,
                images: imageUrls
            },
        });
        return res.status(201).json({
            message: `Hotel created successfully`,
            data: hotel,
        });
    }
    catch (error) {
        console.error(`Error:`, error);
        return res.status(500).json({
            error: `Internal server error`,
        });
    }
});
exports.createCustomHotels = createCustomHotels;
function getAllHotelDetails(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const hotels = yield prisma.hotel.findMany();
            if (!hotels) {
                return res.status(404).json({ error: `Hotels not found ` });
            }
            return res.status(200).json({
                message: `Hotels successfully retrieved`,
                data: hotels
            });
        }
        catch (error) {
            console.error(`Error:`, error);
            return res.status(500).json({
                error: `Internal server error`,
            });
        }
    });
}
function getSingleHotelDetailsById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { hotelId } = req.params;
            const hotel = yield prisma.hotel.findUnique({ where: { id: hotelId } });
            if (!hotel) {
                return res.status(404).json({ error: `Hotel does not exist` });
            }
            return res.status(200).json({
                message: `Hotel's details gotten successfully`,
                data: hotel,
            });
        }
        catch (error) {
            console.error(`Response:`, error);
            return res.status(500).json({
                message: `Internal server error`
            });
        }
    });
}
function deleteSingleHotel(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { hotelId } = req.params;
            const hotel = yield prisma.hotel.findUnique({ where: { id: hotelId } });
            if (!hotel) {
                return res.status(404).json({
                    error: `Hotel not found`
                });
            }
            yield prisma.hotel.delete({ where: { id: hotelId } });
            return res.status(200).json({
                message: `Hotel deleted successfully`
            });
        }
        catch (error) {
            console.error(`Response:`, error);
            return res.status(500).json({
                error: `Internal server error`,
            });
        }
    });
}
