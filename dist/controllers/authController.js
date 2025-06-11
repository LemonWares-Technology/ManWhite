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
exports.updateTravelerDetails = exports.getTravelerById = exports.getAllTravelers = exports.getTravelerForAmadeusBooking = exports.getTravelersForAmadeusBooking = exports.createTraveler = exports.updateuserAccountDetails = exports.getAllAccounts = exports.getSingleUserAccount = exports.createNewPassword = exports.resetPassword = exports.checkPassword = exports.loginAccount = exports.createPassword = exports.createAccount = void 0;
exports.createGuestUser = createGuestUser;
exports.getAllGuestUsers = getAllGuestUsers;
exports.getGuestUserById = getGuestUserById;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const emailServices_1 = require("../config/emailServices");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const date_fns_1 = require("date-fns");
const amadeusHelper_1 = require("../utils/amadeusHelper");
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
        // await sendVerification(newUser);
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
// export const checkPassword = async (
//   req: Request,
//   res: Response
// ): Promise<any> => {
//   try {
//     const { email } = req.params;
//     const { password } = req.body;
//     const user = await prisma.user.findUnique({ where: { email } });
//     if (!user) {
//       return res.status(404).json({
//         message: `Account does not exist`,
//       });
//     }
//     if (user) {
//       const check = await bcryptjs.compare(password, user?.password || "");
//       if (check) {
//         // Generate JWT token
//         const token = jwt.sign(
//           { id: user.id, email: user.email },
//           process.env.JWT as string,
//           { expiresIn: "24h" }
//         );
//         return res.status(200).json({
//           message: `Logged in successfully`,
//           data: {
//             ...user,
//             token,
//           },
//         });
//       } else {
//         return res.status(400).json({
//           message: `Incorrect password`,
//         });
//       }
//     }
//   } catch (error: any) {
//     return res.status(500).json({
//       message: `Error occured validating password`,
//       data: error?.message,
//     });
//   }
// };
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
        const MAX_ATTEMPTS = 5;
        const LOCK_DURATION_MINUTES = 5;
        // Check if account is locked
        if (user.loginLockedUntil && (0, date_fns_1.isBefore)(new Date(), user.loginLockedUntil)) {
            const minutesLeft = Math.ceil((user.loginLockedUntil.getTime() - Date.now()) / 60000);
            return res.status(403).json({
                message: `Account is locked. Try again in ${minutesLeft} minute(s).`,
            });
        }
        const isPasswordCorrect = yield bcryptjs_1.default.compare(password, user.password || "");
        if (isPasswordCorrect) {
            // Reset loginAttempts and lock time on success
            yield prisma.user.update({
                where: { email },
                data: {
                    loginAttempts: 0,
                    loginLockedUntil: null,
                },
            });
            const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, process.env.JWT, { expiresIn: "24h" });
            return res.status(200).json({
                message: `Logged in successfully`,
                data: Object.assign(Object.assign({}, user), { token }),
            });
        }
        else {
            const updatedUser = yield prisma.user.update({
                where: { email },
                data: {
                    loginAttempts: {
                        increment: 1,
                    },
                },
            });
            if (updatedUser.loginAttempts >= MAX_ATTEMPTS) {
                const lockUntil = (0, date_fns_1.addMinutes)(new Date(), LOCK_DURATION_MINUTES);
                yield prisma.user.update({
                    where: { email },
                    data: {
                        loginLockedUntil: lockUntil,
                    },
                });
                return res.status(403).json({
                    message: `Account locked due to too many failed attempts. Try again in ${LOCK_DURATION_MINUTES} minutes.`,
                });
            }
            const remaining = MAX_ATTEMPTS - updatedUser.loginAttempts;
            return res.status(400).json({
                message: `Incorrect password. ${remaining} attempt(s) remaining.`,
            });
        }
    }
    catch (error) {
        return res.status(500).json({
            message: `Error occurred validating password`,
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
            const exists = yield prisma.flightOffer.findUnique({
                where: { id: flightOfferId },
            });
            if (!exists) {
                return res.status(400).json({ message: "Invalid flightOfferId" });
            }
        }
        const newTraveler = yield prisma.traveler.create({
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
        return res.status(201).json({
            message: "Traveler created successfully",
            traveler: newTraveler,
        });
    }
    catch (error) {
        console.error("Error creating traveler:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message,
        });
    }
});
exports.createTraveler = createTraveler;
// Endpoint to get all travelers formatted for Amadeus booking
const getTravelersForAmadeusBooking = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { flightOfferId } = req.query;
        if (!flightOfferId || typeof flightOfferId !== "string") {
            return res.status(400).json({ message: "flightOfferId query parameter is required" });
        }
        const travelers = yield prisma.traveler.findMany({
            where: { flightOfferId },
            orderBy: { createdAt: "asc" },
        });
        const amadeusTravelers = travelers.map((traveler, index) => (0, amadeusHelper_1.mapTravelerToAmadeusFormat)(traveler, traveler.id || index + 1));
        return res.status(200).json({
            message: "Travelers formatted for Amadeus booking retrieved successfully",
            travelers: amadeusTravelers,
        });
    }
    catch (error) {
        console.error("Error fetching travelers for Amadeus booking:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message,
        });
    }
});
exports.getTravelersForAmadeusBooking = getTravelersForAmadeusBooking;
// Endpoint to get one traveler formatted for Amadeus booking
const getTravelerForAmadeusBooking = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: "Traveler ID is required" });
        }
        const traveler = yield prisma.traveler.findUnique({
            where: { id },
        });
        if (!traveler) {
            return res.status(404).json({ message: "Traveler not found" });
        }
        const amadeusTraveler = (0, amadeusHelper_1.mapTravelerToAmadeusFormat)(traveler, traveler.id);
        ; // ID can be "1" or traveler.id as string
        console.log("Raw traveler from DB:", traveler);
        console.log("Mapped Amadeus traveler:", amadeusTraveler);
        return res.status(200).json({
            message: "Traveler formatted for Amadeus booking retrieved successfully",
            traveler: amadeusTraveler,
        });
    }
    catch (error) {
        console.error("Error fetching traveler for Amadeus booking:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message,
        });
    }
});
exports.getTravelerForAmadeusBooking = getTravelerForAmadeusBooking;
// Get all travelers
const getAllTravelers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const travelers = yield prisma.traveler.findMany({
            orderBy: { createdAt: "desc" },
        });
        return res.status(200).json({
            message: "Travelers retrieved successfully",
            data: travelers,
        });
    }
    catch (error) {
        console.error("Error fetching travelers:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message,
        });
    }
});
exports.getAllTravelers = getAllTravelers;
// Get traveler by ID
const getTravelerById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: "Traveler ID is required" });
        }
        const traveler = yield prisma.traveler.findUnique({
            where: { id },
        });
        if (!traveler) {
            return res.status(404).json({ message: "Traveler not found" });
        }
        return res.status(200).json({
            message: "Traveler retrieved successfully",
            data: traveler,
        });
    }
    catch (error) {
        console.error("Error fetching traveler:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message,
        });
    }
});
exports.getTravelerById = getTravelerById;
const updateTravelerDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { flightOfferId, firstName, lastName, dateOfBirth, gender, email, phone, countryCode, birthPlace, passportNumber, passportExpiry, issuanceCountry, validityCountry, nationality, issuanceDate, issuanceLocation, } = req.body;
        if (!id) {
            return res.status(400).json({ message: "Traveler ID is required" });
        }
        // Verify traveler exists
        const existingTraveler = yield prisma.traveler.findUnique({
            where: { id },
        });
        if (!existingTraveler) {
            return res.status(404).json({ message: "Traveler not found" });
        }
        // Validate flight offer exists if provided
        if (flightOfferId) {
            const exists = yield prisma.flightOffer.findUnique({
                where: { id: flightOfferId },
            });
            if (!exists) {
                return res.status(400).json({ message: "Invalid flightOfferId" });
            }
        }
        const updatedTraveler = yield prisma.traveler.update({
            where: { id },
            data: {
                flightOfferId: flightOfferId || existingTraveler.flightOfferId,
                firstName: firstName || existingTraveler.firstName,
                lastName: lastName || existingTraveler.lastName,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : existingTraveler.dateOfBirth,
                gender: gender || existingTraveler.gender,
                email: email || existingTraveler.email,
                phone: phone || existingTraveler.phone,
                countryCode: countryCode || existingTraveler.countryCode,
                birthPlace: birthPlace || existingTraveler.birthPlace,
                passportNumber: passportNumber || existingTraveler.passportNumber,
                passportExpiry: passportExpiry ? new Date(passportExpiry) : existingTraveler.passportExpiry,
                issuanceCountry: issuanceCountry || existingTraveler.issuanceCountry,
                validityCountry: validityCountry || existingTraveler.validityCountry,
                nationality: nationality || existingTraveler.nationality,
                issuanceDate: issuanceDate ? new Date(issuanceDate) : existingTraveler.issuanceDate,
                issuanceLocation: issuanceLocation || existingTraveler.issuanceLocation,
            },
        });
        return res.status(200).json({
            message: "Traveler updated successfully",
            traveler: updatedTraveler,
        });
    }
    catch (error) {
        console.error("Error updating traveler:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message,
        });
    }
});
exports.updateTravelerDetails = updateTravelerDetails;
// POST /api/guest-user
function createGuestUser(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { email, firstName, lastName, phone, address, postalCode, city, country } = req.body;
        if (!email || !firstName || !lastName) {
            return res.status(400).json({ error: "Missing required guest fields" });
        }
        try {
            // Check if guest already exists
            let guest = yield prisma.guestUser.findUnique({ where: { email } });
            if (!guest) {
                guest = yield prisma.guestUser.create({
                    data: { email, firstName, lastName, phone, address, postalCode, city, country }
                });
            }
            return res.status(201).json({ guestUserId: guest.id, guest });
        }
        catch (error) {
            console.error("Error creating guest user:", error);
            return res.status(500).json({ error: "Server error" });
        }
    });
}
// GET /api/guest-users
function getAllGuestUsers(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const guests = yield prisma.guestUser.findMany();
            return res.status(200).json({ guests });
        }
        catch (error) {
            console.error("Error fetching guest users:", error);
            return res.status(500).json({ error: "Server error" });
        }
    });
}
// GET /api/guest-users/:id
function getGuestUserById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        try {
            const guest = yield prisma.guestUser.findUnique({ where: { id } });
            if (!guest) {
                return res.status(404).json({ error: "Guest user not found" });
            }
            return res.status(200).json({ guest });
        }
        catch (error) {
            console.error("Error fetching guest user:", error);
            return res.status(500).json({ error: "Server error" });
        }
    });
}
