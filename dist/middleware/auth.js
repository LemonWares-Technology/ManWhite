"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuthentication = exports.authenticateAdmin = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
const apiResponse_1 = require("../utils/apiResponse");
dotenv_1.default.config();
const JWT_SECRET = process.env.JWT || "code";
const authenticateToken = (req, res, next) => {
    var _a;
    const authHeader = req.headers["authorization"];
    const headerToken = authHeader && authHeader.split(" ")[1];
    const cookieToken = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.accessToken;
    const token = headerToken || cookieToken;
    if (!token) {
        return (0, apiResponse_1.sendError)(res, "Access token required", 401);
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT);
        req.user = decoded;
        next();
    }
    catch (error) {
        return (0, apiResponse_1.sendError)(res, "Invalid or expired token", 403);
    }
};
exports.authenticateToken = authenticateToken;
const authenticateAdmin = (req, res, next) => {
    var _a;
    const authHeader = req.headers["authorization"];
    const headerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    const cookieToken = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.accessToken;
    const token = headerToken || cookieToken;
    if (!token) {
        return (0, apiResponse_1.sendError)(res, "Authorization token missing", 401);
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        if (!decoded || decoded.role !== "ADMIN") {
            return (0, apiResponse_1.sendError)(res, "Forbidden: Admins only", 403);
        }
        req.user = decoded;
        next();
    }
    catch (error) {
        console.error(`Admin authentication error: ${error}`);
        return (0, apiResponse_1.sendError)(res, "Invalid or expired token", 401);
    }
};
exports.authenticateAdmin = authenticateAdmin;
const optionalAuthentication = (req, res, next) => {
    var _a;
    const authHeader = req.headers["authorization"];
    const headerToken = authHeader && authHeader.split(" ")[1];
    const cookieToken = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.accessToken;
    const token = headerToken || cookieToken;
    // If no token provided, continue without authentication (guest user)
    if (!token) {
        req.user = null;
        return next();
    }
    try {
        // If token is provided, verify it
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT);
        req.user = decoded;
        next();
    }
    catch (error) {
        // If token is invalid, treat as guest user instead of throwing error
        console.warn("Invalid token provided, treating as guest user:", error);
        req.user = null;
        next();
    }
};
exports.optionalAuthentication = optionalAuthentication;
