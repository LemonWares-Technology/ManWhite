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
exports.getCachedIataCode = getCachedIataCode;
exports.getCachedLocationDetails = getCachedLocationDetails;
const axios_1 = __importDefault(require("axios"));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Cache within the request scope
const locationCache = {};
const iataCache = {};
function getCachedIataCode(locationName, token) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        if (iataCache[locationName])
            return iataCache[locationName];
        try {
            const response = yield axios_1.default.get("https://test.api.amadeus.com/v1/reference-data/locations", {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    keyword: locationName,
                    subType: "CITY,AIRPORT",
                    page: { limit: 1 },
                },
            });
            const code = ((_b = (_a = response.data.data) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.iataCode) || null;
            if (code)
                iataCache[locationName] = code;
            return code;
        }
        catch (error) {
            console.error(`Failed to get IATA for ${locationName}:`, ((_c = error.response) === null || _c === void 0 ? void 0 : _c.data) || error.message);
            return null;
        }
    });
}
function getCachedLocationDetails(iataCode, token) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (locationCache[iataCode])
            return locationCache[iataCode];
        try {
            // Small delay to prevent 429
            yield sleep(250);
            const response = yield axios_1.default.get("https://test.api.amadeus.com/v1/reference-data/locations", {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    keyword: iataCode,
                    subType: "AIRPORT",
                },
            });
            const details = (_a = response.data.data) === null || _a === void 0 ? void 0 : _a[0];
            if (details)
                locationCache[iataCode] = details;
            return details;
        }
        catch (error) {
            console.error(`Failed to get location for ${iataCode}:`, ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
            return null;
        }
    });
}
