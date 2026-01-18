import { prisma } from "../lib/prisma";
import { Request, Response } from "express";
import axios from "axios";
import getAmadeusToken from "../utils/getToken";
import {
  extractCarAmadeusReference,
  extractCarCurrency,
  extractCarTotalAmount,
  generateCarBookingReference,
} from "../utils/helper";

const baseURL: string = "https://test.api.amadeus.com";

export async function searchCars(req: Request, res: Response): Promise<any> {
  try {
    const { data } = req.body;

    // Get user context from request (adjust based on your auth implementation)
    const currentUserId = req.User?.id || null; // Assuming you have user in req from auth middleware

    if (!data) {
      return res.status(400).json({
        error: "Missing booking data",
      });
    }

    // Validate required fields for car booking
    if (
      !data.startLocationCode ||
      !data.endAddressLine ||
      !data.startDateTime
    ) {
      return res.status(400).json({
        error:
          "Required fields missing: startLocationCode, endAddressLine, and startDateTime are required",
      });
    }

    if (!data.passengers || data.passengers < 1) {
      return res.status(400).json({
        error: "At least one passenger is required",
      });
    }

    if (
      !data.passengerCharacteristics ||
      data.passengerCharacteristics.length === 0
    ) {
      return res.status(400).json({
        error: "Passenger characteristics are required",
      });
    }

    // Get Amadeus access token
    const token = await getAmadeusToken();

    // Prepare the booking payload for Amadeus
    const bookingPayload = {
      data: {
        startLocationCode: data.startLocationCode,
        endAddressLine: data.endAddressLine,
        endCityName: data.endCityName,
        endZipCode: data.endZipCode,
        endCountryCode: data.endCountryCode,
        endName: data.endName,
        endGeoCode: data.endGeoCode,
        transferType: data.transferType || "PRIVATE",
        startDateTime: data.startDateTime,
        passengers: data.passengers,
        stopOvers: data.stopOvers || [],
        startConnectedSegment: data.startConnectedSegment || null,
        passengerCharacteristics: data.passengerCharacteristics,
        // Add any additional fields as needed
        contactInfo: data.contactInfo || null,
        paymentInfo: data.paymentInfo || null,
      },
    };

    // Make booking request to Amadeus
    const amadeusResponse: any = await axios.post(
      `${
        process.env.AMADEUS_BASE_URL || `${baseURL}`
      }/v1/shopping/transfer-offers`,
      bookingPayload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Extract passenger information (assuming first passenger is primary contact)
    const primaryPassenger = data.passengerCharacteristics[0];
    const contactEmail =
      data.contactInfo?.email || `passenger${Date.now()}@temp.com`; // Fallback if no email

    let userId: string | null = null;
    let guestUserId: string | null = null;

    // If we have a current user and their email matches, use their ID
    if (currentUserId) {
      const currentUser = await prisma.user.findUnique({
        where: { id: currentUserId },
      });

      if (
        currentUser &&
        (currentUser.email === contactEmail || !data.contactInfo?.email)
      ) {
        userId = currentUserId;
      }
    }

    // If no user match, try to find existing user by email
    if (!userId && data.contactInfo?.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: contactEmail },
      });

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create or update guest user
        const guestUser = await prisma.guestUser.upsert({
          where: { email: contactEmail },
          update: {
            firstName: data.contactInfo?.firstName || "Guest",
            lastName: data.contactInfo?.lastName || "User",
            phone: data.contactInfo?.phone || null,
            address: data.endAddressLine,
            city: data.endCityName,
            postalCode: data.endZipCode,
            country: data.endCountryCode,
          },
          create: {
            email: contactEmail,
            firstName: data.contactInfo?.firstName || "Guest",
            lastName: data.contactInfo?.lastName || "User",
            phone: data.contactInfo?.phone || null,
            address: data.endAddressLine,
            city: data.endCityName,
            postalCode: data.endZipCode,
            country: data.endCountryCode,
          },
        });
        guestUserId = guestUser.id;
      }
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Clear user's cart if they are logged in
      if (userId) {
        await tx.flightCart.deleteMany({
          where: { userId },
        });
      }

      // 2. Create booking in database
      const booking = await tx.booking.create({
        data: {
          userId: userId,
          guestUserId: guestUserId,
          referenceId: generateCarBookingReference(),
          type: "CAR",
          status: "CONFIRMED", // Assuming successful Amadeus booking means confirmed
          apiResponse: amadeusResponse.data,
          bookingDetails: {
            startLocationCode: data.startLocationCode,
            startDateTime: data.startDateTime,
            endLocation: {
              addressLine: data.endAddressLine,
              cityName: data.endCityName,
              zipCode: data.endZipCode,
              countryCode: data.endCountryCode,
              name: data.endName,
              geoCode: data.endGeoCode,
            },
            transferType: data.transferType || "PRIVATE",
            passengers: data.passengers,
            passengerCharacteristics: data.passengerCharacteristics,
            stopOvers: data.stopOvers || [],
            startConnectedSegment: data.startConnectedSegment || null,
            contactInfo: data.contactInfo || null,
          },
          totalAmount: extractCarTotalAmount(amadeusResponse),
          currency: extractCarCurrency(amadeusResponse),
          apiProvider: "AMADEUS",
          apiReferenceId: extractCarAmadeusReference(amadeusResponse),
          locationDetails: {
            pickup: {
              code: data.startLocationCode,
              dateTime: data.startDateTime,
            },
            dropoff: {
              address: data.endAddressLine,
              city: data.endCityName,
              country: data.endCountryCode,
            },
          },
          verified: true, // Assuming Amadeus booking is verified
        },
      });

      // 3. Create traveler records for each passenger characteristic
      const travelerPromises = data.passengerCharacteristics.map(
        (passenger: any, index: number) => {
          return tx.traveler.create({
            data: {
              bookingId: booking.id,
              userId: userId,
              guestUserId: guestUserId,
              firstName:
                data.contactInfo?.firstName || `Passenger ${index + 1}`,
              lastName: data.contactInfo?.lastName || "",
              email: contactEmail,
              phone: data.contactInfo?.phone || "",
              countryCode: data.endCountryCode || "",
              gender: passenger.passengerTypeCode === "ADT" ? "OTHER" : "OTHER", // Default since we don't have gender info
              dateOfBirth: passenger.age
                ? new Date(new Date().getFullYear() - passenger.age, 0, 1)
                : new Date("1990-01-01"), // Calculate approximate birth year from age
              // Add other fields as available
            },
          });
        }
      );

      await Promise.all(travelerPromises);

      // 4. Fetch the complete booking with relations
      const completeBooking = await tx.booking.findUnique({
        where: { id: booking.id },
        include: {
          user: true,
          guestUser: true,
          travelers: true,
        },
      });

      return completeBooking;
    });

    // Return success response
    return res.status(201).json({
      success: true,
      message: userId
        ? "Car transfer booking completed successfully and cart cleared"
        : "Car transfer booking completed successfully",
      booking: {
        id: result?.id,
        referenceId: result?.referenceId,
        status: result?.status,
        type: result?.type,
        totalAmount: result?.totalAmount,
        currency: result?.currency,
        apiReferenceId: result?.apiReferenceId,
        createdAt: result?.createdAt,
        bookingDetails: result?.bookingDetails,
        travelers: result?.travelers,
      },
      amadeusResponse: amadeusResponse.data,
      cartCleared: userId ? true : false, // Indicate if cart was cleared
    });
  } catch (error: any) {
    console.error(
      "Error booking car transfer:",
      error.response?.data || error.message
    );

    // If it's an Amadeus API error, return specific error
    if (error.response?.data) {
      return res.status(error.response.status || 500).json({
        error: "Amadeus API Error",
        details: error.response.data,
        message:
          error.response.data.error_description ||
          error.response.data.message ||
          "Car transfer booking failed",
      });
    }

    // If it's a database error
    if (error.code === "P2002") {
      return res.status(409).json({
        error: "Booking reference already exists",
        message: "Please try again",
      });
    }

    // Generic error
    return res.status(500).json({
      error: "Internal server error",
      message: error.message || "An unexpected error occurred",
    });
  } finally {
    // Clean up Prisma connection
    await prisma.$disconnect();
  }
}

