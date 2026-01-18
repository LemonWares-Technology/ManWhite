import { prisma } from "../lib/prisma";
import bcryptjs from "bcryptjs";
import { Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { addMinutes, isBefore } from "date-fns";
import { mapTravelerToAmadeusFormat } from "../utils/amadeusHelper";
import { sendVerificationEmail, sendVerificationToken } from "../utils/zeptomail";
import { sendSuccess, sendError } from "../utils/apiResponse";

export const createAccount = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendError(res, "Email is required", 400);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser && existingUser.verified) {
      return sendError(res, "Account with email address already exists", 400);
    }

    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const verificationCodeExpiresIn = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    let user;
    if (existingUser && !existingUser.verified) {
      // Resend code for unverified account
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          verificationCode,
          verificationCodeExpiresIn,
        },
      });
    } else {
      // Create new account
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          verificationCode,
          verificationCodeExpiresIn,
          verified: false,
        },
      });
    }

    await sendVerificationEmail(user);

    const { password: _, ...hidePassword } = user;

    return sendSuccess(res, `Verification code sent to ${email}`, hidePassword, 201);
  } catch (error: any) {
    console.error("Create account error:", error);
    return sendError(res, "Error occurred during account creation", 500, error);
  }
};

export const verifyAccount = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return sendError(res, "Email and code are required", 400);
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return sendError(res, "Account not found", 404);
    }

    if (user.verified) {
      return sendError(res, "Account already verified", 400);
    }

    if (user.verificationCode !== code) {
      return sendError(res, "Invalid verification code", 400);
    }

    if (user.verificationCodeExpiresIn && isBefore(new Date(user.verificationCodeExpiresIn), new Date())) {
      return sendError(res, "Verification code has expired", 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verified: true,
        verificationCode: null,
        verificationCodeExpiresIn: null,
      },
    });

    return sendSuccess(res, "Account verified successfully", { userId: user.id });
  } catch (error: any) {
    console.error("Verify account error:", error);
    return sendError(res, "Error during verification", 500, error);
  }
};

// Helper: Generate Access and Refresh Tokens
const generateTokens = (user: any) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT as string,
    { expiresIn: "4h" }
  );
  
  const refreshToken = jwt.sign(
    { id: user.id },
    (process.env.JWT_REFRESH_SECRET || process.env.JWT) as string,
    { expiresIn: "7d" }
  );
  
  return { accessToken, refreshToken };
};

// Helper: Set JWT in HttpOnly cookies
const setTokenCookies = (res: Response, accessToken: string, refreshToken?: string) => {
  const isProduction = process.env.NODE_ENV === "production";
  
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 4 * 60 * 60 * 1000, // 4 hours
  });

  if (refreshToken) {
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }
};

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const createPassword: any = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, password } = req.body;

    if (!password || !passwordRegex.test(password)) {
      return sendError(res, "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.", 400);
    }

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return sendError(res, "Account does not exist", 404);
    }

    if (!user.verified) {
      return sendError(res, "Please verify your email before creating a password", 403);
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const { accessToken, refreshToken } = generateTokens(user);

    const newUser = await prisma.user.update({
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

    const { password: _, refreshToken: __, ...hideSensitive } = newUser;

    setTokenCookies(res, accessToken, refreshToken);

    return sendSuccess(res, "Profile and password created successfully", { ...hideSensitive, token: accessToken });
  } catch (error: any) {
    return sendError(res, "Error occurred while creating password", 500, error);
  }
};

export async function deleteUserById(
  req: Request,
  res: Response
): Promise<Response | any> {
  const { userId } = req.params;

  try {
    // Check if target user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existingUser) {
      return sendError(res, "User not found", 404);
    }

    // Delete user by ID directly
    await prisma.user.delete({ where: { id: userId } });

    return sendSuccess(res, "User deleted successfully", { userId });
  } catch (error: any) {
    console.error("User deletion error:", error);
    return sendError(res, "Internal server error", 500, error);
  }
}

export const loginAccount = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return sendError(res, "Account does not exist", 404);
    }

    // await sendLoginEmail(user)

    return sendSuccess(res, "Almost there...", user);
  } catch (error: any) {
    return sendError(res, "Error occurred during login", 500, error);
  }
};


