import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import axios from "axios";
import getAmadeusToken from "../utils/getToken";
import env from "dotenv";
env.config();

const prisma = new PrismaClient();

const baseURL: string = "https://test.api.amadeus.com";

export const verifyFlightPrice = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { priceFlightOffersBody } = req.body;

    if (!priceFlightOffersBody) {
      return res.status(400).json({ message: "Missing flight offer data" });
    }

    const token = await getAmadeusToken();

    const response: any = axios.get(
      `${baseURL}/v1/shopping/flight-offers/pricing`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-HTTP-Method-Override": "GET",
        },
      }
    );

    return res.status(200).json({
      message: `Flight price verified successfully`,
      data: response,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Error verifying flight price",
      data: error?.message,
    });
  }
};

export const addFlightToCart = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { userId } = req.params;
    const { flightData } = req.body;

    if (!flightData) {
      return res.status(400).json({
        message: `Missing required parameter `,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        message: `User not found or does not exist`,
      });
    }

    const cartItem = await prisma.flightCart.create({
      data: {
        userId,
        flightData,
      },
    });

    return res.status(200).json({
      message: `Flight added to cart`,
      data: cartItem,
    });
  } catch (error: any) {
    console.log(`AMADEUS API: `, error?.response?.data);
    return res.status(500).json({
      message: `Error occured while adding flight to cart`,
      data: error?.message,
    });
  }
};

export const getUserCart = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found or does not exist",
      });
    }

    // Fetch all cart items for the user
    const cartItems = await prisma.flightCart.findMany({
      where: { userId },
    });

    return res.status(200).json({
      message: "User cart retrieved successfully",
      data: cartItems,
    });
  } catch (error: any) {
    console.error("Error fetching user cart:", error.message);
    return res.status(500).json({
      message: "Error occurred while fetching user cart",
      error: error.message,
    });
  }
};

export const removeFlightFromCart = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { cartId } = req.params;
  try {
    const cartItem = await prisma.flightCart.findUnique({
      where: { id: cartId },
    });

    if (!cartItem) {
      return res.status(404).json({
        message: `Item not found in cart`,
      });
    }

    await prisma.flightCart.delete({
      where: { id: cartId },
    });

    return res.status(200).json({
      message: `Flight removed from cart`,
    });
  } catch (error: any) {
    console.log(`AMADEUS API: `, error?.response?.data);
    return res.status(500).json({
      message: `Error occured while removing flight from cart`,
      data: error?.message,
    });
  }
};

// Remove all flights from a user's cart
export const emptyUserFlightCart = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { userId } = req.params;
  try {
    // Check if userId is provided
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Delete all cart items for this user
    await prisma.flightCart.deleteMany({
      where: { userId },
    });

    return res.status(200).json({
      message: "All flights removed from cart",
    });
  } catch (error: any) {
    console.log(`AMADEUS API: `, error?.response?.data);
    return res.status(500).json({
      message: "Error occurred while emptying cart",
      data: error?.message,
    });
  }
};

// export const getUserCart = async (
//   req: Request,
//   res: Response
// ): Promise<any> => {
//   const { userId } = req.params;

//   try {
//     // Optional: Check if user exists (uncomment if needed)
//     const user = await prisma.user.findUnique({ where: { id: userId } });
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     // Get all cart items for the user, ordered by creation date (latest first)
//     const cartItems = await prisma.flightCart.findMany({
//       where: { userId },
//       orderBy: { createdAt: "desc" },
//     });

//     return res.status(200).json({
//       message: "User cart fetched successfully",
//       data: cartItems,
//     });
//   } catch (error: any) {
//     console.error("Error fetching user cart:", error);
//     return res.status(500).json({
//       message: "Error occurred while fetching user cart",
//       error: error.message,
//     });
//   }
// };