// Rename your existing function to bookCarTransfer
export async function bookCarTransfer(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { data } = req.body;

    // Get user context from request (adjust based on your auth implementation)
    const currentUserId = req.User?.id || null;

    if (!data) {
      return res.status(400).json({
        error: "Missing booking data",
      });
    }

    // Validate required fields for car booking
    if (
      !data.offerId ||
      !data.startLocationCode ||
      !data.endAddressLine ||
      !data.startDateTime
    ) {
      return res.status(400).json({
        error:
          "Required fields missing: offerId, startLocationCode, endAddressLine, and startDateTime are required",
      });
    }

    if (!data.passengers || data.passengers < 1) {
      return res.status(400).json({
        error: "At least one passenger is required",
      });
    }

    if (
      !data.passengerCharacteristics ||
      data.passengerCharacteristics.length === 0
    ) {
      return res.status(400).json({
        error: "Passenger characteristics are required",
      });
    }

    // Get Amadeus access token
    const token = await getAmadeusToken();

    // Prepare the booking payload for Amadeus
    const bookingPayload = {
      data: {
        offerId: data.offerId, // This should come from the search results
        startLocationCode: data.startLocationCode,
        endAddressLine: data.endAddressLine,
        endCityName: data.endCityName,
        endZipCode: data.endZipCode,
        endCountryCode: data.endCountryCode,
        endName: data.endName,
        endGeoCode: data.endGeoCode,
        transferType: data.transferType || "PRIVATE",
        startDateTime: data.startDateTime,
        passengers: data.passengers,
        stopOvers: data.stopOvers || [],
        startConnectedSegment: data.startConnectedSegment || null,
        passengerCharacteristics: data.passengerCharacteristics,
        contactInfo: data.contactInfo || null,
        paymentInfo: data.paymentInfo || null,
      },
    };

    // Make booking request to Amadeus (this would typically be a POST to a booking endpoint)
    const amadeusResponse: any = await axios.post(
      `${process.env.AMADEUS_BASE_URL || baseURL}/v1/booking/transfer-orders`,
      bookingPayload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Extract passenger information (assuming first passenger is primary contact)
    const primaryPassenger = data.passengerCharacteristics[0];
    const contactEmail =
      data.contactInfo?.email || `passenger${Date.now()}@temp.com`;

    let userId: string | null = null;
    let guestUserId: string | null = null;

    // If we have a current user and their email matches, use their ID
    if (currentUserId) {
      const currentUser = await prisma.user.findUnique({
        where: { id: currentUserId },
      });

      if (
        currentUser &&
        (currentUser.email === contactEmail || !data.contactInfo?.email)
      ) {
        userId = currentUserId;
      }
    }

    // If no user match, try to find existing user by email
    if (!userId && data.contactInfo?.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: contactEmail },
      });

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create or update guest user
        const guestUser = await prisma.guestUser.upsert({
          where: { email: contactEmail },
          update: {
            firstName: data.contactInfo?.firstName || "Guest",
            lastName: data.contactInfo?.lastName || "User",
            phone: data.contactInfo?.phone || null,
            address: data.endAddressLine,
            city: data.endCityName,
            postalCode: data.endZipCode,
            country: data.endCountryCode,
          },
          create: {
            email: contactEmail,
            firstName: data.contactInfo?.firstName || "Guest",
            lastName: data.contactInfo?.lastName || "User",
            phone: data.contactInfo?.phone || null,
            address: data.endAddressLine,
            city: data.endCityName,
            postalCode: data.endZipCode,
            country: data.endCountryCode,
          },
        });
        guestUserId = guestUser.id;
      }
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Clear user's cart if they are logged in
      if (userId) {
        await tx.flightCart.deleteMany({
          where: { userId },
        });
      }

      // 2. Create booking in database
      const booking = await tx.booking.create({
        data: {
          userId: userId,
          guestUserId: guestUserId,
          referenceId: generateCarBookingReference(),
          type: "CAR",
          status: "CONFIRMED",
          apiResponse: amadeusResponse.data,
          bookingDetails: {
            offerId: data.offerId,
            startLocationCode: data.startLocationCode,
            startDateTime: data.startDateTime,
            endLocation: {
              addressLine: data.endAddressLine,
              cityName: data.endCityName,
              zipCode: data.endZipCode,
              countryCode: data.endCountryCode,
              name: data.endName,
              geoCode: data.endGeoCode,
            },
            transferType: data.transferType || "PRIVATE",
            passengers: data.passengers,
            passengerCharacteristics: data.passengerCharacteristics,
            stopOvers: data.stopOvers || [],
            startConnectedSegment: data.startConnectedSegment || null,
            contactInfo: data.contactInfo || null,
          },
          totalAmount: extractCarTotalAmount(amadeusResponse),
          currency: extractCarCurrency(amadeusResponse),
          apiProvider: "AMADEUS",
          apiReferenceId: extractCarAmadeusReference(amadeusResponse),
          locationDetails: {
            pickup: {
              code: data.startLocationCode,
              dateTime: data.startDateTime,
            },
            dropoff: {
              address: data.endAddressLine,
              city: data.endCityName,
              country: data.endCountryCode,
            },
          },
          verified: true,
        },
      });

      // 3. Create traveler records for each passenger characteristic
      const travelerPromises = data.passengerCharacteristics.map(
        (passenger: any, index: number) => {
          return tx.traveler.create({
            data: {
              bookingId: booking.id,
              userId: userId,
              guestUserId: guestUserId,
              firstName:
                data.contactInfo?.firstName || `Passenger ${index + 1}`,
              lastName: data.contactInfo?.lastName || "",
              email: contactEmail,
              phone: data.contactInfo?.phone || "",
              countryCode: data.endCountryCode || "",
              gender: passenger.passengerTypeCode === "ADT" ? "OTHER" : "OTHER",
              dateOfBirth: passenger.age
                ? new Date(new Date().getFullYear() - passenger.age, 0, 1)
                : new Date("1990-01-01"),
            },
          });
        }
      );

      await Promise.all(travelerPromises);

      // 4. Fetch the complete booking with relations
      const completeBooking = await tx.booking.findUnique({
        where: { id: booking.id },
        include: {
          user: true,
          guestUser: true,
          travelers: true,
        },
      });

      return completeBooking;
    });

    // Return success response
    return res.status(201).json({
      success: true,
      message: userId
        ? "Car transfer booking completed successfully and cart cleared"
        : "Car transfer booking completed successfully",
      booking: {
        id: result?.id,
        referenceId: result?.referenceId,
        status: result?.status,
        type: result?.type,
        totalAmount: result?.totalAmount,
        currency: result?.currency,
        apiReferenceId: result?.apiReferenceId,
        createdAt: result?.createdAt,
        bookingDetails: result?.bookingDetails,
        travelers: result?.travelers,
      },
      amadeusResponse: amadeusResponse.data,
      cartCleared: userId ? true : false,
    });
  } catch (error: any) {
    console.error(
      "Error booking car transfer:",
      error.response?.data || error.message
    );

    if (error.response?.data) {
      return res.status(error.response.status || 500).json({
        error: "Amadeus API Error",
        details: error.response.data,
        message:
          error.response.data.error_description ||
          error.response.data.message ||
          "Car transfer booking failed",
      });
    }

    if (error.code === "P2002") {
      return res.status(409).json({
        error: "Booking reference already exists",
        message: "Please try again",
      });
    }

    return res.status(500).json({
      error: "Internal server error",
      message: error.message || "An unexpected error occurred",
    });
  } finally {
    await prisma.$disconnect();
  }
}
