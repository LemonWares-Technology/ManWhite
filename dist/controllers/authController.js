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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshTokens = exports.logout = exports.updateTravelerDetails = exports.getTravelerById = exports.getAllTravelers = exports.getTravelerForAmadeusBooking = exports.getTravelersForAmadeusBooking = exports.createTraveler = exports.updateuserAccountDetails = exports.getAllAccounts = exports.getSingleUserAccount = exports.createNewPassword = exports.resetPassword = exports.requestPasswordReset = exports.checkPassword = exports.loginAccount = exports.createPassword = exports.verifyAccount = exports.createAccount = void 0;
exports.deleteUserById = deleteUserById;
exports.createGuestUser = createGuestUser;
exports.getAllGuestUsers = getAllGuestUsers;
exports.getGuestUserById = getGuestUserById;
const prisma_1 = require("../lib/prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const date_fns_1 = require("date-fns");
const amadeusHelper_1 = require("../utils/amadeusHelper");
const zeptomail_1 = require("../utils/zeptomail");
const apiResponse_1 = require("../utils/apiResponse");
const authUtils_1 = require("../utils/authUtils");
const createAccount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        if (!email) {
            return (0, apiResponse_1.sendError)(res, "Email is required", 400);
        }
        const existingUser = yield prisma_1.prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });
        if (existingUser && existingUser.verified) {
            return (0, apiResponse_1.sendError)(res, "Account with email address already exists", 400);
        }
        const verificationCode = crypto_1.default.randomInt(100000, 999999).toString();
        const verificationCodeExpiresIn = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes
        let user;
        if (existingUser && !existingUser.verified) {
            // Resend code for unverified account
            user = yield prisma_1.prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    verificationCode,
                    verificationCodeExpiresIn,
                },
            });
        }
        else {
            // Create new account
            user = yield prisma_1.prisma.user.create({
                data: {
                    email: email.toLowerCase(),
                    verificationCode,
                    verificationCodeExpiresIn,
                    verified: false,
                },
            });
        }
        yield (0, zeptomail_1.sendVerificationEmail)(user);
        const { password: _ } = user, hidePassword = __rest(user, ["password"]);
        return (0, apiResponse_1.sendSuccess)(res, `Verification code sent to ${email}`, hidePassword, 201);
    }
    catch (error) {
        console.error("Create account error:", error);
        return (0, apiResponse_1.sendError)(res, "Error occurred during account creation", 500, error);
    }
});
exports.createAccount = createAccount;
const verifyAccount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            return (0, apiResponse_1.sendError)(res, "Email and code are required", 400);
        }
        const user = yield prisma_1.prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });
        if (!user) {
            return (0, apiResponse_1.sendError)(res, "Account not found", 404);
        }
        if (user.verified) {
            return (0, apiResponse_1.sendError)(res, "Account already verified", 400);
        }
        if (user.verificationCode !== code) {
            return (0, apiResponse_1.sendError)(res, "Invalid verification code", 400);
        }
        if (user.verificationCodeExpiresIn && (0, date_fns_1.isBefore)(new Date(user.verificationCodeExpiresIn), new Date())) {
            return (0, apiResponse_1.sendError)(res, "Verification code has expired", 400);
        }
        yield prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                verified: true,
                verificationCode: null,
                verificationCodeExpiresIn: null,
            },
        });
        return (0, apiResponse_1.sendSuccess)(res, "Account verified successfully", { userId: user.id });
    }
    catch (error) {
        console.error("Verify account error:", error);
        return (0, apiResponse_1.sendError)(res, "Error during verification", 500, error);
    }
});
exports.verifyAccount = verifyAccount;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const createPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { firstName, lastName, password } = req.body;
        if (!password || !passwordRegex.test(password)) {
            return (0, apiResponse_1.sendError)(res, "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.", 400);
        }
        const user = yield prisma_1.prisma.user.findUnique({ where: { id } });
        if (!user) {
            return (0, apiResponse_1.sendError)(res, "Account does not exist", 404);
        }
        if (!user.verified) {
            return (0, apiResponse_1.sendError)(res, "Please verify your email before creating a password", 403);
        }
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        const { accessToken, refreshToken } = (0, authUtils_1.generateTokens)(user);
        const newUser = yield prisma_1.prisma.user.update({
            where: { id },
            data: {
                firstName,
                lastName,
                password: hashedPassword,
                refreshToken,
                lastLoginAt: new Date(),
                lastActiveAt: new Date(),
            },
        });
        const { password: _, refreshToken: __ } = newUser, hideSensitive = __rest(newUser, ["password", "refreshToken"]);
        (0, authUtils_1.setTokenCookies)(res, accessToken, refreshToken);
        return (0, apiResponse_1.sendSuccess)(res, "Profile and password created successfully", {
            user: hideSensitive,
            accessToken,
            refreshToken
        });
    }
    catch (error) {
        return (0, apiResponse_1.sendError)(res, "Error occurred while creating password", 500, error);
    }
});
exports.createPassword = createPassword;
function deleteUserById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { userId } = req.params;
        try {
            // Check if target user exists
            const existingUser = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
            });
            if (!existingUser) {
                return (0, apiResponse_1.sendError)(res, "User not found", 404);
            }
            // Delete user by ID directly
            yield prisma_1.prisma.user.delete({ where: { id: userId } });
            return (0, apiResponse_1.sendSuccess)(res, "User deleted successfully", { userId });
        }
        catch (error) {
            console.error("User deletion error:", error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
const loginAccount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        const user = yield prisma_1.prisma.user.findUnique({
            where: { email },
        });
        if (!user) {
            return (0, apiResponse_1.sendError)(res, "Account does not exist", 404);
        }
        // await sendLoginEmail(user)
        return (0, apiResponse_1.sendSuccess)(res, "Almost there...", user);
    }
    catch (error) {
        return (0, apiResponse_1.sendError)(res, "Error occurred during login", 500, error);
    }
});
exports.loginAccount = loginAccount;
const checkPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.params;
        const { password } = req.body;
        const user = yield prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            return (0, apiResponse_1.sendError)(res, "Account does not exist", 404);
        }
        const MAX_ATTEMPTS = 5;
        const LOCK_DURATION_MINUTES = 5;
        // Check if account is locked
        if (user.loginLockedUntil && (0, date_fns_1.isBefore)(new Date(), user.loginLockedUntil)) {
            const minutesLeft = Math.ceil((user.loginLockedUntil.getTime() - Date.now()) / 60000);
            return (0, apiResponse_1.sendError)(res, `Account is locked. Try again in ${minutesLeft} minute(s).`, 403);
        }
        const isPasswordCorrect = yield bcryptjs_1.default.compare(password, user.password || "");
        if (isPasswordCorrect) {
            // Generate tokens
            const { accessToken, refreshToken } = (0, authUtils_1.generateTokens)(user);
            // Reset loginAttempts and update login metadata
            yield prisma_1.prisma.user.update({
                where: { email },
                data: {
                    loginAttempts: 0,
                    loginLockedUntil: null,
                    refreshToken,
                    lastLoginAt: new Date(),
                    lastActiveAt: new Date(),
                },
            });
            (0, authUtils_1.setTokenCookies)(res, accessToken, refreshToken);
            const { password: _, refreshToken: __ } = user, hideSensitive = __rest(user, ["password", "refreshToken"]);
            return (0, apiResponse_1.sendSuccess)(res, "Logged in successfully", {
                user: hideSensitive,
                accessToken,
                refreshToken
            });
        }
        else {
            const updatedUser = yield prisma_1.prisma.user.update({
                where: { email },
                data: {
                    loginAttempts: {
                        increment: 1,
                    },
                },
            });
            if (updatedUser.loginAttempts >= MAX_ATTEMPTS) {
                const lockUntil = (0, date_fns_1.addMinutes)(new Date(), LOCK_DURATION_MINUTES);
                yield prisma_1.prisma.user.update({
                    where: { email },
                    data: {
                        loginLockedUntil: lockUntil,
                    },
                });
                return (0, apiResponse_1.sendError)(res, `Account locked due to too many failed attempts. Try again in ${LOCK_DURATION_MINUTES} minutes.`, 403);
            }
            const remaining = MAX_ATTEMPTS - updatedUser.loginAttempts;
            return (0, apiResponse_1.sendError)(res, `Incorrect password. ${remaining} attempt(s) remaining.`, 400);
        }
    }
    catch (error) {
        return (0, apiResponse_1.sendError)(res, "Error occurred validating password", 500, error);
    }
});
exports.checkPassword = checkPassword;
const requestPasswordReset = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.body;
    if (!email) {
        return (0, apiResponse_1.sendError)(res, "Email is required.", 400);
    }
    try {
        const user = yield prisma_1.prisma.user.findUnique({
            where: { email },
            select: {
                // Select only necessary fields for initial check and update
                id: true,
                email: true,
                recoveryCode: true, // Include these to see their current state before update
                recoveryCodeExpiresIn: true,
            },
        });
        if (!user) {
            console.log(`[requestPasswordReset] User with email ${email} not found. Sending generic success message.`);
            return (0, apiResponse_1.sendSuccess)(res, "If an account with that email exists, a password reset code has been sent.");
        }
        const recoveryCode = crypto_1.default.randomInt(100000, 999999).toString();
        const recoveryCodeExpiresIn = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
        // Perform the update and capture the result
        const updatedUser = yield prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                recoveryCode,
                recoveryCodeExpiresIn,
                loginAttempts: 0,
                loginLockedUntil: null,
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                recoveryCode: true,
                recoveryCodeExpiresIn: true,
            },
        });
        yield (0, zeptomail_1.sendVerificationToken)(updatedUser);
        return (0, apiResponse_1.sendSuccess)(res, "If an account with that email exists, a password reset code has been sent.");
    }
    catch (error) {
        return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
    }
});
exports.requestPasswordReset = requestPasswordReset;
const resetPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { recoveryCode, newPassword } = req.body;
    // Log incoming request body for debugging
    if (!recoveryCode || !newPassword) {
        return (0, apiResponse_1.sendError)(res, "Recovery code and new password are required.", 400);
    }
    try {
        const currentTime = new Date();
        const user = yield prisma_1.prisma.user.findFirst({
            where: {
                recoveryCode: recoveryCode, // Exact match for the recovery code
                recoveryCodeExpiresIn: {
                    gte: currentTime, // Check if the recovery code is still valid
                },
            },
            select: {
                id: true,
                email: true,
                recoveryCode: true,
                recoveryCodeExpiresIn: true,
                verified: true,
            },
        });
        if (user) {
            if (user.recoveryCode !== recoveryCode) {
                console.warn(`[resetPassword] LOGIC ALERT: Mismatch detected! DB recovery code "${user.recoveryCode}" vs Request recovery code "${recoveryCode}". This indicates an issue with the Prisma query or data consistency.`);
            }
            if (user.recoveryCodeExpiresIn &&
                user.recoveryCodeExpiresIn < currentTime) {
                console.warn(`[resetPassword] LOGIC ALERT: DB recovery code expired (${user.recoveryCodeExpiresIn.toISOString()}) but user was found. This indicates an issue with the Prisma query's date comparison.`);
            }
        }
        else {
            console.log(`[resetPassword] No user found with provided recovery code and valid expiry.`);
        }
        if (!user) {
            return (0, apiResponse_1.sendError)(res, "Invalid or expired recovery code.", 400);
        }
        // Hash the new password
        const hashedPassword = yield bcryptjs_1.default.hash(newPassword, 10);
        // Update the user's password and clear recovery details
        const updatedUser = yield prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                recoveryCode: null, // Clear the recovery code after use
                recoveryCodeExpiresIn: null, // Clear the expiry after use
                verified: true, // Optionally set to true if not already, as password reset implies verification
                loginAttempts: 0,
                loginLockedUntil: null,
            },
            select: {
                // Select only necessary fields for logging, avoid sensitive data
                id: true,
                email: true,
                verified: true,
            },
        });
        return (0, apiResponse_1.sendSuccess)(res, "Password has been reset successfully.");
    }
    catch (error) {
        console.error(`[resetPassword] Internal server error during password reset:`, error);
        return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
    }
});
exports.resetPassword = resetPassword;
const createNewPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { password } = req.body;
        const user = yield prisma_1.prisma.user.findUnique({ where: { id } });
        if (!user) {
            return (0, apiResponse_1.sendError)(res, "Account not found", 404);
        }
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        const newUser = yield prisma_1.prisma.user.update({
            where: { id },
            data: {
                password: hashedPassword,
            },
        });
        const { password: _ } = newUser, hidePassword = __rest(newUser, ["password"]);
        return (0, apiResponse_1.sendSuccess)(res, "Password updated successfully", hidePassword);
    }
    catch (error) {
        return (0, apiResponse_1.sendError)(res, "Error occurred while creating new password", 500, error);
    }
});
exports.createNewPassword = createNewPassword;
const getSingleUserAccount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const user = yield prisma_1.prisma.user.findUnique({
            where: { id },
            include: {
                cart: {
                    orderBy: {
                        createdAt: "desc",
                    },
                },
                bookings: {
                    orderBy: {
                        createdAt: "desc",
                    },
                },
            },
        });
        if (!user) {
            return (0, apiResponse_1.sendError)(res, "Account does not exist", 404);
        }
        const { password: _ } = user, hidePassword = __rest(user, ["password"]);
        return (0, apiResponse_1.sendSuccess)(res, "Details gotten successfully", hidePassword);
    }
    catch (error) {
        return (0, apiResponse_1.sendError)(res, "Error occurred while getting user details", 500, error);
    }
});
exports.getSingleUserAccount = getSingleUserAccount;
const getAllAccounts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const users = yield prisma_1.prisma.user.findMany({
            include: { cart: true, bookings: true },
        });
        return (0, apiResponse_1.sendSuccess)(res, `${users === null || users === void 0 ? void 0 : users.length} Account(s) gotten successfully`, users);
    }
    catch (error) {
        return (0, apiResponse_1.sendError)(res, "Error occurred while getting all accounts", 500, error);
    }
});
exports.getAllAccounts = getAllAccounts;
const updateuserAccountDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { firstName, nationality, lastName, dob, passportNo, passportExpiry, gender, phone, } = req.body;
        const user = yield prisma_1.prisma.user.findUnique({ where: { id } });
        if (!user) {
            return (0, apiResponse_1.sendError)(res, "Account does not exist", 404);
        }
        if (user) {
            const newUser = yield prisma_1.prisma.user.update({
                where: { id },
                data: {
                    firstName,
                    nationality,
                    lastName,
                    dob,
                    passportNo,
                    passportExpiry,
                    gender,
                    phone,
                },
            });
            const { password: _ } = newUser, hidePassword = __rest(newUser, ["password"]);
            return (0, apiResponse_1.sendSuccess)(res, "Account updated successfully", hidePassword);
        }
    }
    catch (error) {
        return (0, apiResponse_1.sendError)(res, "Error occurred while updating account", 500, error);
    }
});
exports.updateuserAccountDetails = updateuserAccountDetails;
// export const createTraveler = async (
//   req: Request,
//   res: Response
// ): Promise<Response | any> => {
//   try {
//     const {
//       flightOfferId,
//       firstName,
//       lastName,
//       dateOfBirth,
//       gender,
//       email,
//       phone,
//       countryCode,
//       birthPlace,
//       passportNumber,
//       passportExpiry,
//       issuanceCountry,
//       validityCountry,
//       nationality,
//       issuanceDate,
//       issuanceLocation,
//     } = req.body;
//     // Validate flight offer exists if provided
//     if (flightOfferId) {
//       const exists = await prisma.flightOffer.findUnique({
//         where: { id: flightOfferId },
//       });
//       if (!exists) {
//         return res.status(400).json({ message: "Invalid flightOfferId" });
//       }
//     }
//     const newTraveler = await prisma.traveler.create({
//       data: {
//         flightOfferId,
//         firstName,
//         lastName,
//         dateOfBirth: new Date(dateOfBirth),
//         gender,
//         email,
//         phone,
//         countryCode,
//         birthPlace,
//         passportNumber,
//         passportExpiry: passportExpiry ? new Date(passportExpiry) : null,
//         issuanceCountry,
//         validityCountry,
//         nationality,
//         issuanceDate: issuanceDate ? new Date(issuanceDate) : null,
//         issuanceLocation,
//       },
//     });
//     return res.status(201).json({
//       message: "Traveler created successfully",
//       traveler: newTraveler,
//     });
//   } catch (error: any) {
//     console.error("Error creating traveler:", error);
//     return res
//       .status(500)
//       .json({ message: "Server error", error: error.message });
//   }
// };
// Create traveler endpoint
const createTraveler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { flightOfferId, firstName, lastName, dateOfBirth, gender, email, phone, countryCode, birthPlace, passportNumber, passportExpiry, issuanceCountry, validityCountry, nationality, issuanceDate, issuanceLocation, } = req.body;
        // Validate flight offer exists if provided
        if (flightOfferId) {
            const exists = yield prisma_1.prisma.flightOffer.findUnique({
                where: { id: flightOfferId },
            });
            if (!exists) {
                return (0, apiResponse_1.sendError)(res, "Invalid flightOfferId", 400);
            }
        }
        const newTraveler = yield prisma_1.prisma.traveler.create({
            data: {
                flightOfferId,
                firstName,
                lastName,
                dateOfBirth: new Date(dateOfBirth),
                gender,
                email,
                phone,
                countryCode,
                birthPlace,
                passportNumber,
                passportExpiry: passportExpiry ? new Date(passportExpiry) : null,
                issuanceCountry,
                validityCountry,
                nationality,
                issuanceDate: issuanceDate ? new Date(issuanceDate) : null,
                issuanceLocation,
            },
        });
        return (0, apiResponse_1.sendSuccess)(res, "Traveler created successfully", newTraveler, 201);
    }
    catch (error) {
        console.error("Error creating traveler:", error);
        return (0, apiResponse_1.sendError)(res, "Server error", 500, error);
    }
});
exports.createTraveler = createTraveler;
// Endpoint to get all travelers formatted for Amadeus booking
const getTravelersForAmadeusBooking = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { flightOfferId } = req.query;
        if (!flightOfferId || typeof flightOfferId !== "string") {
            return (0, apiResponse_1.sendError)(res, "flightOfferId query parameter is required", 400);
        }
        const travelers = yield prisma_1.prisma.traveler.findMany({
            where: { flightOfferId },
            orderBy: { createdAt: "asc" },
        });
        const amadeusTravelers = travelers.map((traveler, index) => (0, amadeusHelper_1.mapTravelerToAmadeusFormat)(traveler, traveler.id || index + 1));
        return (0, apiResponse_1.sendSuccess)(res, "Travelers formatted for Amadeus booking retrieved successfully", amadeusTravelers);
    }
    catch (error) {
        console.error("Error fetching travelers for Amadeus booking:", error);
        return (0, apiResponse_1.sendError)(res, "Server error", 500, error);
    }
});
exports.getTravelersForAmadeusBooking = getTravelersForAmadeusBooking;
// Endpoint to get one traveler formatted for Amadeus booking
const getTravelerForAmadeusBooking = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!id) {
            return (0, apiResponse_1.sendError)(res, "Traveler ID is required", 400);
        }
        const traveler = yield prisma_1.prisma.traveler.findUnique({
            where: { id },
        });
        if (!traveler) {
            return (0, apiResponse_1.sendError)(res, "Traveler not found", 404);
        }
        const amadeusTraveler = (0, amadeusHelper_1.mapTravelerToAmadeusFormat)(traveler, traveler.id); // ID can be "1" or traveler.id as string
        console.log("Raw traveler from DB:", traveler);
        console.log("Mapped Amadeus traveler:", amadeusTraveler);
        return (0, apiResponse_1.sendSuccess)(res, "Traveler formatted for Amadeus booking retrieved successfully", amadeusTraveler);
    }
    catch (error) {
        console.error("Error fetching traveler for Amadeus booking:", error);
        return (0, apiResponse_1.sendError)(res, "Server error", 500, error);
    }
});
exports.getTravelerForAmadeusBooking = getTravelerForAmadeusBooking;
// Get all travelers
const getAllTravelers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const travelers = yield prisma_1.prisma.traveler.findMany({
            orderBy: { createdAt: "desc" },
        });
        return (0, apiResponse_1.sendSuccess)(res, "Travelers retrieved successfully", travelers);
    }
    catch (error) {
        console.error("Error fetching travelers:", error);
        return (0, apiResponse_1.sendError)(res, "Server error", 500, error);
    }
});
exports.getAllTravelers = getAllTravelers;
// Get traveler by ID
const getTravelerById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!id) {
            return (0, apiResponse_1.sendError)(res, "Traveler ID is required", 400);
        }
        const traveler = yield prisma_1.prisma.traveler.findUnique({
            where: { id },
        });
        if (!traveler) {
            return (0, apiResponse_1.sendError)(res, "Traveler not found", 404);
        }
        return (0, apiResponse_1.sendSuccess)(res, "Traveler retrieved successfully", traveler);
    }
    catch (error) {
        console.error("Error fetching traveler:", error);
        return (0, apiResponse_1.sendError)(res, "Server error", 500, error);
    }
});
exports.getTravelerById = getTravelerById;
const updateTravelerDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { flightOfferId, firstName, lastName, dateOfBirth, gender, email, phone, countryCode, birthPlace, passportNumber, passportExpiry, issuanceCountry, validityCountry, nationality, issuanceDate, issuanceLocation, } = req.body;
        if (!id) {
            return (0, apiResponse_1.sendError)(res, "Traveler ID is required", 400);
        }
        // Verify traveler exists
        const existingTraveler = yield prisma_1.prisma.traveler.findUnique({
            where: { id },
        });
        if (!existingTraveler) {
            return (0, apiResponse_1.sendError)(res, "Traveler not found", 404);
        }
        // Validate flight offer exists if provided
        if (flightOfferId) {
            const exists = yield prisma_1.prisma.flightOffer.findUnique({
                where: { id: flightOfferId },
            });
            if (!exists) {
                return (0, apiResponse_1.sendError)(res, "Invalid flightOfferId", 400);
            }
        }
        const updatedTraveler = yield prisma_1.prisma.traveler.update({
            where: { id },
            data: {
                flightOfferId: flightOfferId || existingTraveler.flightOfferId,
                firstName: firstName || existingTraveler.firstName,
                lastName: lastName || existingTraveler.lastName,
                dateOfBirth: dateOfBirth
                    ? new Date(dateOfBirth)
                    : existingTraveler.dateOfBirth,
                gender: gender || existingTraveler.gender,
                email: email || existingTraveler.email,
                phone: phone || existingTraveler.phone,
                countryCode: countryCode || existingTraveler.countryCode,
                birthPlace: birthPlace || existingTraveler.birthPlace,
                passportNumber: passportNumber || existingTraveler.passportNumber,
                passportExpiry: passportExpiry
                    ? new Date(passportExpiry)
                    : existingTraveler.passportExpiry,
                issuanceCountry: issuanceCountry || existingTraveler.issuanceCountry,
                validityCountry: validityCountry || existingTraveler.validityCountry,
                nationality: nationality || existingTraveler.nationality,
                issuanceDate: issuanceDate
                    ? new Date(issuanceDate)
                    : existingTraveler.issuanceDate,
                issuanceLocation: issuanceLocation || existingTraveler.issuanceLocation,
            },
        });
        return (0, apiResponse_1.sendSuccess)(res, "Traveler updated successfully", updatedTraveler);
    }
    catch (error) {
        console.error("Error updating traveler:", error);
        return (0, apiResponse_1.sendError)(res, "Server error", 500, error);
    }
});
exports.updateTravelerDetails = updateTravelerDetails;
// POST /api/guest-user
function createGuestUser(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { email, firstName, lastName, phone, address, postalCode, city, country, } = req.body;
        if (!email || !firstName || !lastName) {
            return (0, apiResponse_1.sendError)(res, "Missing required guest fields", 400);
        }
        try {
            // Check if guest already exists
            let guest = yield prisma_1.prisma.guestUser.findUnique({ where: { email } });
            if (!guest) {
                guest = yield prisma_1.prisma.guestUser.create({
                    data: {
                        email,
                        firstName,
                        lastName,
                        phone,
                        address,
                        postalCode,
                        city,
                        country,
                    },
                });
            }
            return (0, apiResponse_1.sendSuccess)(res, "Guest user created/found successfully", guest, 201);
        }
        catch (error) {
            console.error("Error creating guest user:", error);
            return (0, apiResponse_1.sendError)(res, "Server error", 500, error);
        }
    });
}
// GET /api/guest-users
function getAllGuestUsers(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const guests = yield prisma_1.prisma.guestUser.findMany();
            return (0, apiResponse_1.sendSuccess)(res, "Guest users fetched successfully", guests);
        }
        catch (error) {
            console.error("Error fetching guest users:", error);
            return (0, apiResponse_1.sendError)(res, "Server error", 500, error);
        }
    });
}
// GET /api/guest-users/:id
function getGuestUserById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        try {
            const guest = yield prisma_1.prisma.guestUser.findUnique({ where: { id } });
            if (!guest) {
                return (0, apiResponse_1.sendError)(res, "Guest user not found", 404);
            }
            return (0, apiResponse_1.sendSuccess)(res, "Guest user fetched successfully", guest);
        }
        catch (error) {
            console.error("Error fetching guest user:", error);
            return (0, apiResponse_1.sendError)(res, "Server error", 500, error);
        }
    });
}
const logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { refreshToken } = req.cookies;
        if (refreshToken) {
            yield prisma_1.prisma.user.updateMany({
                where: { refreshToken },
                data: { refreshToken: null },
            });
        }
        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");
        return (0, apiResponse_1.sendSuccess)(res, "Logged out successfully");
    }
    catch (error) {
        return (0, apiResponse_1.sendError)(res, "Logout failed", 500, error);
    }
});
exports.logout = logout;
const refreshTokens = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
        if (!refreshToken) {
            return (0, apiResponse_1.sendError)(res, "Refresh token missing", 401);
        }
        const decoded = jsonwebtoken_1.default.verify(refreshToken, (process.env.JWT_REFRESH_SECRET || process.env.JWT));
        const user = yield prisma_1.prisma.user.findUnique({
            where: { id: decoded.id },
        });
        if (!user || user.refreshToken !== refreshToken) {
            return (0, apiResponse_1.sendError)(res, "Invalid or rotated refresh token", 403);
        }
        const tokens = (0, authUtils_1.generateTokens)(user);
        yield prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                refreshToken: tokens.refreshToken,
                lastActiveAt: new Date(),
            },
        });
        (0, authUtils_1.setTokenCookies)(res, tokens.accessToken, tokens.refreshToken);
        const { password: _, refreshToken: __ } = user, hideSensitive = __rest(user, ["password", "refreshToken"]);
        return (0, apiResponse_1.sendSuccess)(res, "Tokens refreshed successfully", {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: hideSensitive
        });
    }
    catch (error) {
        console.error("Refresh token error:", error);
        return (0, apiResponse_1.sendError)(res, "Expired or invalid refresh token", 403, error);
    }
});
exports.refreshTokens = refreshTokens;