export const checkPassword = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { email } = req.params;
    const { password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return sendError(res, "Account does not exist", 404);
    }

    const MAX_ATTEMPTS = 5;
    const LOCK_DURATION_MINUTES = 5;

    // Check if account is locked
    if (user.loginLockedUntil && isBefore(new Date(), user.loginLockedUntil)) {
      const minutesLeft = Math.ceil(
        (user.loginLockedUntil.getTime() - Date.now()) / 60000
      );
      return sendError(res, `Account is locked. Try again in ${minutesLeft} minute(s).`, 403);
    }

    const isPasswordCorrect = await bcryptjs.compare(
      password,
      user.password || ""
    );

    if (isPasswordCorrect) {
      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user);

      // Reset loginAttempts and update login metadata
      await prisma.user.update({
        where: { email },
        data: {
          loginAttempts: 0,
          loginLockedUntil: null,
          refreshToken,
          lastLoginAt: new Date(),
          lastActiveAt: new Date(),
        },
      });

      setTokenCookies(res, accessToken, refreshToken);

      const { password: _, refreshToken: __, ...hideSensitive } = user;

      return sendSuccess(res, "Logged in successfully", { ...hideSensitive, token: accessToken });
    } else {
      const updatedUser = await prisma.user.update({
        where: { email },
        data: {
          loginAttempts: {
            increment: 1,
          },
        },
      });

      if (updatedUser.loginAttempts >= MAX_ATTEMPTS) {
        const lockUntil = addMinutes(new Date(), LOCK_DURATION_MINUTES);

        await prisma.user.update({
          where: { email },
          data: {
            loginLockedUntil: lockUntil,
          },
        });

        return sendError(res, `Account locked due to too many failed attempts. Try again in ${LOCK_DURATION_MINUTES} minutes.`, 403);
      }

      const remaining = MAX_ATTEMPTS - updatedUser.loginAttempts;
      return sendError(res, `Incorrect password. ${remaining} attempt(s) remaining.`, 400);
    }
  } catch (error: any) {
    return sendError(res, "Error occurred validating password", 500, error);
  }
};

export const requestPasswordReset = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { email } = req.body;

  if (!email) {
    return sendError(res, "Email is required.", 400);
  }

  try {
    const user = await prisma.user.findUnique({
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
      console.log(
        `[requestPasswordReset] User with email ${email} not found. Sending generic success message.`
      );

      return sendSuccess(res, "If an account with that email exists, a password reset code has been sent.");
    }

    const recoveryCode = crypto.randomInt(100000, 999999).toString();
    const recoveryCodeExpiresIn = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Perform the update and capture the result
    const updatedUser = await prisma.user.update({
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

    await sendVerificationToken(updatedUser);
    return sendSuccess(res, "If an account with that email exists, a password reset code has been sent.");
  } catch (error: any) {
    return sendError(res, "Internal server error", 500, error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { recoveryCode, newPassword } = req.body;

  // Log incoming request body for debugging

  if (!recoveryCode || !newPassword) {
    return sendError(res, "Recovery code and new password are required.", 400);
  }

  try {
    const currentTime = new Date();

    const user = await prisma.user.findFirst({
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
        console.warn(
          `[resetPassword] LOGIC ALERT: Mismatch detected! DB recovery code "${user.recoveryCode}" vs Request recovery code "${recoveryCode}". This indicates an issue with the Prisma query or data consistency.`
        );
      }

      if (
        user.recoveryCodeExpiresIn &&
        user.recoveryCodeExpiresIn < currentTime
      ) {
        console.warn(
          `[resetPassword] LOGIC ALERT: DB recovery code expired (${user.recoveryCodeExpiresIn.toISOString()}) but user was found. This indicates an issue with the Prisma query's date comparison.`
        );
      }
    } else {
      console.log(
        `[resetPassword] No user found with provided recovery code and valid expiry.`
      );
    }

    if (!user) {
      return sendError(res, "Invalid or expired recovery code.", 400);
    }

    // Hash the new password
    const hashedPassword = await bcryptjs.hash(newPassword, 10);

    // Update the user's password and clear recovery details
    const updatedUser = await prisma.user.update({
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

    return sendSuccess(res, "Password has been reset successfully.");
  } catch (error: any) {
    console.error(`[resetPassword] Internal server error during password reset:`, error);
    return sendError(res, "Internal server error", 500, error);
  }
};

export const createNewPassword = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return sendError(res, "Account not found", 404);
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const newUser = await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
      },
    });

    const { password: _, ...hidePassword } = newUser;

    return sendSuccess(res, "Password updated successfully", hidePassword);
  } catch (error: any) {
    return sendError(res, "Error occurred while creating new password", 500, error);
  }
};

export const getSingleUserAccount = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
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
      return sendError(res, "Account does not exist", 404);
    }

    const { password: _, ...hidePassword } = user;

    return sendSuccess(res, "Details gotten successfully", hidePassword);
  } catch (error: any) {
    return sendError(res, "Error occurred while getting user details", 500, error);
  }
};

