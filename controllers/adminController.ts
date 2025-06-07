import nodemailer from "nodemailer";
import { EmailStatus, PrismaClient, Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import crypto from "crypto";
import bcryptjs from "bcryptjs";
import { sendToken } from "../config/emailServices";
import env from "dotenv";
env.config();

const ADMIN_SECRET = process.env.JWT! || "code";
const prisma = new PrismaClient();

export async function createAdminAccount(
  req: Request,
  res: Response
): Promise<any> {
  const { email, firstName, lastName } = req.body;

  if (!email) {
    return res.status(400).json({
      error: `Email is required !`,
    });
  }

  try {
    const existingUser = await prisma.user.findFirst({ where: { email } });

    if (existingUser) {
      return res.status(400).json({
        error: `Admin with email ${email} already exists`,
      });
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

    return res.status(201).json({
      message: `Admin created`,
      user: adminUser,
      token: adminToken,
    });
  } catch (error) {
    console.error(`Admin account creation error ${error}`);

    return res.status(500).json({
      message: `Internal server error`,
    });
  }
}

export async function adminLogin(req: Request, res: Response): Promise<any> {
  const { email, adminToken } = req.body;

  if (!email || !adminToken) {
    return res.status(400).json({
      message: `Email and adminToken are required!`,
    });
  }

  try {
    const admin = await prisma.user.findUnique({ where: { email } });

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

    const token = jwt.sign(
      {
        userId: admin.id,
        role: admin.role,
      },
      ADMIN_SECRET,
      { expiresIn: "4h" }
    );

    return res.json({
      token,
      message: `Admin logged in successfully`,
      data: admin,
    });
  } catch (error) {
    console.error(`Admin login error ${error}`);
    return res.status(500).json({ error: `Internal server error` });
  }
}

export async function createAgent(req: Request, res: Response): Promise<any> {
  const { adminId } = req.params;
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Agent email is required" });
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
      return res
        .status(403)
        .json({ error: "Unauthorized: Only admins can create agents" });
    }

    // Create new agent user
    const agent = await prisma.user.create({
      data: {
        email,
        role: Role.AGENT,
        verified: false,
      },
    });

    return res.status(201).json({
      message: "Agent created successfully",
      agentId: agent.id,
      email: agent.email,
    });
  } catch (error) {
    console.error("Agent creation error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function createUserByAdmin(
  req: Request,
  res: Response
): Promise<Response | any> {
  const { adminId } = req.params;
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "User email is required" });
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
      return res
        .status(403)
        .json({ error: "Unauthorized: Only admins can create users" });
    }

    // Create new  user
    const user = await prisma.user.create({
      data: {
        email,
        role: Role.USER,
        verified: true,
      },
    });

    return res.status(201).json({
      message: "User created successfully",
      userId: user.id,
      email: user.email,
    });
  } catch (error) {
    console.error("User creation error:", error);
    return res.status(500).json({ error: "Internal server error" });
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
      return res
        .status(403)
        .json({ error: "Unauthorized: Only admins can update users" });
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

    return res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("User update error:", error);
    return res.status(500).json({ error: "Internal server error" });
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
      return res
        .status(403)
        .json({ error: "Unauthorized: Only admins can delete users" });
    }

    // Check if target user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    await prisma.user.delete({ where: { id: userId } });

    return res.status(200).json({
      message: "User deleted successfully",
      userId,
    });
  } catch (error) {
    console.error("User deletion error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function verifyAgent(req: Request, res: Response): Promise<any> {
  const { agentId } = req.params;

  try {
    const agent = await prisma.user.findUnique({ where: { id: agentId } });

    if (!agent || agent.role !== "AGENT") {
      return res.status(404).json({ error: `Agent not found` });
    }

    if (agent.verified) {
      return res.status(400).json({ error: `Agent already verified` });
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

    await sendToken(updatedAgent);

    return res.status(200).json({
      message: `Agent verified, notification sent to agent's inbox`,
      token: oneTimeToken,
      expires: tokenExpiry,
    });
  } catch (error) {
    console.error(`Agent verification error: ${error}`);
    return res.status(500).json({
      error: `Internal server error`,
    });
  }
}

export async function agentSetupProfile(
  req: Request,
  res: Response
): Promise<any> {
  const { token, firstName, lastName, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({
      error: `Token and password parameters are required`,
    });
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
      return res.status(400).json({ error: `Invalid or expired token` });
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

    return res.json({
      message: `Profile setup complete. Proceed to login`,
      agent,
    });
  } catch (error) {
    console.error(`Agent profile setup error ${error}`);

    return res.status(500).json({ error: `Internal server error` });
  }
}

export async function loginAgent(req: Request, res: Response): Promise<any> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: `Email and password are required`,
      });
    }

    const agent = await prisma.user.findUnique({ where: { email } });

    if (!agent || agent.role !== "AGENT") {
      return res.status(401).json({
        error: `Unauthorized: Not an agent`,
      });
    }

    const isPasswordValid = await bcryptjs.compare(
      password,
      agent?.password || ""
    );

    if (!isPasswordValid) {
      return res.status(400).json({
        error: `Invalid password`,
      });
    }

    const token = jwt.sign(
      { userId: agent.id, role: agent.role },
      ADMIN_SECRET || "code",
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      message: `Login successful`,
      token,
      data: agent,
    });
  } catch (error: any) {
    console.error(`Error logging in agent`, error);
    return res.status(500).json({
      message: `Internal server error`,
    });
  }
}

