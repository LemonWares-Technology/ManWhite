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
exports.removeAddonsFromFlightOffer = exports.addExistingAddonsToFlightOffer = exports.deleteFlightAddon = exports.updateFlightAddon = exports.getAllFlightAddons = exports.createFlightAddon = void 0;
exports.createAdminAccount = createAdminAccount;
exports.adminLogin = adminLogin;
exports.createAgent = createAgent;
exports.createUserByAdmin = createUserByAdmin;
exports.updateUserByAdmin = updateUserByAdmin;
exports.deleteUserByAdmin = deleteUserByAdmin;
exports.verifyAgent = verifyAgent;
exports.agentSetupProfile = agentSetupProfile;
exports.loginAgent = loginAgent;
exports.getAgentAccountById = getAgentAccountById;
exports.getAllAgentAccounts = getAllAgentAccounts;
exports.deleteAgentAccount = deleteAgentAccount;
exports.getAllBookings = getAllBookings;
exports.getBookingAnalytics = getBookingAnalytics;
exports.createExclusion = createExclusion;
exports.readExclusion = readExclusion;
exports.updateExclusion = updateExclusion;
exports.deleteExclusion = deleteExclusion;
exports.sendEmailBookingProcess = sendEmailBookingProcess;
exports.getUserRole = getUserRole;
const client_1 = require("@prisma/client");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const emailServices_1 = require("../config/emailServices");
const brevo_1 = require("@getbrevo/brevo");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ADMIN_SECRET = process.env.JWT || "code";
const prisma = new client_1.PrismaClient();
function createAdminAccount(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { email, firstName, lastName } = req.body;
        if (!email) {
            return res.status(400).json({
                error: `Email is required !`,
            });
        }
        try {
            const existingUser = yield prisma.user.findFirst({ where: { email } });
            if (existingUser) {
                return res.status(400).json({
                    error: `Admin with email ${email} already exists`,
                });
            }
            const adminToken = crypto_1.default.randomBytes(32).toString("hex");
            const adminUser = yield prisma.user.create({
                data: {
                    email,
                    firstName,
                    lastName,
                    role: "ADMIN",
                    adminToken,
                    verified: true,
                },
            });
            return res.status(201).json({
                message: `Admin created`,
                user: adminUser,
                token: adminToken,
            });
        }
        catch (error) {
            console.error(`Admin account creation error ${error}`);
            return res.status(500).json({
                message: `Internal server error`,
            });
        }
    });
}
function adminLogin(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { email, adminToken } = req.body;
        if (!email || !adminToken) {
            return res.status(400).json({
                message: `Email and adminToken are required!`,
            });
        }
        try {
            const admin = yield prisma.user.findUnique({ where: { email } });
            if (!admin || admin.role !== "ADMIN") {
                return res.status(401).json({
                    error: `Unauthorized: Not an admin`,
                });
            }
            if (admin.adminToken !== adminToken) {
                return res.status(401).json({
                    message: `Invalid admin token`,
                });
            }
            const token = jsonwebtoken_1.default.sign({
                userId: admin.id,
                role: admin.role,
            }, ADMIN_SECRET, { expiresIn: "4h" });
            return res.json({
                token,
                message: `Admin logged in successfully`,
                data: admin,
            });
        }
        catch (error) {
            console.error(`Admin login error ${error}`);
            return res.status(500).json({ error: `Internal server error` });
        }
    });
}
function createAgent(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { adminId } = req.params;
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Agent email is required" });
        }
        try {
            // Check if user with email already exists
            const existingUser = yield prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return res
                    .status(409)
                    .json({ error: "User with this email address already exists" });
            }
            // Check if requester is admin
            const adminUser = yield prisma.user.findUnique({ where: { id: adminId } });
            if (!adminUser || adminUser.role !== client_1.Role.ADMIN) {
                return res
                    .status(403)
                    .json({ error: "Unauthorized: Only admins can create agents" });
            }
            // Create new agent user
            const agent = yield prisma.user.create({
                data: {
                    email,
                    role: client_1.Role.AGENT,
                    verified: false,
                },
            });
            return res.status(201).json({
                message: "Agent created successfully",
                agentId: agent.id,
                email: agent.email,
            });
        }
        catch (error) {
            console.error("Agent creation error:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    });
}
function createUserByAdmin(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { adminId } = req.params;
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "User email is required" });
        }
        try {
            // Check if user with email already exists
            const existingUser = yield prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return res
                    .status(409)
                    .json({ error: "User with this email address already exists" });
            }
            // Check if requester is admin
            const adminUser = yield prisma.user.findUnique({ where: { id: adminId } });
            if (!adminUser || adminUser.role !== client_1.Role.ADMIN) {
                return res
                    .status(403)
                    .json({ error: "Unauthorized: Only admins can create users" });
            }
            // Create new  user
            const user = yield prisma.user.create({
                data: {
                    email,
                    role: client_1.Role.USER,
                    verified: true,
                },
            });
            return res.status(201).json({
                message: "User created successfully",
                userId: user.id,
                email: user.email,
            });
        }
        catch (error) {
            console.error("User creation error:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    });
}
function updateUserByAdmin(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { adminId, userId } = req.params;
        const { email, firstName, nationality, lastName, dob, passportNo, passportExpiry, gender, phone, } = req.body;
        try {
            // Check if admin exists and has admin role
            const adminUser = yield prisma.user.findUnique({ where: { id: adminId } });
            if (!adminUser || adminUser.role !== client_1.Role.ADMIN) {
                return res
                    .status(403)
                    .json({ error: "Unauthorized: Only admins can update users" });
            }
            // Check if target user exists
            const existingUser = yield prisma.user.findUnique({
                where: { id: userId },
            });
            if (!existingUser) {
                return res.status(404).json({ error: "User not found" });
            }
            const updatedUser = yield prisma.user.update({
                where: { id: userId },
                data: {
                    email: email !== null && email !== void 0 ? email : existingUser.email,
                    firstName: firstName !== null && firstName !== void 0 ? firstName : existingUser.firstName,
                    lastName: lastName !== null && lastName !== void 0 ? lastName : existingUser.lastName,
                    phone: phone !== null && phone !== void 0 ? phone : existingUser.phone,
                    nationality: nationality !== null && nationality !== void 0 ? nationality : existingUser.nationality,
                    gender: gender !== null && gender !== void 0 ? gender : existingUser.gender,
                    passportNo: passportNo !== null && passportNo !== void 0 ? passportNo : existingUser.passportNo,
                    dob: dob ? new Date(dob) : existingUser.dob,
                    passportExpiry: passportExpiry
                        ? new Date(passportExpiry)
                        : existingUser.passportExpiry,
                },
            });
            return res.status(200).json({
                message: "User updated successfully",
                user: updatedUser,
            });
        }
        catch (error) {
            console.error("User update error:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    });
}
function deleteUserByAdmin(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { adminId, userId } = req.params;
        try {
            // Check if admin exists and has admin role
            const adminUser = yield prisma.user.findUnique({ where: { id: adminId } });
            if (!adminUser || adminUser.role !== client_1.Role.ADMIN) {
                return res
                    .status(403)
                    .json({ error: "Unauthorized: Only admins can delete users" });
            }
            // Check if target user exists
            const existingUser = yield prisma.user.findUnique({
                where: { id: userId },
            });
            if (!existingUser) {
                return res.status(404).json({ error: "User not found" });
            }
            yield prisma.user.delete({ where: { id: userId } });
            return res.status(200).json({
                message: "User deleted successfully",
                userId,
            });
        }
        catch (error) {
            console.error("User deletion error:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    });
}
function verifyAgent(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { agentId } = req.params;
        try {
            const agent = yield prisma.user.findUnique({ where: { id: agentId } });
            if (!agent || agent.role !== "AGENT") {
                return res.status(404).json({ error: `Agent not found` });
            }
            if (agent.verified) {
                return res.status(400).json({ error: `Agent already verified` });
            }
            // Generate one-time-token for password setup
            const oneTimeToken = crypto_1.default.randomBytes(32).toString("hex");
            const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            const updatedAgent = yield prisma.user.update({
                where: { id: agentId },
                data: {
                    verified: true,
                    oneTimeAccessToken: oneTimeToken,
                    oneTimeAccessTokenExpires: tokenExpiry,
                },
            });
            yield (0, emailServices_1.sendToken)(updatedAgent);
            return res.status(200).json({
                message: `Agent verified, notification sent to agent's inbox`,
                token: oneTimeToken,
                expires: tokenExpiry,
            });
        }
        catch (error) {
            console.error(`Agent verification error: ${error}`);
            return res.status(500).json({
                error: `Internal server error`,
            });
        }
    });
}
function agentSetupProfile(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { token, firstName, lastName, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({
                error: `Token and password parameters are required`,
            });
        }
        try {
            const agent = yield prisma.user.findFirst({
                where: {
                    oneTimeAccessToken: token,
                    oneTimeAccessTokenExpires: {
                        gt: new Date(),
                    },
                    role: "AGENT",
                },
            });
            if (!agent) {
                return res.status(400).json({ error: `Invalid or expired token` });
            }
            const salt = yield bcryptjs_1.default.genSalt(10);
            const hashedPassword = yield bcryptjs_1.default.hash(password, salt);
            yield prisma.user.update({
                where: { id: agent.id },
                data: {
                    firstName,
                    lastName,
                    password: hashedPassword,
                    oneTimeAccessToken: null,
                    oneTimeAccessTokenExpires: null,
                    verified: true,
                },
            });
            return res.json({
                message: `Profile setup complete. Proceed to login`,
                agent,
            });
        }
        catch (error) {
            console.error(`Agent profile setup error ${error}`);
            return res.status(500).json({ error: `Internal server error` });
        }
    });
}
function loginAgent(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({
                    message: `Email and password are required`,
                });
            }
            const agent = yield prisma.user.findUnique({ where: { email } });
            if (!agent || agent.role !== "AGENT") {
                return res.status(401).json({
                    error: `Unauthorized: Not an agent`,
                });
            }
            const isPasswordValid = yield bcryptjs_1.default.compare(password, (agent === null || agent === void 0 ? void 0 : agent.password) || "");
            if (!isPasswordValid) {
                return res.status(400).json({
                    error: `Invalid password`,
                });
            }
            const token = jsonwebtoken_1.default.sign({ userId: agent.id, role: agent.role }, ADMIN_SECRET || "code", { expiresIn: "1h" });
            return res.status(200).json({
                message: `Login successful`,
                token,
                data: agent,
            });
        }
        catch (error) {
            console.error(`Error logging in agent`, error);
            return res.status(500).json({
                message: `Internal server error`,
            });
        }
    });
}
function getAgentAccountById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { agentId } = req.params;
        try {
            const agent = yield prisma.user.findMany({ where: { id: agentId } });
            if (!agent) {
                return res.status(404).json({ error: `Agent account not found` });
            }
            return res.status(200).json({
                message: `Details fetched successfully`,
                data: agent,
            });
        }
        catch (error) {
            console.error(`Error getting agent account by id ${error}`);
            return res.status(500).json({
                error: `Internal server error`,
            });
        }
    });
}
function getAllAgentAccounts(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const agents = yield prisma.user.findMany({ where: { role: "AGENT" } });
            if (!agents) {
                return res.status(404).json({ error: `No agent records found` });
            }
            return res.status(200).json({
                message: `All agent accounts fetched successfully`,
                data: agents,
            });
        }
        catch (error) {
            console.error(`Error getting all agent account:`, error);
            return res.status(500).json({
                error: `Internal server error`,
            });
        }
    });
}
function deleteAgentAccount(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { agentId } = req.params;
        try {
            const agent = yield prisma.user.findUnique({ where: { id: agentId } });
            if (!agent) {
                return res.status(404).json({ error: `Agent account not found` });
            }
            yield prisma.user.delete({ where: { id: agentId } });
            return res.status(200).json({
                message: `Agent account deleted successfully`,
            });
        }
        catch (error) {
            console.error(`Error deleting agent account:`, error);
            return res.status(500).json({
                error: `Internal server error`,
            });
        }
    });
}
function getAllBookings(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const bookings = yield prisma.booking.findMany({
                orderBy: {
                    createdAt: "desc",
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    guestUser: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    travelers: true, // Include all traveler fields
                    review: true, // Include review if exists
                    FlightAddon: true,
                },
            });
            return res.status(200).json({ bookings });
        }
        catch (error) {
            console.error("Error fetching bookings:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    });
}
function getBookingAnalytics(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Total bookings count
            const totalBookings = yield prisma.booking.count();
            // Bookings count by status
            const bookingsByStatus = yield prisma.booking.groupBy({
                by: ["status"],
                _count: {
                    status: true,
                },
            });
            // Bookings count by type
            const bookingsByType = yield prisma.booking.groupBy({
                by: ["type"],
                _count: {
                    type: true,
                },
            });
            // Total revenue (sum of totalAmount)
            const revenueResult = yield prisma.booking.aggregate({
                _sum: {
                    totalAmount: true,
                },
            });
            const totalRevenue = revenueResult._sum.totalAmount || 0;
            // Bookings count by currency
            const bookingsByCurrency = yield prisma.booking.groupBy({
                by: ["currency"],
                _count: {
                    currency: true,
                },
            });
            // Recent bookings count (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const recentBookingsCount = yield prisma.booking.count({
                where: {
                    createdAt: {
                        gte: thirtyDaysAgo,
                    },
                },
            });
            // Optional: Bookings count by user (top 5 users by bookings)
            const bookingsByUser = yield prisma.booking.groupBy({
                by: ["userId"],
                _count: {
                    userId: true,
                },
                orderBy: {
                    _count: {
                        userId: "desc",
                    },
                },
                take: 5,
                where: {
                    userId: {
                        not: null,
                    },
                },
            });
            // Optional: Bookings count by guest user (top 5 guest users)
            const bookingsByGuestUser = yield prisma.booking.groupBy({
                by: ["guestUserId"],
                _count: {
                    guestUserId: true,
                },
                orderBy: {
                    _count: {
                        guestUserId: "desc",
                    },
                },
                take: 5,
                where: {
                    guestUserId: {
                        not: null,
                    },
                },
            });
            return res.status(200).json({
                totalBookings,
                bookingsByStatus,
                bookingsByType,
                totalRevenue,
                bookingsByCurrency,
                recentBookingsCount,
                bookingsByUser,
                bookingsByGuestUser,
            });
        }
        catch (error) {
            console.error("Error fetching booking analytics:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    });
}
function createExclusion(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { airlineCode, reason } = req.body;
            const airline = yield prisma.excludedAirline.findUnique({
                where: { airlineCode: airlineCode },
            });
            if (airline) {
                return res.status(400).json({ error: " IataCode already exists" });
            }
            const newAirline = yield prisma.excludedAirline.create({
                data: {
                    airlineCode,
                    reason,
                },
            });
            return res.status(201).json(newAirline);
        }
        catch (error) {
            return res.status(500).json({ error: "Internal Server Error" });
        }
    });
}
function readExclusion(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const airlineExculsion = yield prisma.excludedAirline.findMany();
            return res.status(200).json(airlineExculsion);
        }
        catch (error) {
            console.error(`Error`, error);
            return res.status(500).json({
                error,
            });
        }
    });
}
function updateExclusion(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { iataCode } = req.params;
        const { airlineCode, reason } = req.body;
        try {
            if (!airlineCode) {
                return res.status(400).json({ error: `Iata field is required` });
            }
            const iata = yield prisma.excludedAirline.findUnique({
                where: { id: iataCode },
            });
            yield prisma.excludedAirline.update({
                where: { id: iataCode },
                data: {
                    airlineCode,
                    reason,
                },
            });
            return res.status(201).json({ message: `IATA Code successfully updated` });
        }
        catch (error) {
            console.error(`Response: `, error);
            return res.status(500).json({ error: `Internal server error` });
        }
    });
}
function deleteExclusion(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let { iataCode } = req.params;
            if (!iataCode || typeof iataCode !== "string") {
                return res.status(400).json({ error: "IATA Code parameter is required" });
            }
            // Normalize IATA code: trim and uppercase
            iataCode = iataCode.trim().toUpperCase();
            // Check if the IATA code exists
            const existing = yield prisma.excludedAirline.findUnique({
                where: { airlineCode: iataCode },
            });
            if (!existing) {
                return res
                    .status(404)
                    .json({ error: `IATA Code '${iataCode}' does not exist` });
            }
            // Delete the exclusion record
            yield prisma.excludedAirline.delete({
                where: { airlineCode: iataCode },
            });
            return res
                .status(200)
                .json({ message: `IATA Code '${iataCode}' deleted successfully` });
        }
        catch (error) {
            console.error("Error deleting IATA exclusion:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    });
}
// Create Addons
const createFlightAddon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, description, price } = req.body;
        const addon = yield prisma.flightAddon.create({
            data: {
                name,
                description,
                price,
                currency: "USD",
            },
        });
        res.status(201).json({ success: true, addon });
    }
    catch (error) {
        console.error("Create Addon Error:", error);
        res.status(500).json({ success: false, message: "Failed to create addon" });
    }
});
exports.createFlightAddon = createFlightAddon;
// Get all admin-defined addons
const getAllFlightAddons = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const addons = yield prisma.flightAddon.findMany({
            where: {
                bookingId: null,
            },
            orderBy: { createdAt: "desc" },
        });
        res.status(200).json({ success: true, addons });
    }
    catch (error) {
        console.error("Get Addons Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch addons" });
    }
});
exports.getAllFlightAddons = getAllFlightAddons;
// Update addon
const updateFlightAddon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { name, description, price, currency } = req.body;
    try {
        const addon = yield prisma.flightAddon.update({
            where: { id },
            data: { name, description, price, currency },
        });
        res.status(200).json({ success: true, addon });
    }
    catch (error) {
        console.error("Update Addon Error:", error);
        res.status(500).json({ success: false, message: "Failed to update addon" });
    }
});
exports.updateFlightAddon = updateFlightAddon;
// Delete addon
const deleteFlightAddon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield prisma.flightAddon.delete({ where: { id } });
        res.status(200).json({ success: true, message: "Addon deleted" });
    }
    catch (error) {
        console.error("Delete Addon Error:", error);
        res.status(500).json({ success: false, message: "Failed to delete addon" });
    }
});
exports.deleteFlightAddon = deleteFlightAddon;
const addExistingAddonsToFlightOffer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { flightOfferId } = req.params;
        const { addonIds } = req.body; // Expecting addonIds: string[]
        if (!flightOfferId) {
            return res.status(400).json({ message: "Flight offer ID is required" });
        }
        if (!Array.isArray(addonIds) || addonIds.length === 0) {
            return res.status(400).json({ message: "addonIds array is required" });
        }
        // Verify flight offer exists
        const flightOffer = yield prisma.flightOffer.findUnique({
            where: { id: flightOfferId },
        });
        if (!flightOffer) {
            return res.status(404).json({ message: "Flight offer not found" });
        }
        // Verify all addonIds exist
        const existingAddons = yield prisma.flightAddon.findMany({
            where: { id: { in: addonIds } },
        });
        if (existingAddons.length !== addonIds.length) {
            return res
                .status(400)
                .json({ message: "One or more addonIds are invalid" });
        }
        // Update addons to link to flight offer
        const updateResult = yield prisma.flightAddon.updateMany({
            where: { id: { in: addonIds } },
            data: { flightOfferId },
        });
        return res.status(200).json({
            message: `${updateResult.count} addons linked to flight offer successfully`,
        });
    }
    catch (error) {
        console.error("Error linking addons to flight offer:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message,
        });
    }
});
exports.addExistingAddonsToFlightOffer = addExistingAddonsToFlightOffer;
// Controller
const removeAddonsFromFlightOffer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { flightOfferId } = req.params;
        const { addonIds } = req.body;
        if (!flightOfferId) {
            return res.status(400).json({ message: "Flight offer ID is required" });
        }
        if (!Array.isArray(addonIds) || addonIds.length === 0) {
            return res.status(400).json({ message: "addonIds array is required" });
        }
        // Verify flight offer exists
        const flightOffer = yield prisma.flightOffer.findUnique({
            where: { id: flightOfferId },
        });
        if (!flightOffer) {
            return res.status(404).json({ message: "Flight offer not found" });
        }
        // Verify all addonIds are currently linked to this flight offer
        const existingAddons = yield prisma.flightAddon.findMany({
            where: {
                id: { in: addonIds },
                flightOfferId: flightOfferId,
            },
        });
        if (existingAddons.length !== addonIds.length) {
            return res.status(400).json({
                message: "One or more addonIds are not linked to this flight offer",
            });
        }
        // Remove association by setting flightOfferId to null
        const updateResult = yield prisma.flightAddon.updateMany({
            where: { id: { in: addonIds } },
            data: { flightOfferId: null },
        });
        return res.status(200).json({
            message: `${updateResult.count} addons unlinked from flight offer successfully`,
        });
    }
    catch (error) {
        console.error("Error unlinking addons from flight offer:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message,
        });
    }
});
exports.removeAddonsFromFlightOffer = removeAddonsFromFlightOffer;
function sendEmailBookingProcess(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { adminEmail, customerName, subject, customerEmail, text } = req.body;
            // Instantiate the API client
            const apiInstance = new brevo_1.TransactionalEmailsApi();
            // Set the API key using the provided method
            apiInstance.setApiKey(brevo_1.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
            // Create the email payload
            const sendSmtpEmail = new brevo_1.SendSmtpEmail();
            sendSmtpEmail.sender = {
                name: "Manwhit Aroes",
                email: adminEmail || "mails@manwhit.com",
            };
            sendSmtpEmail.to = [{ email: customerEmail, name: customerName }];
            sendSmtpEmail.subject = subject;
            sendSmtpEmail.htmlContent = `<html><body><p>${text}</p></body></html>`;
            // Send the transactional email
            const response = yield apiInstance.sendTransacEmail(sendSmtpEmail);
            return res
                .status(200)
                .json({ message: "Email sent successfully", data: response });
        }
        catch (error) {
            console.error("Error:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
}
function getUserRole(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({
                    message: `Missing required parameter: id`,
                });
            }
            const account = yield prisma.user.findUnique({
                where: { email: email },
                select: { role: true },
            });
            if (!account) {
                return res.status(404).json({
                    message: `Account does not exist`,
                });
            }
            return res.status(200).json({
                message: `Success`,
                data: account,
            });
        }
        catch (error) {
            console.error(`Error:`, error);
            return res.status(500).json({
                message: `Internal server error`,
            });
        }
    });
}
