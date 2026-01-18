import { prisma } from "../lib/prisma";
import { Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import crypto from "crypto";
import bcryptjs from "bcryptjs";
import { sendEmailBookingProcess } from "../utils/adminEmailService";
import { sendAgentActivationToken } from "../utils/zeptomail";
import { sendSuccess, sendError } from "../utils/apiResponse";
import env from "dotenv";
env.config();

const ADMIN_SECRET = process.env.JWT! || "code";

export async function createAdminAccount(
  req: Request,
  res: Response
): Promise<any> {
  const { email, firstName, lastName } = req.body;

  if (!email) {
    return sendError(res, "Email is required!", 400);
  }

  try {
    const existingUser = await prisma.user.findFirst({ where: { email } });

    if (existingUser) {
      return sendError(res, `Admin with email ${email} already exists`, 400);
    }

    const adminToken = crypto.randomBytes(32).toString("hex");

    const adminUser = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        role: "ADMIN",
        adminToken,
        verified: true,
      },
    });

    return sendSuccess(res, "Admin created", { user: adminUser, token: adminToken }, 201);
  } catch (error) {
    console.error(`Admin account creation error ${error}`);
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function adminLogin(req: Request, res: Response): Promise<any> {
  const { email, adminToken } = req.body;

  if (!email || !adminToken) {
    return sendError(res, "Email and adminToken are required!", 400);
  }

  try {
    const admin = await prisma.user.findUnique({ where: { email } });

    if (!admin || admin.role !== "ADMIN") {
      return sendError(res, "Unauthorized: Not an admin", 401);
    }

    if (admin.adminToken !== adminToken) {
      return sendError(res, "Invalid admin token", 401);
    }

    const token = jwt.sign(
      {
        userId: admin.id,
        role: admin.role,
      },
      ADMIN_SECRET,
      { expiresIn: "4h" }
    );

    return sendSuccess(res, "Admin logged in successfully", { token, data: admin });
  } catch (error) {
    console.error(`Admin login error ${error}`);
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function createAgent(req: Request, res: Response): Promise<any> {
  const { adminId } = req.params;
  const { email } = req.body;

  if (!email) {
    return sendError(res, "Agent email is required", 400);
  }

  try {
    // Check if user with email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res
        .status(409)
        .json({ error: "User with this email address already exists" });
    }

    // Check if requester is admin
    const adminUser = await prisma.user.findUnique({ where: { id: adminId } });
    if (!adminUser || adminUser.role !== Role.ADMIN) {
      return sendError(res, "Unauthorized: Only admins can create agents", 403);
    }

    // Create new agent user
    const agent = await prisma.user.create({
      data: {
        email,
        role: Role.AGENT,
        verified: false,
      },
    });

    return sendSuccess(res, "Agent created successfully", { agentId: agent.id, email: agent.email }, 201);
  } catch (error) {
    console.error("Agent creation error:", error);
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function createUserByAdmin(
  req: Request,
  res: Response
): Promise<Response | any> {
  const { adminId } = req.params;
  const { email } = req.body;

  if (!email) {
    return sendError(res, "User email is required", 400);
  }

  try {
    // Check if user with email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res
        .status(409)
        .json({ error: "User with this email address already exists" });
    }

    // Check if requester is admin
    const adminUser = await prisma.user.findUnique({ where: { id: adminId } });
    if (!adminUser || adminUser.role !== Role.ADMIN) {
      return sendError(res, "Unauthorized: Only admins can create users", 403);
    }

    // Create new  user
    const user = await prisma.user.create({
      data: {
        email,
        role: Role.USER,
        verified: true,
      },
    });

    return sendSuccess(res, "User created successfully", { userId: user.id, email: user.email }, 201);
  } catch (error) {
    console.error("User creation error:", error);
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function updateUserByAdmin(
  req: Request,
  res: Response
): Promise<Response | any> {
  const { adminId, userId } = req.params;
  const {
    email,
    firstName,
    nationality,
    lastName,
    dob,
    passportNo,
    passportExpiry,
    gender,
    phone,
  } = req.body;

  try {
    // Check if admin exists and has admin role
    const adminUser = await prisma.user.findUnique({ where: { id: adminId } });
    if (!adminUser || adminUser.role !== Role.ADMIN) {
      return sendError(res, "Unauthorized: Only admins can update users", 403);
    }

    // Check if target user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email: email ?? existingUser.email,
        firstName: firstName ?? existingUser.firstName,
        lastName: lastName ?? existingUser.lastName,
        phone: phone ?? existingUser.phone,
        nationality: nationality ?? existingUser.nationality,
        gender: gender ?? existingUser.gender,
        passportNo: passportNo ?? existingUser.passportNo,
        dob: dob ? new Date(dob) : existingUser.dob,
        passportExpiry: passportExpiry
          ? new Date(passportExpiry)
          : existingUser.passportExpiry,
      },
    });

    return sendSuccess(res, "User updated successfully", updatedUser);
  } catch (error) {
    console.error("User update error:", error);
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function deleteUserByAdmin(
  req: Request,
  res: Response
): Promise<Response | any> {
  const { adminId, userId } = req.params;

  try {
    // Check if admin exists and has admin role
    const adminUser = await prisma.user.findUnique({ where: { id: adminId } });
    if (!adminUser || adminUser.role !== Role.ADMIN) {
      return sendError(res, "Unauthorized: Only admins can delete users", 403);
    }

    // Check if target user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existingUser) {
      return sendError(res, "User not found", 404);
    }

    await prisma.user.delete({ where: { id: userId } });

    return sendSuccess(res, "User deleted successfully", { userId });
  } catch (error) {
    console.error("User deletion error:", error);
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function verifyAgent(req: Request, res: Response): Promise<any> {
  const { agentId } = req.params;

  try {
    const agent = await prisma.user.findUnique({ where: { id: agentId } });

    if (!agent || agent.role !== "AGENT") {
      return sendError(res, "Agent not found", 404);
    }

    if (agent.verified) {
      return sendError(res, "Agent already verified", 400);
    }

    // Generate one-time-token for password setup
    const oneTimeToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const updatedAgent = await prisma.user.update({
      where: { id: agentId },
      data: {
        verified: true,
        oneTimeAccessToken: oneTimeToken,
        oneTimeAccessTokenExpires: tokenExpiry,
      },
    });

    await sendAgentActivationToken(updatedAgent);

    return sendSuccess(res, "Agent verified, notification sent to agent's inbox", { token: oneTimeToken, expires: tokenExpiry });
  } catch (error) {
    console.error(`Agent verification error: ${error}`);
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function agentSetupProfile(
  req: Request,
  res: Response
): Promise<any> {
  const { token, firstName, lastName, password } = req.body;

  if (!token || !password) {
    return sendError(res, "Token and password parameters are required", 400);
  }

  try {
    const agent = await prisma.user.findFirst({
      where: {
        oneTimeAccessToken: token,
        oneTimeAccessTokenExpires: {
          gt: new Date(),
        },
        role: "AGENT",
      },
    });

    if (!agent) {
      return sendError(res, "Invalid or expired token", 400);
    }

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    await prisma.user.update({
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

    return sendSuccess(res, "Profile setup complete. Proceed to login", agent);
  } catch (error) {
    console.error(`Agent profile setup error ${error}`);
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function loginAgent(req: Request, res: Response): Promise<any> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, "Email and password are required", 400);
    }

    const agent = await prisma.user.findUnique({ where: { email } });

    if (!agent || agent.role !== "AGENT") {
      return sendError(res, "Unauthorized: Not an agent", 401);
    }

    const isPasswordValid = await bcryptjs.compare(
      password,
      agent?.password || ""
    );

    if (!isPasswordValid) {
      return sendError(res, "Invalid password", 400);
    }

    const token = jwt.sign(
      { userId: agent.id, role: agent.role },
      ADMIN_SECRET || "code",
      { expiresIn: "1h" }
    );

    return sendSuccess(res, "Login successful", { token, data: agent });
  } catch (error: any) {
    console.error(`Error logging in agent`, error);
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function getAgentAccountById(
  req: Request,
  res: Response
): Promise<any> {
  const { agentId } = req.params;

  try {
    const agent = await prisma.user.findUnique({ where: { id: agentId } });

    if (!agent || agent.role !== "AGENT") {
      return sendError(res, "Agent account not found", 404);
    }

    return sendSuccess(res, "Details fetched successfully", agent);
  } catch (error: any) {
    console.error(`Error getting agent account by id ${error}`);
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function getAllAgentAccounts(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const agents = await prisma.user.findMany({ where: { role: "AGENT" } });

    if (agents.length === 0) {
      return sendSuccess(res, "No agent records found", []);
    }

    return sendSuccess(res, "All agent accounts fetched successfully", agents);
  } catch (error: any) {
    console.error(`Error getting all agent account:`, error);
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function deleteAgentAccount(
  req: Request,
  res: Response
): Promise<any> {
  const { agentId } = req.params;

  try {
    const agent = await prisma.user.findUnique({ where: { id: agentId } });

    if (!agent) {
      return sendError(res, "Agent account not found", 404);
    }

    await prisma.user.delete({ where: { id: agentId } });

    return sendSuccess(res, "Agent account deleted successfully");
  } catch (error: any) {
    console.error(`Error deleting agent account:`, error);
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function getAllBookings(
  req: Request,
  res: Response
): Promise<Response | any> {
  try {
    const bookings = await prisma.booking.findMany({
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

    return sendSuccess(res, "All bookings fetched successfully", bookings);
  } catch (error: any) {
    console.error("Error fetching bookings:", error);
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function getBookingAnalytics(
  req: Request,
  res: Response
): Promise<Response | any> {
  try {
    // Total bookings count
    const totalBookings = await prisma.booking.count();

    // Bookings count by status
    const bookingsByStatus = await prisma.booking.groupBy({
      by: ["status"],
      _count: {
        status: true,
      },
    });

    // Bookings count by type
    const bookingsByType = await prisma.booking.groupBy({
      by: ["type"],
      _count: {
        type: true,
      },
    });

    // Total revenue (sum of totalAmount)
    const revenueResult = await prisma.booking.aggregate({
      _sum: {
        totalAmount: true,
      },
    });
    const totalRevenue = revenueResult._sum.totalAmount || 0;

    // Bookings count by currency
    const bookingsByCurrency = await prisma.booking.groupBy({
      by: ["currency"],
      _count: {
        currency: true,
      },
    });

    // Recent bookings count (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentBookingsCount = await prisma.booking.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    // Optional: Bookings count by user (top 5 users by bookings)
    const bookingsByUser = await prisma.booking.groupBy({
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
    const bookingsByGuestUser = await prisma.booking.groupBy({
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

    return sendSuccess(res, "Booking analytics fetched successfully", {
      totalBookings,
      bookingsByStatus,
      bookingsByType,
      totalRevenue,
      bookingsByCurrency,
      recentBookingsCount,
      bookingsByUser,
      bookingsByGuestUser,
    });
  } catch (error: any) {
    console.error("Error fetching booking analytics:", error);
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function createExclusion(
  req: Request,
  res: Response
): Promise<Response | any> {
  try {
    const { airlineCode, reason } = req.body;

    const airline = await prisma.excludedAirline.findUnique({
      where: { airlineCode: airlineCode },
    });

    if (airline) {
      return sendError(res, "IataCode already exists", 400);
    }

    const newAirline = await prisma.excludedAirline.create({
      data: {
        airlineCode,
        reason,
      },
    });
    return sendSuccess(res, "Airline exclusion created successfully", newAirline, 201);
  } catch (error: any) {
    return sendError(res, "Internal Server Error", 500, error);
  }
}

export async function readExclusion(
  req: Request,
  res: Response
): Promise<Response | any> {
  try {
    const airlineExculsion = await prisma.excludedAirline.findMany();

    return sendSuccess(res, "Airline exclusions fetched successfully", airlineExculsion);
  } catch (error: any) {
    console.error(`Error`, error);
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function updateExclusion(
  req: Request,
  res: Response
): Promise<any> {
  const { iataCode } = req.params;
  const { airlineCode, reason } = req.body;
  try {
    if (!airlineCode) {
      return sendError(res, "Iata field is required", 400);
    }

    const iata = await prisma.excludedAirline.findUnique({
      where: { id: iataCode },
    });

    await prisma.excludedAirline.update({
      where: { id: iataCode },
      data: {
        airlineCode,
        reason,
      },
    });

    return sendSuccess(res, "IATA Code successfully updated");
  } catch (error: any) {
    console.error(`Response: `, error);
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function deleteExclusion(
  req: Request,
  res: Response
): Promise<any> {
  try {
    let { iataCode } = req.params;

    if (!iataCode || typeof iataCode !== "string") {
      return sendError(res, "IATA Code parameter is required", 400);
    }

    // Normalize IATA code: trim and uppercase
    iataCode = iataCode.trim().toUpperCase();

    // Check if the IATA code exists
    const existing = await prisma.excludedAirline.findUnique({
      where: { airlineCode: iataCode },
    });

    if (!existing) {
      return sendError(res, `IATA Code '${iataCode}' does not exist`, 404);
    }

    // Delete the exclusion record
    await prisma.excludedAirline.delete({
      where: { airlineCode: iataCode },
    });

    return sendSuccess(res, `IATA Code '${iataCode}' deleted successfully`);
  } catch (error: any) {
    console.error("Error deleting IATA exclusion:", error);
    return sendError(res, "Internal server error", 500, error);
  }
}

// Create Addons
export const createFlightAddon = async (req: Request, res: Response) => {
  try {
    const { name, description, price } = req.body;

    const addon = await prisma.flightAddon.create({
      data: {
        name,
        description,
        price,
        currency: "USD",
      },
    });

    return sendSuccess(res, "Addon created successfully", addon, 201);
  } catch (error) {
    console.error("Create Addon Error:", error);
    return sendError(res, "Failed to create addon", 500, error);
  }
};

// Get all admin-defined addons
export const getAllFlightAddons = async (_req: Request, res: Response) => {
  try {
    const addons = await prisma.flightAddon.findMany({
      where: {
        bookingId: null,
      },
      orderBy: { createdAt: "desc" },
    });

    return sendSuccess(res, "Addons fetched successfully", addons);
  } catch (error) {
    console.error("Get Addons Error:", error);
    return sendError(res, "Failed to fetch addons", 500, error);
  }
};

// Update addon
export const updateFlightAddon = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, price, currency } = req.body;

  try {
    const addon = await prisma.flightAddon.update({
      where: { id },
      data: { name, description, price, currency },
    });

    return sendSuccess(res, "Addon updated successfully", addon);
  } catch (error) {
    console.error("Update Addon Error:", error);
    return sendError(res, "Failed to update addon", 500, error);
  }
};

// Delete addon
export const deleteFlightAddon = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.flightAddon.delete({ where: { id } });
    return sendSuccess(res, "Addon deleted successfully");
  } catch (error) {
    console.error("Delete Addon Error:", error);
    return sendError(res, "Failed to delete addon", 500, error);
  }
};

export const addExistingAddonsToFlightOffer = async (
  req: Request,
  res: Response
): Promise<Response | any> => {
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
    const flightOffer = await prisma.flightOffer.findUnique({
      where: { id: flightOfferId },
    });
    if (!flightOffer) {
      return res.status(404).json({ message: "Flight offer not found" });
    }

    // Verify all addonIds exist
    const existingAddons = await prisma.flightAddon.findMany({
      where: { id: { in: addonIds } },
    });
    if (existingAddons.length !== addonIds.length) {
      return sendError(res, "One or more addonIds are invalid", 400);
    }

    // Update addons to link to flight offer
    const updateResult = await prisma.flightAddon.updateMany({
      where: { id: { in: addonIds } },
      data: { flightOfferId },
    });

    return sendSuccess(res, `${updateResult.count} addons linked to flight offer successfully`);
  } catch (error: any) {
    console.error("Error linking addons to flight offer:", error);
    return sendError(res, "Server error", 500, error);
  }
};

// Controller
export const removeAddonsFromFlightOffer = async (
  req: Request,
  res: Response
): Promise<Response | any> => {
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
    const flightOffer = await prisma.flightOffer.findUnique({
      where: { id: flightOfferId },
    });
    if (!flightOffer) {
      return res.status(404).json({ message: "Flight offer not found" });
    }

    // Verify all addonIds are currently linked to this flight offer
    const existingAddons = await prisma.flightAddon.findMany({
      where: {
        id: { in: addonIds },
        flightOfferId: flightOfferId,
      },
    });

    if (existingAddons.length !== addonIds.length) {
      return sendError(res, "One or more addonIds are not linked to this flight offer", 400);
    }

    // Remove association by setting flightOfferId to null
    const updateResult = await prisma.flightAddon.updateMany({
      where: { id: { in: addonIds } },
      data: { flightOfferId: null },
    });

    return sendSuccess(res, `${updateResult.count} addons unlinked from flight offer successfully`);
  } catch (error: any) {
    console.error("Error unlinking addons from flight offer:", error);
    return sendError(res, "Server error", 500, error);
  }
};

export async function sendEmailBookingProcessController(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { adminEmail, customerName, subject, customerEmail, text } = req.body;

    const result = await sendEmailBookingProcess({
      adminEmail,
      customerName,
      subject,
      customerEmail,
      text,
    });

    return sendSuccess(res, "Email sent successfully", result);
  } catch (error: any) {
    console.error("Error:", error);
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function getUserRole(req: Request, res: Response): Promise<any> {
  try {
    const { email } = req.body;

    if (!email) {
      return sendError(res, "Missing required parameter: email", 400);
    }

    const account = await prisma.user.findUnique({
      where: { email: email },
      select: { role: true },
    });

    if (!account) {
      return sendError(res, "Account does not exist", 404);
    }

    return sendSuccess(res, "Success", account);
  } catch (error: any) {
    console.error(`Error:`, error);
    return sendError(res, "Internal server error", 500, error);
  }
}