export const getAllAccounts = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const users = await prisma.user.findMany({
      include: { cart: true, bookings: true },
    });

    return sendSuccess(res, `${users?.length} Account(s) gotten successfully`, users);
  } catch (error: any) {
    return sendError(res, "Error occurred while getting all accounts", 500, error);
  }
};

export const updateuserAccountDetails = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;
    const {
      firstName,
      nationality,
      lastName,
      dob,
      passportNo,
      passportExpiry,
      gender,
      phone,
    } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return sendError(res, "Account does not exist", 404);
    }

    if (user) {
      const newUser = await prisma.user.update({
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

      const { password: _, ...hidePassword } = newUser;

      return sendSuccess(res, "Account updated successfully", hidePassword);
    }
  } catch (error: any) {
    return sendError(res, "Error occurred while updating account", 500, error);
  }
};

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

export const createTraveler = async (
  req: Request,
  res: Response
): Promise<Response | any> => {
  try {
    const {
      flightOfferId,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      email,
      phone,
      countryCode,
      birthPlace,
      passportNumber,
      passportExpiry,
      issuanceCountry,
      validityCountry,
      nationality,
      issuanceDate,
      issuanceLocation,
    } = req.body;

    // Validate flight offer exists if provided
    if (flightOfferId) {
      const exists = await prisma.flightOffer.findUnique({
        where: { id: flightOfferId },
      });
      if (!exists) {
        return sendError(res, "Invalid flightOfferId", 400);
      }
    }

    const newTraveler = await prisma.traveler.create({
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

    return sendSuccess(res, "Traveler created successfully", newTraveler, 201);
  } catch (error: any) {
    console.error("Error creating traveler:", error);
    return sendError(res, "Server error", 500, error);
  }
};

// Endpoint to get all travelers formatted for Amadeus booking
export const getTravelersForAmadeusBooking = async (
  req: Request,
  res: Response
): Promise<Response | any> => {
  try {
    const { flightOfferId } = req.query;

    if (!flightOfferId || typeof flightOfferId !== "string") {
      return sendError(res, "flightOfferId query parameter is required", 400);
    }

    const travelers = await prisma.traveler.findMany({
      where: { flightOfferId },
      orderBy: { createdAt: "asc" },
    });

    const amadeusTravelers = travelers.map((traveler, index) =>
      mapTravelerToAmadeusFormat(traveler, traveler.id || index + 1)
    );

    return sendSuccess(res, "Travelers formatted for Amadeus booking retrieved successfully", amadeusTravelers);
  } catch (error: any) {
    console.error("Error fetching travelers for Amadeus booking:", error);
    return sendError(res, "Server error", 500, error);
  }
};

// Endpoint to get one traveler formatted for Amadeus booking
export const getTravelerForAmadeusBooking = async (
  req: Request,
  res: Response
): Promise<Response | any> => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, "Traveler ID is required", 400);
    }

    const traveler = await prisma.traveler.findUnique({
      where: { id },
    });

    if (!traveler) {
      return sendError(res, "Traveler not found", 404);
    }

    const amadeusTraveler = mapTravelerToAmadeusFormat(traveler, traveler.id); // ID can be "1" or traveler.id as string
    console.log("Raw traveler from DB:", traveler);
    console.log("Mapped Amadeus traveler:", amadeusTraveler);

    return sendSuccess(res, "Traveler formatted for Amadeus booking retrieved successfully", amadeusTraveler);
  } catch (error: any) {
    console.error("Error fetching traveler for Amadeus booking:", error);
    return sendError(res, "Server error", 500, error);
  }
};

// Get all travelers
export const getAllTravelers = async (
  req: Request,
  res: Response
): Promise<Response | any> => {
  try {
    const travelers = await prisma.traveler.findMany({
      orderBy: { createdAt: "desc" },
    });

    return sendSuccess(res, "Travelers retrieved successfully", travelers);
  } catch (error: any) {
    console.error("Error fetching travelers:", error);
    return sendError(res, "Server error", 500, error);
  }
};