export const bookFlight = async (req: any, res: any): Promise<any> => {
  try {
    const { transactionId } = req.params;
    const { travelers, guestInfo, flightOffer, data } = req.body;

    // Early check for transaction ID
    if (!transactionId) {
      return res
        .status(400)
        .json({ message: "Missing Flutterwave transaction ID" });
    }

    // Check if ANY booking exists for this transaction ID
    const existingBooking = await prisma.booking.findFirst({
      where: {
        apiReferenceId: transactionId,
      },
      include: {
        travelers: true,
      },
    });

    if (existingBooking) {
      console.log(`Found existing booking for transaction ${transactionId}`);
      return res.status(200).json({
        message: "Booking already exists for this transaction",
        bookings: [existingBooking],
      });
    }

    if (!travelers || !Array.isArray(travelers) || travelers.length === 0) {
      return res
        .status(400)
        .json({ message: "Travelers data missing or invalid" });
    }

    // 1. Verify payment with Flutterwave
    const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTER_SECRET!;
    const verifyUrl = `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`;

    if (!FLUTTERWAVE_SECRET_KEY || !verifyUrl) {
      return res.status(500).json({ message: "Server misconfiguration" });
    }

    const flutterwaveRes = await axios.get(verifyUrl, {
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
      },
    });

    const flutterwaveData: any = flutterwaveRes.data;

    if (
      !flutterwaveData ||
      flutterwaveData.status !== "success" ||
      flutterwaveData.data.status !== "successful"
    ) {
      return res.status(402).json({ message: "Payment not successful" });
    }

    // 2. Handle guest user creation if guestInfo is provided
    let guestUserId = null;
    if (guestInfo) {
      const guestUser = await prisma.guestUser.create({
        data: {
          email: guestInfo.email,
          firstName: guestInfo.firstName,
          lastName: guestInfo.lastName,
          phone: guestInfo.phone,
          address: guestInfo.address,
          postalCode: guestInfo.postalCode,
          city: guestInfo.city,
          country: guestInfo.country,
        },
      });
      guestUserId = guestUser.id;
    }

    // 3. Get Amadeus token once
    const token = await getAmadeusToken();

    // Helper function to fetch location details using query parameters
    async function getLocationDetails(iataCode: string) {
      try {
        const response: any = await axios.get(
          `${baseURL}/v1/reference-data/locations`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              keyword: iataCode,
              subType: "AIRPORT",
            },
          }
        );

        const locations = response.data.data;

        if (locations && locations.length > 0) {
          const exactMatch = locations.find(
            (loc: any) => loc.iataCode === iataCode
          );
          const location = exactMatch || locations[0];
          return location;
        } else {
          return null;
        }
      } catch (error: any) {
        return null;
      }
    }

    // Helper function to fetch airline details
    async function getAirlineDetails(
      codes: string[],
      token: string
    ): Promise<Record<string, string>> {
      try {
        if (codes.length === 0) return {};
        const response: any = await axios.get(
          `${baseURL}/v1/reference-data/airlines`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { airlineCodes: codes.join(",") },
          }
        );

        const airlines = response.data.data;
        const map: Record<string, string> = {};

        airlines.forEach((airline: any) => {
          map[airline.iataCode] =
            airline.commonName || airline.name || airline.iataCode;
        });

        return map;
      } catch (error: any) {
        const fallbackMap: Record<string, string> = {};
        codes.forEach((code) => (fallbackMap[code] = code));
        return fallbackMap;
      }
    }

    const bookings = [];

    // 4. Get flight offer(s) based on booking type
    let flightOffers = [];

    if (guestInfo) {
      // Guest booking - direct checkout with single flight
      if (!flightOffer) {
        return res
          .status(400)
          .json({ message: "Flight offer is required for guest booking" });
      }
      flightOffers = [flightOffer];
    } else {
      // Registered user - checkout from cart
      if (!req.user?.id) {
        return res
          .status(401)
          .json({ message: "Unauthorized: User ID missing" });
      }

      const cartItems = await prisma.flightCart.findMany({
        where: { userId: req.user.id },
      });

      if (cartItems.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      flightOffers = cartItems.map((item) => item.flightData);
    }

    // 5. Process each flight offer
    for (const flightOffer of flightOffers) {
      // Double check for existing booking before processing
      const doubleCheckBooking = await prisma.booking.findFirst({
        where: {
          AND: [
            { apiReferenceId: transactionId },
            { referenceId: flightOffer.id },
          ],
        },
      });

      if (doubleCheckBooking) {
        console.log(
          `Found existing booking for flight ${flightOffer.id} and transaction ${transactionId}`
        );
        bookings.push(doubleCheckBooking);
        continue;
      }

      // Extract all unique IATA codes from segments
      const segments = flightOffer.itineraries.flatMap((i: any) => i.segments);
      const uniqueIataCodes = new Set<string>();
      segments.forEach((segment: any) => {
        uniqueIataCodes.add(segment.departure.iataCode);
        uniqueIataCodes.add(segment.arrival.iataCode);
      });

      // Fetch location details for each IATA code
      const locationDetailsMap: Record<string, any> = {};
      for (const code of uniqueIataCodes) {
        const details = await getLocationDetails(code);
        if (details) {
          locationDetailsMap[code] = {
            airportName: details.name,
            cityName: details.address?.cityName,
            countryName: details.address?.countryName,
            countryCode: details.address?.countryCode,
          };
        }
      }

      // Extract unique airline codes
      const uniqueAirlineCodes = new Set<string>();
      segments.forEach((segment: any) => {
        if (segment.carrierCode) uniqueAirlineCodes.add(segment.carrierCode);
        if (segment.operatingCarrierCode)
          uniqueAirlineCodes.add(segment.operatingCarrierCode);
      });

      // Fetch airline names
      const airlineDetailsMap = await getAirlineDetails(
        Array.from(uniqueAirlineCodes),
        token
      );

      // Prepare booking payload
      const payload = {
        data: {
          type: "flight-order",
          flightOffers: [flightOffer],
          travelers: travelers.map((t: any, index: number) => {
            const travelerId =
              flightOffer.travelerPricings[index]?.travelerId ||
              `TRAVELER_${index + 1}`;

            return {
              id: travelerId,
              dateOfBirth: new Date(t.dateOfBirth).toISOString().split("T")[0],
              name: {
                firstName: t.name.firstName,
                lastName: t.name.lastName,
              },
              gender: t.gender,
              contact: {
                emailAddress: t.contact.emailAddress,
                phones: t.contact.phones.map((phone: any) => ({
                  deviceType: "MOBILE",
                  countryCallingCode: phone.countryCallingCode,
                  number: phone.number,
                })),
              },
              documents: t.documents.map((doc: any) => ({
                number: doc.passportNumber || doc.number,
                documentType: doc.documentType || "PASSPORT",
                issuanceCountry: doc.issuanceCountry?.toUpperCase(),
                issuanceLocation: doc.issuanceLocation || "LAGOS",
                issuanceDate: new Date(doc.issuanceDate)
                  .toISOString()
                  .split("T")[0],
                holder: true,
                expiryDate: new Date(doc.expiryDate)
                  .toISOString()
                  .split("T")[0],
                validityCountry: doc.validityCountry?.toUpperCase(),
                nationality: doc.nationality?.toUpperCase(),
                birthPlace: doc.birthPlace,
              })),
            };
          }),
          contacts: flightOffer.contacts || [
            {
              addresseeName: {
                firstName: guestInfo.firstName,
                lastName: guestInfo.lastName,
              },
              purpose: "STANDARD",
              phones: [
                {
                  deviceType: "MOBILE",
                  number: guestInfo.phone,
                  countryCallingCode: guestInfo.countryCode,
                },
              ],
              emailAddress: guestInfo.email,
              address: {
                lines: [guestInfo.address],
                postalCode: guestInfo.postalCode,
                cityName: guestInfo.city,
                countryCode: guestInfo.countryCode?.toUpperCase(),
              },
            },
          ],
          remarks: {
            general: [
              {
                subType: "GENERAL_MISCELLANEOUS",
                text: "ONLINE BOOKING FROM MANWHIT",
              },
            ],
          },
        },
      };

      console.log("Booking payload:", JSON.stringify(payload, null, 2));

      try {
        // Call Amadeus booking API
        const bookingResponse = await axios.post(
          `${baseURL}/v1/booking/flight-orders`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        const bookingData: any = bookingResponse.data;

        // Final check before creating booking
        const finalCheck = await prisma.booking.findFirst({
          where: {
            AND: [
              { apiReferenceId: transactionId },
              { referenceId: bookingData.data.id },
            ],
          },
        });

        if (finalCheck) {
          console.log(
            `Found existing booking during final check for transaction ${transactionId}`
          );
          bookings.push(finalCheck);
          continue;
        }

        // Save booking in DB
        const booking = await prisma.booking.create({
          data: {
            userId: req.user?.id,
            guestUserId: guestUserId,
            referenceId: bookingData.data.id,
            type: "FLIGHT",
            verified: true,
            status: "CONFIRMED",
            apiResponse: bookingData,
            bookingDetails: flightOffer,
            totalAmount: parseFloat(flightOffer.price.total),
            currency: flightOffer?.price?.currency,
            apiProvider: "AMADEUS",
            apiReferenceId: transactionId,
            locationDetails: locationDetailsMap,
            airlineDetails: airlineDetailsMap,
            travelers: {
              create: travelers.map((traveler: any) => ({
                firstName: traveler.name.firstName,
                lastName: traveler.name.lastName,
                dateOfBirth: new Date(traveler.dateOfBirth),
                gender: traveler.gender,
                email: traveler.contact.emailAddress,
                phone: traveler.contact.phones[0].number,
                countryCode:
                  traveler.documents[0].issuanceCountry?.toUpperCase() || "NG",
                birthPlace: traveler.documents[0].birthPlace || "LAGOS",
                passportNumber: traveler.documents[0].number,
                passportExpiry: new Date(traveler.documents[0].expiryDate),
                issuanceCountry:
                  traveler.documents[0].issuanceCountry?.toUpperCase() || "NG",
                validityCountry:
                  traveler.documents[0].validityCountry?.toUpperCase() || "NG",
                nationality:
                  traveler.documents[0].nationality?.toUpperCase() || "NG",
                issuanceDate: new Date(traveler.documents[0].issuanceDate),
                issuanceLocation:
                  traveler.documents[0].issuanceLocation || "LAGOS",
              })),
            },
          },
        });

        bookings.push(booking);
      } catch (error: any) {
        console.error(
          "Error booking flight:",
          error.response?.data || error.message
        );
        continue;
      }
    }

    // 6. Clear cart if it was a registered user booking
    if (!guestInfo && req.user?.id) {
      await prisma.flightCart.deleteMany({ where: { userId: req.user.id } });
    }

    return res.status(200).json({
      message: "Flight(s) booked successfully",
      bookings,
    });
  } catch (error: any) {
    console.error("Booking API Error:", error.response?.data || error.message);
    return res
      .status(500)
      .json({ message: "Error booking flight", error: error.message });
  }
};

