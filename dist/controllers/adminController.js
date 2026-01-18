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
exports.sendEmailBookingProcessController = sendEmailBookingProcessController;
exports.getUserRole = getUserRole;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const adminEmailService_1 = require("../utils/adminEmailService");
const zeptomail_1 = require("../utils/zeptomail");
const apiResponse_1 = require("../utils/apiResponse");
const authUtils_1 = require("../utils/authUtils");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ADMIN_SECRET = process.env.JWT || "code";
function createAdminAccount(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { email, firstName, lastName } = req.body;
        if (!email) {
            return (0, apiResponse_1.sendError)(res, "Email is required!", 400);
        }
        try {
            const existingUser = yield prisma_1.prisma.user.findFirst({ where: { email } });
            if (existingUser) {
                return (0, apiResponse_1.sendError)(res, `Admin with email ${email} already exists`, 400);
            }
            const adminToken = crypto_1.default.randomBytes(32).toString("hex");
            const adminUser = yield prisma_1.prisma.user.create({
                data: {
                    email,
                    firstName,
                    lastName,
                    role: "ADMIN",
                    adminToken,
                    verified: true,
                },
            });
            return (0, apiResponse_1.sendSuccess)(res, "Admin created", { user: adminUser, token: adminToken }, 201);
        }
        catch (error) {
            console.error(`Admin account creation error ${error}`);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function adminLogin(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { email, adminToken } = req.body;
        if (!email || !adminToken) {
            return (0, apiResponse_1.sendError)(res, "Email and adminToken are required!", 400);
        }
        try {
            const admin = yield prisma_1.prisma.user.findUnique({ where: { email } });
            if (!admin || admin.role !== "ADMIN") {
                return (0, apiResponse_1.sendError)(res, "Unauthorized: Not an admin", 401);
            }
            if (admin.adminToken !== adminToken) {
                return (0, apiResponse_1.sendError)(res, "Invalid admin token", 401);
            }
            const { accessToken } = (0, authUtils_1.generateTokens)(admin);
            (0, authUtils_1.setTokenCookies)(res, accessToken);
            return (0, apiResponse_1.sendSuccess)(res, "Admin logged in successfully", { token: accessToken, data: admin });
        }
        catch (error) {
            console.error(`Admin login error ${error}`);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function createAgent(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { adminId } = req.params;
        const { email } = req.body;
        if (!email) {
            return (0, apiResponse_1.sendError)(res, "Agent email is required", 400);
        }
        try {
            // Check if user with email already exists
            const existingUser = yield prisma_1.prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return (0, apiResponse_1.sendError)(res, "User with this email address already exists", 409);
            }
            // Check if requester is admin
            const adminUser = yield prisma_1.prisma.user.findUnique({ where: { id: adminId } });
            if (!adminUser || adminUser.role !== client_1.Role.ADMIN) {
                return (0, apiResponse_1.sendError)(res, "Unauthorized: Only admins can create agents", 403);
            }
            // Create new agent user
            const agent = yield prisma_1.prisma.user.create({
                data: {
                    email,
                    role: client_1.Role.AGENT,
                    verified: false,
                },
            });
            return (0, apiResponse_1.sendSuccess)(res, "Agent created successfully", { agentId: agent.id, email: agent.email }, 201);
        }
        catch (error) {
            console.error("Agent creation error:", error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function createUserByAdmin(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { adminId } = req.params;
        const { email } = req.body;
        if (!email) {
            return (0, apiResponse_1.sendError)(res, "User email is required", 400);
        }
        try {
            // Check if user with email already exists
            const existingUser = yield prisma_1.prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return res
                    .status(409)
                    .json({ error: "User with this email address already exists" });
            }
            // Check if requester is admin
            const adminUser = yield prisma_1.prisma.user.findUnique({ where: { id: adminId } });
            if (!adminUser || adminUser.role !== client_1.Role.ADMIN) {
                return (0, apiResponse_1.sendError)(res, "Unauthorized: Only admins can create users", 403);
            }
            // Create new  user
            const user = yield prisma_1.prisma.user.create({
                data: {
                    email,
                    role: client_1.Role.USER,
                    verified: true,
                },
            });
            return (0, apiResponse_1.sendSuccess)(res, "User created successfully", { userId: user.id, email: user.email }, 201);
        }
        catch (error) {
            console.error("User creation error:", error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function updateUserByAdmin(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { adminId, userId } = req.params;
        const { email, firstName, nationality, lastName, dob, passportNo, passportExpiry, gender, phone, } = req.body;
        try {
            // Check if admin exists and has admin role
            const adminUser = yield prisma_1.prisma.user.findUnique({ where: { id: adminId } });
            if (!adminUser || adminUser.role !== client_1.Role.ADMIN) {
                return (0, apiResponse_1.sendError)(res, "Unauthorized: Only admins can update users", 403);
            }
            // Check if target user exists
            const existingUser = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
            });
            if (!existingUser) {
                return (0, apiResponse_1.sendError)(res, "User not found", 404);
            }
            const updatedUser = yield prisma_1.prisma.user.update({
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
            return (0, apiResponse_1.sendSuccess)(res, "User updated successfully", updatedUser);
        }
        catch (error) {
            console.error("User update error:", error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function deleteUserByAdmin(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { adminId, userId } = req.params;
        try {
            // Check if admin exists and has admin role
            const adminUser = yield prisma_1.prisma.user.findUnique({ where: { id: adminId } });
            if (!adminUser || adminUser.role !== client_1.Role.ADMIN) {
                return (0, apiResponse_1.sendError)(res, "Unauthorized: Only admins can delete users", 403);
            }
            // Check if target user exists
            const existingUser = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
            });
            if (!existingUser) {
                return (0, apiResponse_1.sendError)(res, "User not found", 404);
            }
            yield prisma_1.prisma.user.delete({ where: { id: userId } });
            return (0, apiResponse_1.sendSuccess)(res, "User deleted successfully", { userId });
        }
        catch (error) {
            console.error("User deletion error:", error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function verifyAgent(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { agentId } = req.params;
        try {
            const agent = yield prisma_1.prisma.user.findUnique({ where: { id: agentId } });
            if (!agent || agent.role !== "AGENT") {
                return (0, apiResponse_1.sendError)(res, "Agent not found", 404);
            }
            if (agent.verified) {
                return (0, apiResponse_1.sendError)(res, "Agent already verified", 400);
            }
            // Generate one-time-token for password setup
            const oneTimeToken = crypto_1.default.randomBytes(32).toString("hex");
            const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            const updatedAgent = yield prisma_1.prisma.user.update({
                where: { id: agentId },
                data: {
                    verified: true,
                    oneTimeAccessToken: oneTimeToken,
                    oneTimeAccessTokenExpires: tokenExpiry,
                },
            });
            yield (0, zeptomail_1.sendAgentActivationToken)(updatedAgent);
            return (0, apiResponse_1.sendSuccess)(res, "Agent verified, notification sent to agent's inbox", { token: oneTimeToken, expires: tokenExpiry });
        }
        catch (error) {
            console.error(`Agent verification error: ${error}`);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function agentSetupProfile(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { token, firstName, lastName, password } = req.body;
        if (!token || !password) {
            return (0, apiResponse_1.sendError)(res, "Token and password parameters are required", 400);
        }
        try {
            const agent = yield prisma_1.prisma.user.findFirst({
                where: {
                    oneTimeAccessToken: token,
                    oneTimeAccessTokenExpires: {
                        gt: new Date(),
                    },
                    role: "AGENT",
                },
            });
            if (!agent) {
                return (0, apiResponse_1.sendError)(res, "Invalid or expired token", 400);
            }
            const salt = yield bcryptjs_1.default.genSalt(10);
            const hashedPassword = yield bcryptjs_1.default.hash(password, salt);
            yield prisma_1.prisma.user.update({
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
            return (0, apiResponse_1.sendSuccess)(res, "Profile setup complete. Proceed to login", agent);
        }
        catch (error) {
            console.error(`Agent profile setup error ${error}`);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function loginAgent(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return (0, apiResponse_1.sendError)(res, "Email and password are required", 400);
            }
            const agent = yield prisma_1.prisma.user.findUnique({ where: { email } });
            if (!agent || agent.role !== "AGENT") {
                return (0, apiResponse_1.sendError)(res, "Unauthorized: Not an agent", 401);
            }
            const isPasswordValid = yield bcryptjs_1.default.compare(password, (agent === null || agent === void 0 ? void 0 : agent.password) || "");
            if (!isPasswordValid) {
                return (0, apiResponse_1.sendError)(res, "Invalid password", 400);
            }
            const { accessToken } = (0, authUtils_1.generateTokens)(agent);
            (0, authUtils_1.setTokenCookies)(res, accessToken);
            return (0, apiResponse_1.sendSuccess)(res, "Login successful", { token: accessToken, data: agent });
        }
        catch (error) {
            console.error(`Error logging in agent`, error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function getAgentAccountById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { agentId } = req.params;
        try {
            const agent = yield prisma_1.prisma.user.findUnique({ where: { id: agentId } });
            if (!agent || agent.role !== "AGENT") {
                return (0, apiResponse_1.sendError)(res, "Agent account not found", 404);
            }
            return (0, apiResponse_1.sendSuccess)(res, "Details fetched successfully", agent);
        }
        catch (error) {
            console.error(`Error getting agent account by id ${error}`);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function getAllAgentAccounts(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const agents = yield prisma_1.prisma.user.findMany({ where: { role: "AGENT" } });
            if (agents.length === 0) {
                return (0, apiResponse_1.sendSuccess)(res, "No agent records found", []);
            }
            return (0, apiResponse_1.sendSuccess)(res, "All agent accounts fetched successfully", agents);
        }
        catch (error) {
            console.error(`Error getting all agent account:`, error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function deleteAgentAccount(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { agentId } = req.params;
        try {
            const agent = yield prisma_1.prisma.user.findUnique({ where: { id: agentId } });
            if (!agent) {
                return (0, apiResponse_1.sendError)(res, "Agent account not found", 404);
            }
            yield prisma_1.prisma.user.delete({ where: { id: agentId } });
            return (0, apiResponse_1.sendSuccess)(res, "Agent account deleted successfully");
        }
        catch (error) {
            console.error(`Error deleting agent account:`, error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function getAllBookings(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const bookings = yield prisma_1.prisma.booking.findMany({
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
            return (0, apiResponse_1.sendSuccess)(res, "All bookings fetched successfully", bookings);
        }
        catch (error) {
            console.error("Error fetching bookings:", error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function getBookingAnalytics(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Total bookings count
            const totalBookings = yield prisma_1.prisma.booking.count();
            // Bookings count by status
            const bookingsByStatus = yield prisma_1.prisma.booking.groupBy({
                by: ["status"],
                _count: {
                    status: true,
                },
            });
            // Bookings count by type
            const bookingsByType = yield prisma_1.prisma.booking.groupBy({
                by: ["type"],
                _count: {
                    type: true,
                },
            });
            // Total revenue (sum of totalAmount)
            const revenueResult = yield prisma_1.prisma.booking.aggregate({
                _sum: {
                    totalAmount: true,
                },
            });
            const totalRevenue = revenueResult._sum.totalAmount || 0;
            // Bookings count by currency
            const bookingsByCurrency = yield prisma_1.prisma.booking.groupBy({
                by: ["currency"],
                _count: {
                    currency: true,
                },
            });
            // Recent bookings count (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const recentBookingsCount = yield prisma_1.prisma.booking.count({
                where: {
                    createdAt: {
                        gte: thirtyDaysAgo,
                    },
                },
            });
            // Optional: Bookings count by user (top 5 users by bookings)
            const bookingsByUser = yield prisma_1.prisma.booking.groupBy({
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
            const bookingsByGuestUser = yield prisma_1.prisma.booking.groupBy({
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
            return (0, apiResponse_1.sendSuccess)(res, "Booking analytics fetched successfully", {
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
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function createExclusion(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { airlineCode, reason } = req.body;
            const airline = yield prisma_1.prisma.excludedAirline.findUnique({
                where: { airlineCode: airlineCode },
            });
            if (airline) {
                return (0, apiResponse_1.sendError)(res, "IataCode already exists", 400);
            }
            const newAirline = yield prisma_1.prisma.excludedAirline.create({
                data: {
                    airlineCode,
                    reason,
                },
            });
            return (0, apiResponse_1.sendSuccess)(res, "Airline exclusion created successfully", newAirline, 201);
        }
        catch (error) {
            return (0, apiResponse_1.sendError)(res, "Internal Server Error", 500, error);
        }
    });
}
function readExclusion(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const airlineExculsion = yield prisma_1.prisma.excludedAirline.findMany();
            return (0, apiResponse_1.sendSuccess)(res, "Airline exclusions fetched successfully", airlineExculsion);
        }
        catch (error) {
            console.error(`Error`, error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function updateExclusion(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { iataCode } = req.params;
        const { airlineCode, reason } = req.body;
        try {
            if (!airlineCode) {
                return (0, apiResponse_1.sendError)(res, "Iata field is required", 400);
            }
            const iata = yield prisma_1.prisma.excludedAirline.findUnique({
                where: { id: iataCode },
            });
            yield prisma_1.prisma.excludedAirline.update({
                where: { id: iataCode },
                data: {
                    airlineCode,
                    reason,
                },
            });
            return (0, apiResponse_1.sendSuccess)(res, "IATA Code successfully updated");
        }
        catch (error) {
            console.error(`Response: `, error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function deleteExclusion(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let { iataCode } = req.params;
            if (!iataCode || typeof iataCode !== "string") {
                return (0, apiResponse_1.sendError)(res, "IATA Code parameter is required", 400);
            }
            // Normalize IATA code: trim and uppercase
            iataCode = iataCode.trim().toUpperCase();
            // Check if the IATA code exists
            const existing = yield prisma_1.prisma.excludedAirline.findUnique({
                where: { airlineCode: iataCode },
            });
            if (!existing) {
                return (0, apiResponse_1.sendError)(res, `IATA Code '${iataCode}' does not exist`, 404);
            }
            // Delete the exclusion record
            yield prisma_1.prisma.excludedAirline.delete({
                where: { airlineCode: iataCode },
            });
            return (0, apiResponse_1.sendSuccess)(res, `IATA Code '${iataCode}' deleted successfully`);
        }
        catch (error) {
            console.error("Error deleting IATA exclusion:", error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
// Create Addons
const createFlightAddon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, description, price } = req.body;
        const addon = yield prisma_1.prisma.flightAddon.create({
            data: {
                name,
                description,
                price,
                currency: "USD",
            },
        });
        return (0, apiResponse_1.sendSuccess)(res, "Addon created successfully", addon, 201);
    }
    catch (error) {
        console.error("Create Addon Error:", error);
        return (0, apiResponse_1.sendError)(res, "Failed to create addon", 500, error);
    }
});
exports.createFlightAddon = createFlightAddon;
// Get all admin-defined addons
const getAllFlightAddons = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const addons = yield prisma_1.prisma.flightAddon.findMany({
            where: {
                bookingId: null,
            },
            orderBy: { createdAt: "desc" },
        });
        return (0, apiResponse_1.sendSuccess)(res, "Addons fetched successfully", addons);
    }
    catch (error) {
        console.error("Get Addons Error:", error);
        return (0, apiResponse_1.sendError)(res, "Failed to fetch addons", 500, error);
    }
});
exports.getAllFlightAddons = getAllFlightAddons;
// Update addon
const updateFlightAddon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { name, description, price, currency } = req.body;
    try {
        const addon = yield prisma_1.prisma.flightAddon.update({
            where: { id },
            data: { name, description, price, currency },
        });
        return (0, apiResponse_1.sendSuccess)(res, "Addon updated successfully", addon);
    }
    catch (error) {
        console.error("Update Addon Error:", error);
        return (0, apiResponse_1.sendError)(res, "Failed to update addon", 500, error);
    }
});
exports.updateFlightAddon = updateFlightAddon;
// Delete addon
const deleteFlightAddon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield prisma_1.prisma.flightAddon.delete({ where: { id } });
        return (0, apiResponse_1.sendSuccess)(res, "Addon deleted successfully");
    }
    catch (error) {
        console.error("Delete Addon Error:", error);
        return (0, apiResponse_1.sendError)(res, "Failed to delete addon", 500, error);
    }
});
exports.deleteFlightAddon = deleteFlightAddon;
const addExistingAddonsToFlightOffer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { flightOfferId } = req.params;
        const { addonIds } = req.body; // Expecting addonIds: string[]
        if (!flightOfferId) {
            return (0, apiResponse_1.sendError)(res, "Flight offer ID is required", 400);
        }
        if (!Array.isArray(addonIds) || addonIds.length === 0) {
            return (0, apiResponse_1.sendError)(res, "addonIds array is required", 400);
        }
        // Verify flight offer exists
        const flightOffer = yield prisma_1.prisma.flightOffer.findUnique({
            where: { id: flightOfferId },
        });
        if (!flightOffer) {
            return (0, apiResponse_1.sendError)(res, "Flight offer not found", 404);
        }
        // Verify all addonIds exist
        const existingAddons = yield prisma_1.prisma.flightAddon.findMany({
            where: { id: { in: addonIds } },
        });
        if (existingAddons.length !== addonIds.length) {
            return (0, apiResponse_1.sendError)(res, "One or more addonIds are invalid", 400);
        }
        // Update addons to link to flight offer
        const updateResult = yield prisma_1.prisma.flightAddon.updateMany({
            where: { id: { in: addonIds } },
            data: { flightOfferId },
        });
        return (0, apiResponse_1.sendSuccess)(res, `${updateResult.count} addons linked to flight offer successfully`);
    }
    catch (error) {
        console.error("Error linking addons to flight offer:", error);
        return (0, apiResponse_1.sendError)(res, "Server error", 500, error);
    }
});
exports.addExistingAddonsToFlightOffer = addExistingAddonsToFlightOffer;
// Controller
const removeAddonsFromFlightOffer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { flightOfferId } = req.params;
        const { addonIds } = req.body;
        if (!flightOfferId) {
            return (0, apiResponse_1.sendError)(res, "Flight offer ID is required", 400);
        }
        if (!Array.isArray(addonIds) || addonIds.length === 0) {
            return (0, apiResponse_1.sendError)(res, "addonIds array is required", 400);
        }
        // Verify flight offer exists
        const flightOffer = yield prisma_1.prisma.flightOffer.findUnique({
            where: { id: flightOfferId },
        });
        if (!flightOffer) {
            return (0, apiResponse_1.sendError)(res, "Flight offer not found", 404);
        }
        // Verify all addonIds are currently linked to this flight offer
        const existingAddons = yield prisma_1.prisma.flightAddon.findMany({
            where: {
                id: { in: addonIds },
                flightOfferId: flightOfferId,
            },
        });
        if (existingAddons.length !== addonIds.length) {
            return (0, apiResponse_1.sendError)(res, "One or more addonIds are not linked to this flight offer", 400);
        }
        // Remove association by setting flightOfferId to null
        const updateResult = yield prisma_1.prisma.flightAddon.updateMany({
            where: { id: { in: addonIds } },
            data: { flightOfferId: null },
        });
        return (0, apiResponse_1.sendSuccess)(res, `${updateResult.count} addons unlinked from flight offer successfully`);
    }
    catch (error) {
        console.error("Error unlinking addons from flight offer:", error);
        return (0, apiResponse_1.sendError)(res, "Server error", 500, error);
    }
});
exports.removeAddonsFromFlightOffer = removeAddonsFromFlightOffer;
function sendEmailBookingProcessController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { adminEmail, customerName, subject, customerEmail, text } = req.body;
            const result = yield (0, adminEmailService_1.sendEmailBookingProcess)({
                adminEmail,
                customerName,
                subject,
                customerEmail,
                text,
            });
            return (0, apiResponse_1.sendSuccess)(res, "Email sent successfully", result);
        }
        catch (error) {
            console.error("Error:", error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function getUserRole(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { email } = req.body;
            if (!email) {
                return (0, apiResponse_1.sendError)(res, "Missing required parameter: email", 400);
            }
            const account = yield prisma_1.prisma.user.findUnique({
                where: { email: email },
                select: { role: true },
            });
            if (!account) {
                return (0, apiResponse_1.sendError)(res, "Account does not exist", 404);
            }
            return (0, apiResponse_1.sendSuccess)(res, "Success", account);
        }
        catch (error) {
            console.error(`Error:`, error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
