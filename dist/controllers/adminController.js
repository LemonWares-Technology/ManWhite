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
exports.createAdminAccount = createAdminAccount;
exports.adminLogin = adminLogin;
exports.createAgent = createAgent;
exports.verifyAgent = verifyAgent;
exports.agentSetupProfile = agentSetupProfile;
exports.loginAgent = loginAgent;
exports.getAgentAccountById = getAgentAccountById;
exports.getAllAgentAccounts = getAllAgentAccounts;
exports.deleteAgentAccount = deleteAgentAccount;
const client_1 = require("@prisma/client");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dotenv_1 = __importDefault(require("dotenv"));
const emailServices_1 = require("../config/emailServices");
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
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                error: `Agent email is required`,
            });
        }
        try {
            const existingUser = yield prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return res
                    .status(409)
                    .json({ error: `User with this email address already exists` });
            }
            // create agent user with role AGENT and unverified
            const agent = yield prisma.user.create({
                data: {
                    email,
                    role: "AGENT",
                    verified: false,
                },
            });
            // send password setup email to agent
            return res.status(201).json({
                message: `Agent account created successfully`,
                data: agent,
            });
        }
        catch (error) {
            console.error(`Agent creation error: ${error}`);
            return res.status(500).json({
                error: `Internal server error`,
            });
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
