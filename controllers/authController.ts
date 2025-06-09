import { GuestUser } from './../node_modules/.prisma/client/index.d';
import bcryptjs from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { sendResetPassword, sendVerification } from "../config/emailServices";
import jwt from "jsonwebtoken";
import { addMinutes, isBefore } from "date-fns";
import { mapTravelerToAmadeusFormat } from "../utils/amadeusHelper";

const prisma = new PrismaClient();

export const createAccount = async (
  req: Request,
  res: Response
): Promise<any> => {
  const generateAuthenticationCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: email },
    });

    if (user) {
      return res.status(400).json({
        message: `Account with email address already exists`,
      });
    }

    const verificationCodeExpiresIn = new Date(
      Date.now() + 10 * 60 * 1000
    ).toISOString();

    const newUser = await prisma.user.create({
      data: {
        email: email,
        verificationCode: generateAuthenticationCode(),
        verificationCodeExpiresIn,
        verified: true,
      },
    });

    // await sendVerification(newUser);

    const { password: _, ...hidePassword } = newUser;

    return res.status(201).json({
      message: `Account created successfully`,
      data: hidePassword,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: `Error occured during account creation: ${error?.message}`,
      data: error,
    });
  }
};

export const createPassword: any = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, password } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return res.status(404).json({
        message: `Account does not exist`,
      });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const newUser = await prisma.user.update({
      where: { id },
      data: {
        firstName,
        lastName,
        password: hashedPassword,
      },
    });

    const { password: _, ...hidePassword } = newUser;

    return res.status(200).json({
      message: `Password created successfully`,
      data: hidePassword,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: `Error occured while creating password`,
      data: error?.message,
    });
  }
};

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
      return res.status(404).json({
        message: `Account does not exist`,
      });
    }

    // await sendLoginEmail(user)

    return res.status(200).json({
      message: `Almost there...`,
      data: user,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: `Error occured during login`,
      data: error?.message,
    });
  }
};

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

export const checkPassword = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { email } = req.params;
    const { password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({
        message: `Account does not exist`,
      });
    }

    const MAX_ATTEMPTS = 5;
    const LOCK_DURATION_MINUTES = 5;

    // Check if account is locked
    if (user.loginLockedUntil && isBefore(new Date(), user.loginLockedUntil)) {
      const minutesLeft = Math.ceil(
        (user.loginLockedUntil.getTime() - Date.now()) / 60000
      );
      return res.status(403).json({
        message: `Account is locked. Try again in ${minutesLeft} minute(s).`,
      });
    }

    const isPasswordCorrect = await bcryptjs.compare(
      password,
      user.password || ""
    );

    if (isPasswordCorrect) {
      // Reset loginAttempts and lock time on success
      await prisma.user.update({
        where: { email },
        data: {
          loginAttempts: 0,
          loginLockedUntil: null,
        },
      });

      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT as string,
        { expiresIn: "24h" }
      );

      return res.status(200).json({
        message: `Logged in successfully`,
        data: {
          ...user,
          token,
        },
      });
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

        return res.status(403).json({
          message: `Account locked due to too many failed attempts. Try again in ${LOCK_DURATION_MINUTES} minutes.`,
        });
      }

      const remaining = MAX_ATTEMPTS - updatedUser.loginAttempts;
      return res.status(400).json({
        message: `Incorrect password. ${remaining} attempt(s) remaining.`,
      });
    }
  } catch (error: any) {
    return res.status(500).json({
      message: `Error occurred validating password`,
      data: error?.message,
    });
  }
};

