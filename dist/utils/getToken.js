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
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const baseURL = "https://test.api.amadeus.com";
const api_key = process.env.AMADEUS_API_KEY;
const api_secret = process.env.AMADEUS_API_SECRET;
const getAmadeusToken = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield axios_1.default.post(`${baseURL}/v1/security/oauth2/token`, new URLSearchParams({
            grant_type: "client_credentials",
            client_id: api_key,
            client_secret: api_secret,
        }), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        return response.data.access_token;
    }
    catch (error) {
        // console.log(`This is the error here: `, error?.message)
        throw new Error((error === null || error === void 0 ? void 0 : error.message) || "Failed to authenticate with Amadeus API");
    }
});
exports.default = getAmadeusToken;
