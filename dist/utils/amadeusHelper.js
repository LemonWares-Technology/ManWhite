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
exports.getConversionRate = getConversionRate;
exports.mapTravelerToAmadeusFormat = mapTravelerToAmadeusFormat;
const date_fns_1 = require("date-fns");
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const CURRENCY_FREAKS_API_KEY = process.env.CURRENCY_FREAKS_API_KEY || "232f3104c7014e39a1b00d13285860c9";
if (!CURRENCY_FREAKS_API_KEY) {
    throw new Error("Missing CURRENCY_FREAKS_API_KEY in environment variables");
}
function getConversionRate(from, to) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (from === to)
            return 1;
        try {
            const response = yield axios_1.default.get(`https://api.currencyfreaks.com/v2.0/rates/latest`, {
                params: {
                    apikey: CURRENCY_FREAKS_API_KEY,
                    base: from.toUpperCase(),
                    symbols: to.toUpperCase(),
                },
            });
            const rates = (_a = response.data) === null || _a === void 0 ? void 0 : _a.rates;
            if (!rates || !rates[to.toUpperCase()]) {
                console.error(`Conversion rate for ${to} not found in response`, response.data);
                return 1;
            }
            return parseFloat(rates[to.toUpperCase()]);
        }
        catch (error) {
            console.error("Error fetching conversion rate:", error);
            return 1;
        }
    });
}
function formatDate(date) {
    if (!date)
        return null;
    try {
        let parsedDate;
        if (date instanceof Date) {
            parsedDate = date;
        }
        else if (typeof date === "string") {
            // Try to parse ISO string
            parsedDate = (0, date_fns_1.parseISO)(date);
            if (isNaN(parsedDate.getTime())) {
                // Invalid date string
                return null;
            }
        }
        else {
            return null;
        }
        // Format as YYYY-MM-DD
        return (0, date_fns_1.format)(parsedDate, "yyyy-MM-dd");
    }
    catch (_a) {
        return null;
    }
}
function mapTravelerToAmadeusFormat(t, id) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
    return {
        id: id,
        dateOfBirth: formatDate(t.dateOfBirth),
        name: {
            firstName: ((_a = t.name) === null || _a === void 0 ? void 0 : _a.firstName) || t.firstName, // Try nested first, fallback to flat
            lastName: ((_b = t.name) === null || _b === void 0 ? void 0 : _b.lastName) || t.lastName,
        },
        gender: t.gender,
        contact: {
            emailAddress: ((_c = t.contact) === null || _c === void 0 ? void 0 : _c.emailAddress) || t.email,
            phones: [
                {
                    deviceType: "MOBILE",
                    countryCallingCode: ((_f = (_e = (_d = t.contact) === null || _d === void 0 ? void 0 : _d.phones) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.countryCallingCode) || t.countryCode,
                    number: ((_j = (_h = (_g = t.contact) === null || _g === void 0 ? void 0 : _g.phones) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.number) || t.phone,
                },
            ],
        },
        documents: [
            {
                documentType: "PASSPORT",
                number: ((_l = (_k = t.documents) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.number) || t.passportNumber,
                expiryDate: formatDate(((_o = (_m = t.documents) === null || _m === void 0 ? void 0 : _m[0]) === null || _o === void 0 ? void 0 : _o.expiryDate) || t.passportExpiry),
                issuanceCountry: ((_q = (_p = t.documents) === null || _p === void 0 ? void 0 : _p[0]) === null || _q === void 0 ? void 0 : _q.issuanceCountry) || t.issuanceCountry,
                validityCountry: ((_s = (_r = t.documents) === null || _r === void 0 ? void 0 : _r[0]) === null || _s === void 0 ? void 0 : _s.validityCountry) || t.validityCountry,
                nationality: ((_u = (_t = t.documents) === null || _t === void 0 ? void 0 : _t[0]) === null || _u === void 0 ? void 0 : _u.nationality) || t.nationality,
                birthPlace: ((_w = (_v = t.documents) === null || _v === void 0 ? void 0 : _v[0]) === null || _w === void 0 ? void 0 : _w.birthPlace) || t.birthPlace,
                issuanceLocation: ((_y = (_x = t.documents) === null || _x === void 0 ? void 0 : _x[0]) === null || _y === void 0 ? void 0 : _y.issuanceLocation) || t.issuanceLocation,
                issuanceDate: ((_0 = (_z = t.documents) === null || _z === void 0 ? void 0 : _z[0]) === null || _0 === void 0 ? void 0 : _0.issuanceDate) || t.issuanceDate,
                holder: true,
            },
        ],
    };
}