export async function getAgentAccountById(
  req: Request,
  res: Response
): Promise<any> {
  const { agentId } = req.params;

  try {
    const agent = await prisma.user.findMany({ where: { id: agentId } });

    if (!agent) {
      return res.status(404).json({ error: `Agent account not found` });
    }

    return res.status(200).json({
      message: `Details fetched successfully`,
      data: agent,
    });
  } catch (error: any) {
    console.error(`Error getting agent account by id ${error}`);
    return res.status(500).json({
      error: `Internal server error`,
    });
  }
}

export async function getAllAgentAccounts(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const agents = await prisma.user.findMany({ where: { role: "AGENT" } });

    if (!agents) {
      return res.status(404).json({ error: `No agent records found` });
    }

    return res.status(200).json({
      message: `All agent accounts fetched successfully`,
      data: agents,
    });
  } catch (error: any) {
    console.error(`Error getting all agent account:`, error);

    return res.status(500).json({
      error: `Internal server error`,
    });
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
      return res.status(404).json({ error: `Agent account not found` });
    }

    await prisma.user.delete({ where: { id: agentId } });

    return res.status(200).json({
      message: `Agent account deleted successfully`,
    });
  } catch (error: any) {
    console.error(`Error deleting agent account:`, error);

    return res.status(500).json({
      error: `Internal server error`,
    });
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

    return res.status(200).json({ bookings });
  } catch (error: any) {
    console.error("Error fetching bookings:", error);
    return res.status(500).json({ error: "Internal server error" });
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
  } catch (error: any) {
    console.error("Error fetching booking analytics:", error);
    return res.status(500).json({ error: "Internal server error" });
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
      return res.status(400).json({ error: " IataCode already exists" });
    }

    const newAirline = await prisma.excludedAirline.create({
      data: {
        airlineCode,
        reason,
      },
    });
    return res.status(201).json(newAirline);
  } catch (error: any) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function readExclusion(
  req: Request,
  res: Response
): Promise<Response | any> {
  try {
    const airlineExculsion = await prisma.excludedAirline.findMany();

    return res.status(200).json(airlineExculsion);
  } catch (error: any) {
    console.error(`Error`, error);
    return res.status(500).json({
      error,
    });
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
      return res.status(400).json({ error: `Iata field is required` });
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

    return res.status(201).json({ message: `IATA Code successfully updated` });
  } catch (error: any) {
    console.error(`Response: `, error);

    return res.status(500).json({ error: `Internal server error` });
  }
}

export async function deleteExclusion(
  req: Request,
  res: Response
): Promise<any> {
  try {
    let { iataCode } = req.params;

    if (!iataCode || typeof iataCode !== "string") {
      return res.status(400).json({ error: "IATA Code parameter is required" });
    }

    // Normalize IATA code: trim and uppercase
    iataCode = iataCode.trim().toUpperCase();

    // Check if the IATA code exists
    const existing = await prisma.excludedAirline.findUnique({
      where: { airlineCode: iataCode },
    });

    if (!existing) {
      return res
        .status(404)
        .json({ error: `IATA Code '${iataCode}' does not exist` });
    }

    // Delete the exclusion record
    await prisma.excludedAirline.delete({
      where: { airlineCode: iataCode },
    });

    return res
      .status(200)
      .json({ message: `IATA Code '${iataCode}' deleted successfully` });
  } catch (error: any) {
    console.error("Error deleting IATA exclusion:", error);
    return res.status(500).json({ error: "Internal server error" });
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

    res.status(201).json({ success: true, addon });
  } catch (error) {
    console.error("Create Addon Error:", error);
    res.status(500).json({ success: false, message: "Failed to create addon" });
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

    res.status(200).json({ success: true, addons });
  } catch (error) {
    console.error("Get Addons Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch addons" });
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

    res.status(200).json({ success: true, addon });
  } catch (error) {
    console.error("Update Addon Error:", error);
    res.status(500).json({ success: false, message: "Failed to update addon" });
  }
};

// Delete addon
export const deleteFlightAddon = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.flightAddon.delete({ where: { id } });
    res.status(200).json({ success: true, message: "Addon deleted" });
  } catch (error) {
    console.error("Delete Addon Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete addon" });
  }
};