export const bookUserFlight = async (req: any, res: any): Promise<any> => {
  try {
    const { userId, transactionId } = req.params;
    const { travelers } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User ID missing" });
    }

    if (!transactionId) {
      return res
        .status(400)
        .json({ message: "Missing Flutterwave transaction ID" });
    }

    if (!travelers || !Array.isArray(travelers) || travelers.length === 0) {
      return res
        .status(400)
        .json({ message: "Travelers data missing or invalid" });
    }

    // 1. Verify payment with Flutterwave
    const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTER_SECRET!;
    const verifyUrl = `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`;

    const flutterwaveRes = await axios.get(verifyUrl, {
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
      },
    });

    const flutterwaveData: any = flutterwaveRes.data;

    if (
      !flutterwaveData ||
      flutterwaveData.status !== "success" ||
      flutterwaveData.data.status !== "successful"
    ) {
      return res.status(402).json({ message: "Payment not successful" });
    }

    // 2. Fetch user's cart items
    const cartItems = await prisma.flightCart.findMany({
      where: { userId },
    });

    if (cartItems.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // 3. Get Amadeus token once
    const token = await getAmadeusToken();
    // console.log("Amadeus token acquired");

    // Helper function to fetch location details using query parameters
    async function getLocationDetails(iataCode: string) {
      try {
        const response: any = await axios.get(
          `${baseURL}/v1/reference-data/locations`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              keyword: iataCode,
              subType: "AIRPORT",
            },
          }
        );

        const locations = response.data.data;
        // console.log(`Location data for ${iataCode}:`, JSON.stringify(locations, null, 2));

        if (locations && locations.length > 0) {
          // Find exact match by iataCode if multiple returned
          const exactMatch = locations.find(
            (loc: any) => loc.iataCode === iataCode
          );
          const location = exactMatch || locations[0];
          return location;
        } else {
          // console.warn(`No location data found for IATA code: ${iataCode}`);
          return null;
        }
      } catch (error: any) {
        // console.error(`Failed to fetch location details for ${iataCode}`, error.response?.data || error.message);
        return null;
      }
    }

    // Helper function to fetch airline details dynamically from Amadeus API
    async function getAirlineDetails(
      codes: string[],
      token: string
    ): Promise<Record<string, string>> {
      try {
        if (codes.length === 0) return {};
        const response: any = await axios.get(
          `${baseURL}/v1/reference-data/airlines`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { airlineCodes: codes.join(",") },
          }
        );

        const airlines = response.data.data;
        const map: Record<string, string> = {};

        airlines.forEach((airline: any) => {
          map[airline.iataCode] =
            airline.commonName || airline.name || airline.iataCode;
        });

        return map;
      } catch (error: any) {
        console.error(
          "Failed to fetch airline details:",
          error.response?.data || error.message
        );
        // fallback: map codes to themselves if API fails
        const fallbackMap: Record<string, string> = {};
        codes.forEach((code) => (fallbackMap[code] = code));
        return fallbackMap;
      }
    }

    const bookings = [];

    for (const cartItem of cartItems) {
      const flightOffer: any = cartItem.flightData;

      // Extract all unique IATA codes from segments
      const segments = flightOffer.itineraries.flatMap((i: any) => i.segments);
      const uniqueIataCodes = new Set<string>();
      segments.forEach((segment: any) => {
        uniqueIataCodes.add(segment.departure.iataCode);
        uniqueIataCodes.add(segment.arrival.iataCode);
      });

      console.log("Unique IATA codes extracted:", Array.from(uniqueIataCodes));

      // Fetch location details for each IATA code
      const locationDetailsMap: Record<string, any> = {};
      for (const code of uniqueIataCodes) {
        const details = await getLocationDetails(code);
        if (details) {
          locationDetailsMap[code] = {
            airportName: details.name,
            cityName: details.address?.cityName,
            countryName: details.address?.countryName,
            countryCode: details.address?.countryCode,
          };
        }
      }

      // console.log("Location details map populated:", locationDetailsMap);

      // Extract unique airline codes from flight segments
      const uniqueAirlineCodes = new Set<string>();
      segments.forEach((segment: any) => {
        if (segment.carrierCode) uniqueAirlineCodes.add(segment.carrierCode);
        if (segment.operatingCarrierCode)
          uniqueAirlineCodes.add(segment.operatingCarrierCode);
      });

      console.log(
        "Unique airline codes extracted:",
        Array.from(uniqueAirlineCodes)
      );

      // Fetch airline names from Amadeus API dynamically
      const airlineDetailsMap = await getAirlineDetails(
        Array.from(uniqueAirlineCodes),
        token
      );

      // Prepare booking payload
      const payload = {
        data: {
          type: "flight-order",
          flightOffers: [flightOffer],
          travelers: travelers.map((t: any) => ({
            id: t.id,
            dateOfBirth: t.dateOfBirth,
            name: {
              firstName: t.name.firstName,
              lastName: t.name.lastName,
            },
            gender: t.gender,
            contact: {
              emailAddress: t.contact.emailAddress,
              phones: t.contact.phones,
            },
            documents: t.documents.map((doc: any) => ({
              number: doc.passportNumber || doc.number,
              documentType: doc.documentType || "PASSPORT",
              issuanceCountry: doc.issuanceCountry,
              issuanceLocation: doc.issuanceLocation,
              issuanceDate: doc.issuanceDate,
              holder: true,
              expiryDate: doc.expiryDate,
              validityCountry: doc.validityCountry,
              nationality: doc.nationality,
              birthPlace: doc.birthPlace,
            })),
          })),
          holder: {
            name: {
              firstName: travelers[0].name.firstName,
              lastName: travelers[0].name.lastName,
            },
          },
        },
      };

      // Call Amadeus booking API
      const bookingResponse = await axios.post(
        `${baseURL}/v1/booking/flight-orders`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const bookingData: any = bookingResponse.data;

      // Save booking in DB, including location and airline details
      const booking = await prisma.booking.create({
        data: {
          userId,
          referenceId: bookingData.data.id,
          type: "FLIGHT",
          verified: true,
          status: "CONFIRMED",
          apiResponse: bookingData,
          bookingDetails: flightOffer,
          totalAmount: parseFloat(flightOffer.price.total),
          currency: flightOffer?.price?.currency,
          apiProvider: "AMADEUS",
          apiReferenceId: bookingData.data.id,
          locationDetails: locationDetailsMap,
          airlineDetails: airlineDetailsMap, // <-- Automatically fetched airline names here
          travelers: {
            create: travelers.map((traveler: any) => ({
              firstName: traveler.name.firstName,
              lastName: traveler.name.lastName,
              dateOfBirth: new Date(traveler.dateOfBirth),
              gender: traveler.gender,
              email: traveler.contact.emailAddress,
              phone: traveler.contact.phones[0].number,
              countryCode: traveler.documents[0].issuanceCountry,
              birthPlace: traveler.documents[0].birthPlace,
              passportNumber: traveler.documents[0].number,
              passportExpiry: new Date(traveler.documents[0].expiryDate),
              issuanceCountry: traveler.documents[0].issuanceCountry,
              validityCountry: traveler.documents[0].validityCountry,
              nationality: traveler.documents[0].nationality,
              issuanceDate: new Date(traveler.documents[0].issuanceDate),
              issuanceLocation: traveler.documents[0].issuanceLocation,
            })),
          },
        },
      });

      bookings.push(booking);
    }

    // 4. Clear cart
    await prisma.flightCart.deleteMany({ where: { userId } });

    return res.status(200).json({
      message: "Flight(s) booked successfully",
      bookings,
    });
  } catch (error: any) {
    console.error("Booking API Error:", error.response?.data || error.message);
    return res
      .status(500)
      .json({ message: "Error booking flight", error: error.message });
  }
};

export async function deleteBooking(req: Request, res: Response): Promise<any> {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      return res.status(400).json({
        message: `Missing required parameters: bookingId`,
      });
    }

    const bookings = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!bookings) {
      return res.status(404).json({
        message: `Booking does not exist`,
      });
    }

    return res.status(200).json({
      message: `Booking deleted successfully`,
    });
  } catch (error: any) {
    console.error(`Error: `, error);

    return res.status(500).json({
      message: `Internal server error`,
    });
  }
}