// Get traveler by ID
export const getTravelerById = async (
  req: Request,
  res: Response
): Promise<Response | any> => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, "Traveler ID is required", 400);
    }

    const traveler = await prisma.traveler.findUnique({
      where: { id },
    });

    if (!traveler) {
      return sendError(res, "Traveler not found", 404);
    }

    return sendSuccess(res, "Traveler retrieved successfully", traveler);
  } catch (error: any) {
    console.error("Error fetching traveler:", error);
    return sendError(res, "Server error", 500, error);
  }
};

export const updateTravelerDetails = async (
  req: Request,
  res: Response
): Promise<Response | any> => {
  try {
    const { id } = req.params;
    const {
      flightOfferId,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      email,
      phone,
      countryCode,
      birthPlace,
      passportNumber,
      passportExpiry,
      issuanceCountry,
      validityCountry,
      nationality,
      issuanceDate,
      issuanceLocation,
    } = req.body;

    if (!id) {
      return sendError(res, "Traveler ID is required", 400);
    }

    // Verify traveler exists
    const existingTraveler = await prisma.traveler.findUnique({
      where: { id },
    });

    if (!existingTraveler) {
      return sendError(res, "Traveler not found", 404);
    }

    // Validate flight offer exists if provided
    if (flightOfferId) {
      const exists = await prisma.flightOffer.findUnique({
        where: { id: flightOfferId },
      });
      if (!exists) {
        return sendError(res, "Invalid flightOfferId", 400);
      }
    }

    const updatedTraveler = await prisma.traveler.update({
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

    return sendSuccess(res, "Traveler updated successfully", updatedTraveler);
  } catch (error: any) {
    console.error("Error updating traveler:", error);
    return sendError(res, "Server error", 500, error);
  }
};

// POST /api/guest-user
export async function createGuestUser(
  req: Request,
  res: Response
): Promise<Response | any> {
  const {
    email,
    firstName,
    lastName,
    phone,
    address,
    postalCode,
    city,
    country,
  } = req.body;

  if (!email || !firstName || !lastName) {
    return sendError(res, "Missing required guest fields", 400);
  }

  try {
    // Check if guest already exists
    let guest = await prisma.guestUser.findUnique({ where: { email } });

    if (!guest) {
      guest = await prisma.guestUser.create({
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

    return sendSuccess(res, "Guest user created/found successfully", guest, 201);
  } catch (error: any) {
    console.error("Error creating guest user:", error);
    return sendError(res, "Server error", 500, error);
  }
}

// GET /api/guest-users
export async function getAllGuestUsers(
  req: Request,
  res: Response
): Promise<Response | any> {
  try {
    const guests = await prisma.guestUser.findMany();
    return sendSuccess(res, "Guest users fetched successfully", guests);
  } catch (error: any) {
    console.error("Error fetching guest users:", error);
    return sendError(res, "Server error", 500, error);
  }
}

// GET /api/guest-users/:id
export async function getGuestUserById(
  req: Request,
  res: Response
): Promise<Response | any> {
  const { id } = req.params;

  try {
    const guest = await prisma.guestUser.findUnique({ where: { id } });
    if (!guest) {
      return sendError(res, "Guest user not found", 404);
    }
    return sendSuccess(res, "Guest user fetched successfully", guest);
  } catch (error: any) {
    console.error("Error fetching guest user:", error);
    return sendError(res, "Server error", 500, error);
  }
}

export const logout: any = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.cookies;
    if (refreshToken) {
      await prisma.user.updateMany({
        where: { refreshToken },
        data: { refreshToken: null },
      });
    }

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    return sendSuccess(res, "Logged out successfully");
  } catch (error: any) {
    return sendError(res, "Logout failed", 500, error);
  }
};

export const refreshTokens: any = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return sendError(res, "Refresh token missing", 401);
    }

    const decoded = jwt.verify(
      refreshToken,
      (process.env.JWT_REFRESH_SECRET || process.env.JWT) as string
    ) as { id: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || user.refreshToken !== refreshToken) {
      return sendError(res, "Invalid or rotated refresh token", 403);
    }

    const tokens = generateTokens(user);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: tokens.refreshToken,
        lastActiveAt: new Date(),
      },
    });

    setTokenCookies(res, tokens.accessToken, tokens.refreshToken);

    return sendSuccess(res, "Tokens refreshed successfully", { token: tokens.accessToken });
  } catch (error: any) {
    console.error("Refresh token error:", error);
    return sendError(res, "Expired or invalid refresh token", 403, error);
  }
};
