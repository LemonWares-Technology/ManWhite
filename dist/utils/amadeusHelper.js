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
