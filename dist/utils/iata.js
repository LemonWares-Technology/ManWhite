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
exports.getIataCodeDetails = void 0;
const getToken_1 = __importDefault(require("./getToken"));
// Fix: Use base URL without the full path
const baseURL = "https://test.api.amadeus.com";
const getIataCodeDetails = (iataCode) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g;
    try {
        // Build the complete URL
        const searchUrl = `${baseURL}/v1/reference-data/locations?keyword=${iataCode}&subType=AIRPORT&page[limit]=1`;
        const token = yield (0, getToken_1.default)();
        const response = yield fetch(searchUrl, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = yield response.json();
        console.log(`IATA lookup data for ${iataCode}:`, data);
        if (data.data && data.data.length > 0) {
            const airport = data.data[0];
            return {
                iataCode: airport.iataCode,
                name: airport.name,
                detailedName: airport.detailedName,
                cityName: (_a = airport.address) === null || _a === void 0 ? void 0 : _a.cityName,
                cityCode: (_b = airport.address) === null || _b === void 0 ? void 0 : _b.cityCode,
                countryName: (_c = airport.address) === null || _c === void 0 ? void 0 : _c.countryName,
                countryCode: (_d = airport.address) === null || _d === void 0 ? void 0 : _d.countryCode,
                stateCode: (_e = airport.address) === null || _e === void 0 ? void 0 : _e.stateCode,
                timeZone: airport.timeZoneOffset,
                coordinates: {
                    latitude: (_f = airport.geoCode) === null || _f === void 0 ? void 0 : _f.latitude,
                    longitude: (_g = airport.geoCode) === null || _g === void 0 ? void 0 : _g.longitude,
                },
                type: airport.subType,
                relevance: airport.relevance,
            };
        }
        else {
            throw new Error(`No airport found for IATA code: ${iataCode}`);
        }
    }
    catch (error) {
        console.error(`Error looking up IATA code ${iataCode}:`, error);
        throw error;
    }
});
exports.getIataCodeDetails = getIataCodeDetails;
