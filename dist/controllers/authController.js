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
exports.createTraveler = exports.updateuserAccountDetails = exports.getAllAccounts = exports.getSingleUserAccount = exports.createNewPassword = exports.resetPassword = exports.checkPassword = exports.loginAccount = exports.createPassword = exports.createAccount = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const emailServices_1 = require("../config/emailServices");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma = new client_1.PrismaClient();
const createAccount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const generateAuthenticationCode = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
    };
    try {
        const { email } = req.body;
        const user = yield prisma.user.findUnique({
            where: { email: email },
        });
        if (user) {
            return res.status(400).json({
                message: `Account with email address already exists`,
            });
        }
        const verificationCodeExpiresIn = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const newUser = yield prisma.user.create({
            data: {
                email: email,
                verificationCode: generateAuthenticationCode(),
                verificationCodeExpiresIn,
                verified: true,
            },
        });
        yield (0, emailServices_1.sendVerification)(newUser);
        const { password: _ } = newUser, hidePassword = __rest(newUser, ["password"]);
        return res.status(201).json({
            message: `Account created successfully`,
            data: hidePassword,
        });
    }
    catch (error) {
        return res.status(500).json({
            message: `Error occured during account creation: ${error === null || error === void 0 ? void 0 : error.message}`,
            data: error,
        });
    }
});
exports.createAccount = createAccount;
const createPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { firstName, lastName, password } = req.body;
        const user = yield prisma.user.findUnique({ where: { id } });
        if (!user) {
            return res.status(404).json({
                message: `Account does not exist`,
            });
        }
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        const newUser = yield prisma.user.update({
            where: { id },
            data: {
                firstName,
                lastName,
                password: hashedPassword,
            },
        });
        const { password: _ } = newUser, hidePassword = __rest(newUser, ["password"]);
        return res.status(200).json({
            message: `Password created successfully`,
            data: hidePassword,
        });
    }
    catch (error) {
        return res.status(500).json({
            message: `Error occured while creating password`,
            data: error === null || error === void 0 ? void 0 : error.message,
        });
    }
});
exports.createPassword = createPassword;
const loginAccount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        const user = yield prisma.user.findUnique({
            where: { email },
        });
        if (!user) {
            return res.status(404).json({
                message: `Account does not exist`,
            });
        }
        // await sendLoginEmail(user)
        return res.status(200).json({
            message: `Almost there...`,
            data: user,
        });
    }
    catch (error) {
        return res.status(500).json({
            message: `Error occured during login`,
            data: error === null || error === void 0 ? void 0 : error.message,
        });
    }
});
exports.loginAccount = loginAccount;
const checkPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.params;
        const { password } = req.body;
        const user = yield prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({
                message: `Account does not exist`,
            });
        }
        if (user) {
            const check = yield bcryptjs_1.default.compare(password, (user === null || user === void 0 ? void 0 : user.password) || "");
            if (check) {
                // Generate JWT token
                const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, process.env.JWT, { expiresIn: "24h" });
                return res.status(200).json({
                    message: `Logged in successfully`,
                    data: Object.assign(Object.assign({}, user), { token }),
                });
            }
            else {
                return res.status(400).json({
                    message: `Incorrect password`,
                });
            }
        }
    }
    catch (error) {
        return res.status(500).json({
            message: `Error occured validating password`,
            data: error === null || error === void 0 ? void 0 : error.message,
        });
    }
});
exports.checkPassword = checkPassword;
const resetPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        const user = yield prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({
                message: `Account does not exist`,
            });
        }
        yield (0, emailServices_1.sendResetPassword)(user);
        return res.status(200).json({
            message: `Resetting password...`,
            data: user,
        });
    }
    catch (error) {
        return res.status(500).json({
            message: `Error occured while resetting password`,
            data: error === null || error === void 0 ? void 0 : error.message,
        });
    }
});
exports.resetPassword = resetPassword;
const createNewPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { password } = req.body;
        const user = yield prisma.user.findUnique({ where: { id } });
        if (!user) {
            return res.status(404).json({
                message: `Account not found`,
            });
        }
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        const newUser = yield prisma.user.update({
            where: { id },
            data: {
                password: hashedPassword,
            },
        });
        const { password: _ } = newUser, hidePassword = __rest(newUser, ["password"]);
        return res.status(200).json({
            message: `Password updated successfully`,
            data: hidePassword,
        });
    }
    catch (error) {
        return res.status(500).json({
            message: `Error occured while creating new password`,
            data: error === null || error === void 0 ? void 0 : error.message,
        });
    }
});
exports.createNewPassword = createNewPassword;
const getSingleUserAccount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { id } = req.params;
        const user = yield prisma.user.findUnique({
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
            return res.status(400).json({
                message: `Account does not exist`,
            });
        }
        const { password: _ } = user, hidePassword = __rest(user, ["password"]);
        return res.status(200).json({
            message: `Details gotten successfully`,
            data: hidePassword,
        });
    }
    catch (error) {
        throw new Error((_b = (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message);
    }
});
exports.getSingleUserAccount = getSingleUserAccount;
const getAllAccounts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const users = yield prisma.user.findMany({
            include: { cart: true, bookings: true },
        });
        return res.status(200).json({
            message: `${users === null || users === void 0 ? void 0 : users.length} Accounts(s) gotten successfully`,
            data: users,
        });
    }
    catch (error) {
        return res.status(500).json({
            message: `Error occured while getting all accounts`,
            data: error === null || error === void 0 ? void 0 : error.message,
        });
    }
});
exports.getAllAccounts = getAllAccounts;
const updateuserAccountDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { firstName, nationality, lastName, dob, passportNo, passportExpiry, gender, phone, } = req.body;
        const user = yield prisma.user.findUnique({ where: { id } });
        if (!user) {
            return res.status(404).json({
                message: `Account does not exist`,
            });
        }
        if (user) {
            const newUser = yield prisma.user.update({
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
            return res.status(200).json({
                message: `Account updated successfully`,
                data: hidePassword,
            });
        }
    }
    catch (error) {
        return res.status(500).json({
            message: `Error occured while updating account`,
            data: error === null || error === void 0 ? void 0 : error.message,
        });
    }
});
exports.updateuserAccountDetails = updateuserAccountDetails;
const createTraveler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { bookingId, firstName, lastName, dateOfBirth, gender, email, phone, countryCode, birthPlace, passportNumber, passportExpiry, issuanceCountry, validityCountry, nationality, issuanceDate, issuanceLocation, } = req.body;
        // // Validate required fields
        // if (
        //   !bookingId ||
        //   !firstName ||
        //   !lastName ||
        //   !dateOfBirth ||
        //   !gender ||
        //   !email ||
        //   !phone
        // ) {
        //   return res.status(400).json({ message: "Missing required traveler details" });
        // }
        const newTraveler = yield prisma.traveler.create({
            data: {
                bookingId,
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
        return res.status(201).json({
            message: "Traveler created successfully",
            traveler: newTraveler,
        });
    }
    catch (error) {
        console.error("Error creating traveler:", error);
        return res.status(500).json({
            message: "Error creating traveler",
            error: error.message,
        });
    }
});
exports.createTraveler = createTraveler;
