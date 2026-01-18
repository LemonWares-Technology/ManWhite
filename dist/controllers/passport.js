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
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const prisma_1 = require("../lib/prisma");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
passport_1.default.use(new passport_google_oauth20_1.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID || "PLACEHOLDER_CLIENT_ID",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "PLACEHOLDER_CLIENT_SECRET",
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback",
}, (accessToken, refreshGoogleToken, profile, done) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const email = (_a = profile === null || profile === void 0 ? void 0 : profile.emails) === null || _a === void 0 ? void 0 : _a[0].value;
    const avatar = (_b = profile === null || profile === void 0 ? void 0 : profile.photos) === null || _b === void 0 ? void 0 : _b[0].value;
    if (!email)
        return done(new Error("No email found"));
    try {
        let user = yield prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = yield prisma_1.prisma.user.create({
                data: {
                    email,
                    firstName: (_c = profile.name) === null || _c === void 0 ? void 0 : _c.givenName,
                    lastName: (_d = profile.name) === null || _d === void 0 ? void 0 : _d.familyName,
                    googleId: profile.id,
                    avatarUrl: avatar,
                    verified: true,
                },
            });
        }
        return done(null, user);
    }
    catch (error) {
        return done(error);
    }
})));
passport_1.default.serializeUser((user, done) => {
    done(null, user.id);
});
passport_1.default.deserializeUser((id, done) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield prisma_1.prisma.user.findUnique({ where: { id } });
    done(null, user);
}));
