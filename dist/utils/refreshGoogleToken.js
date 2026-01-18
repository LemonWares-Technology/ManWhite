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
exports.refreshGoogleToken = refreshGoogleToken;
const google_auth_library_1 = require("google-auth-library");
const prisma_1 = require("../lib/prisma");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const client = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
function refreshGoogleToken(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { refreshToken: true },
        });
        if (!(user === null || user === void 0 ? void 0 : user.refreshToken)) {
            throw new Error("No refresh token found");
        }
        const { credentials } = yield client.refreshToken(user.refreshToken);
        if (!credentials.access_token) {
            throw new Error("Failed to refresh access token");
        }
        // Update new refreshToken if Google provides a new one
        yield prisma_1.prisma.user.update({
            where: { id: userId },
            data: { refreshToken: credentials.refresh_token || user.refreshToken },
        });
        return credentials.access_token;
    });
}