export const resetPassword = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({
        message: `Account does not exist`,
      });
    }

    await sendResetPassword(user);

    return res.status(200).json({
      message: `Resetting password...`,
      data: user,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: `Error occured while resetting password`,
      data: error?.message,
    });
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
      return res.status(404).json({
        message: `Account not found`,
      });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const newUser = await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
      },
    });

    const { password: _, ...hidePassword } = newUser;

    return res.status(200).json({
      message: `Password updated successfully`,
      data: hidePassword,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: `Error occured while creating new password`,
      data: error?.message,
    });
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
      return res.status(400).json({
        message: `Account does not exist`,
      });
    }

    const { password: _, ...hidePassword } = user;

    return res.status(200).json({
      message: `Details gotten successfully`,
      data: hidePassword,
    });
  } catch (error: any) {
    throw new Error(error?.response?.data?.message);
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

    return res.status(200).json({
      message: `${users?.length} Accounts(s) gotten successfully`,
      data: users,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: `Error occured while getting all accounts`,
      data: error?.message,
    });
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
      return res.status(404).json({
        message: `Account does not exist`,
      });
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

      return res.status(200).json({
        message: `Account updated successfully`,
        data: hidePassword,
      });
    }
  } catch (error: any) {
    return res.status(500).json({
      message: `Error occured while updating account`,
      data: error?.message,
    });
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
        return res.status(400).json({ message: "Invalid flightOfferId" });
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

    return res.status(201).json({
      message: "Traveler created successfully",
      traveler: newTraveler,
    });
  } catch (error: any) {
    console.error("Error creating traveler:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
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
      return res.status(400).json({ message: "flightOfferId query parameter is required" });
    }

    const travelers = await prisma.traveler.findMany({
      where: { flightOfferId },
      orderBy: { createdAt: "asc" },
    });

    const amadeusTravelers = travelers.map((traveler, index) =>
      mapTravelerToAmadeusFormat(traveler, traveler.id||index +1)
    );

    return res.status(200).json({
      message: "Travelers formatted for Amadeus booking retrieved successfully",
      travelers: amadeusTravelers,
    });
  } catch (error: any) {
    console.error("Error fetching travelers for Amadeus booking:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
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
      return res.status(400).json({ message: "Traveler ID is required" });
    }

    const traveler = await prisma.traveler.findUnique({
      where: { id },
    });

    if (!traveler) {
      return res.status(404).json({ message: "Traveler not found" });
    }

   const amadeusTraveler = mapTravelerToAmadeusFormat(traveler, traveler.id);
; // ID can be "1" or traveler.id as string
console.log("Raw traveler from DB:", traveler);
console.log("Mapped Amadeus traveler:", amadeusTraveler);

    return res.status(200).json({
      message: "Traveler formatted for Amadeus booking retrieved successfully",
      traveler: amadeusTraveler,
    });
  } catch (error: any) {
    console.error("Error fetching traveler for Amadeus booking:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
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

    return res.status(200).json({
      message: "Travelers retrieved successfully",
      data: travelers,
    });
  } catch (error: any) {
    console.error("Error fetching travelers:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
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
      return res.status(400).json({ message: "Traveler ID is required" });
    }

    const traveler = await prisma.traveler.findUnique({
      where: { id },
    });

    if (!traveler) {
      return res.status(404).json({ message: "Traveler not found" });
    }

    return res.status(200).json({
      message: "Traveler retrieved successfully",
      data: traveler,
    });
  } catch (error: any) {
    console.error("Error fetching traveler:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
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
      return res.status(400).json({ message: "Traveler ID is required" });
    }

    // Verify traveler exists
    const existingTraveler = await prisma.traveler.findUnique({
      where: { id },
    });
    
    if (!existingTraveler) {
      return res.status(404).json({ message: "Traveler not found" });
    }

    // Validate flight offer exists if provided
    if (flightOfferId) {
      const exists = await prisma.flightOffer.findUnique({
        where: { id: flightOfferId },
      });
      if (!exists) {
        return res.status(400).json({ message: "Invalid flightOfferId" });
      }
    }

    const updatedTraveler = await prisma.traveler.update({
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
  } catch (error: any) {
    console.error("Error updating traveler:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// POST /api/guest-user
export async function createGuestUser(req: Request, res: Response):Promise<Response |any> {
  const { email, firstName, lastName, phone, address, postalCode, city, country } = req.body;

  if (!email || !firstName || !lastName) {
    return res.status(400).json({ error: "Missing required guest fields" });
  }

  try {
    // Check if guest already exists
    let guest = await prisma.guestUser.findUnique({ where: { email } });

    if (!guest) {
      guest = await prisma.guestUser.create({
        data: { email, firstName, lastName, phone, address, postalCode, city, country }
      });
    }

    return res.status(201).json({ guestUserId: guest.id, guest });
  } catch (error: any) {
    console.error("Error creating guest user:", error);
    return res.status(500).json({ error: "Server error" });
  }
}

// GET /api/guest-users
export async function getAllGuestUsers(req: Request, res: Response): Promise<Response|any> {
  try {
    const guests = await prisma.guestUser.findMany();
    return res.status(200).json({ guests });
  } catch (error: any) {
    console.error("Error fetching guest users:", error);
    return res.status(500).json({ error: "Server error" });
  }
}

// GET /api/guest-users/:id
export async function getGuestUserById(req: Request, res: Response): Promise<Response|any> {
  const { id } = req.params;

  try {
    const guest = await prisma.guestUser.findUnique({ where: { id } });
    if (!guest) {
      return res.status(404).json({ error: "Guest user not found" });
    }
    return res.status(200).json({ guest });
  } catch (error: any) {
    console.error("Error fetching guest user:", error);
    return res.status(500).json({ error: "Server error" });
  }
}
