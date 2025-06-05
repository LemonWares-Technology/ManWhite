import { Request, Response } from "express";
import axios from "axios";
import getAmadeusToken from "../utils/getToken";
import { PrismaClient, Status } from "@prisma/client";
import { getConversionRate } from "../utils/amadeusHelper";
import { getCachedIataCode, getCachedLocationDetails } from "../utils/helper";

const baseURL: string = "https://test.api.amadeus.com";

const prisma = new PrismaClient();

export async function searchFlights(req: Request, res: Response): Promise<any> {
  const { origin, destination, adults, departureDate, keyword } = req.query;

  if (!origin || !destination || !adults || !departureDate) {
    return res.status(400).json({ error: "Missing required field(s)" });
  }

  try {
    const token = await getAmadeusToken();

    console.log(`Token:`, token);
    const originIata = await getCachedIataCode(origin as string, token);
    const destinationIata = await getCachedIataCode(
      destination as string,
      token
    );

    if (!originIata || !destinationIata) {
      return res
        .status(400)
        .json({ error: "Could not find IATA code for origin or destination" });
    }
    const excludedAirlines = await prisma.excludedAirline.findMany();
    const excludedCodesArray = excludedAirlines
      .map((a: any) => a.airlineCode?.trim())
      .filter((code: string | undefined) => code && /^[A-Z0-9]+$/.test(code));

    const params: any = {
      originLocationCode: originIata,
      destinationLocationCode: destinationIata,
      adults,
      departureDate,
      currencyCode: "NGN",
      max: 7,
    };

    // Only add excludedAirlineCodes if there are valid codes
    if (excludedCodesArray.length > 0) {
      params.excludedAirlineCodes = excludedCodesArray.join(",");
    }
    const response: any = await axios.get(
      `${baseURL}/v2/shopping/flight-offers`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          originLocationCode: originIata,
          destinationLocationCode: destinationIata,
          adults,
          departureDate,
          currencyCode: "NGN",
          excludedAirlineCodes: excludedAirlines,
          max: 7,
        },
      }
    );

    const offers = response.data.data;

    const marginPercent: any = await prisma.marginSetting.findMany();

    const percent = marginPercent.map((el: any) => el?.amount) || 0;

    // Apply margin to each offer price
    const adjustedOffers = offers.map((offer: any) => {
      const originalPrice = parseFloat(offer.price.total);
      const priceWithMargin = originalPrice * (1 + percent / 100);

      return {
        ...offer,
        price: {
          ...offer.price,
          total: parseFloat(priceWithMargin.toFixed(2)),

          // currency remains the same (NGN)
        },
      };
    });

    for (const offer of adjustedOffers) {
      for (const itinerary of offer.itineraries) {
        for (const segment of itinerary.segments) {
          const originDetails = await getCachedLocationDetails(
            segment.departure.iataCode,
            token
          );
          const destinationDetails = await getCachedLocationDetails(
            segment.arrival.iataCode,
            token
          );

          segment.departure.details = originDetails;
          segment.arrival.details = destinationDetails;
        }
      }
    }

    return res.status(200).json({ data: adjustedOffers });
  } catch (error: any) {
    console.error("Error occurred:", error.response?.data || error.message);
    return res.status(500).json({ error: "Failed to fetch flight offers" });
  }
}

export async function searchFlightPrice(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { flightOffer } = req.body;

    if (!flightOffer) {
      return res
        .status(400)
        .json({ error: "Missing flight offer in request body" });
    }

    const token = await getAmadeusToken();

    const payload = {
      data: {
        type: "flight-offers-pricing",
        flightOffers: [flightOffer],
      },
    };

    const response: any = await axios.post(
      `${baseURL}/v1/shopping/flight-offers/pricing`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-HTTP-Method-Override": "GET",
        },
      }
    );

    // ✅ Fetch margin setting
    const marginSetting: any = await prisma.marginSetting.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!marginSetting) {
      return res.status(500).json({ error: "Margin setting not configured" });
    }

    const marginPercentage = marginSetting.amount;

    // ✅ Apply percentage margin to each flight offer
    const modifiedFlightOffers = response.data.data.flightOffers.map(
      (offer: any) => {
        const originalTotal = parseFloat(offer.price.total);
        const originalGrandTotal = parseFloat(offer.price.grandTotal);

        const marginAdded = (marginPercentage / 100) * originalGrandTotal;

        return {
          ...offer,
          price: {
            ...offer.price,
            total: (originalTotal + marginAdded).toFixed(2),
            grandTotal: (originalGrandTotal + marginAdded).toFixed(2),
            originalTotal: originalTotal.toFixed(2),
            originalGrandTotal: originalGrandTotal.toFixed(2),
            marginAdded: {
              value: marginAdded.toFixed(2),
              percentage: marginPercentage,
            },
          },
        };
      }
    );

    return res.status(200).json({
      ...response.data,
      data: {
        ...response.data.data,
        flightOffers: modifiedFlightOffers,
      },
    });
  } catch (error: any) {
    console.error(
      "Flight pricing error:",
      error.response?.data || error.message
    );
    return res.status(500).json({
      error: "Failed to fetch flight pricing",
      details: error.response?.data || error.message,
    });
  }
}

export async function retrieveFlightDetails(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const rawReferenceId = req.params.referenceId;
    if (!rawReferenceId) {
      return res.status(400).json({ error: "Reference parameter is required" });
    }

    // Decode incoming param
    const decodedReferenceId = decodeURIComponent(rawReferenceId);
    // Re-encode for URL safety
    const encodedReferenceId = encodeURIComponent(decodedReferenceId);

    // console.log("Raw referenceId param:", rawReferenceId);
    // console.log("Decoded referenceId:", decodedReferenceId);
    // console.log("Encoded referenceId for URL:", encodedReferenceId);

    const token = await getAmadeusToken();

    const response = await axios.get(
      `${baseURL}/v1/booking/flight-orders/${encodedReferenceId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error(
      "Error retrieving flight details:",
      error.response?.data || error.message
    );
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteFlightBooking(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const rawReferenceId = req.params.referenceId;

    if (!rawReferenceId) {
      return res.status(400).json({ error: "Reference ID is required" });
    }

    const decodedReferenceId = decodeURIComponent(rawReferenceId);

    const encodedReferenceId = encodeURIComponent(decodedReferenceId);

    const booking = await prisma.booking.findUnique({
      where: { referenceId: encodedReferenceId },
    });

    if (!booking) {
      return res
        .status(404)
        .json({ error: "Booking not found in local database" });
    }

    const token = await getAmadeusToken();

    await axios.delete(
      `${baseURL}/v1/booking/flight-orders/${encodedReferenceId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    await prisma.booking.delete({
      where: { referenceId: encodedReferenceId },
    });

    return res.status(200).json({
      message: "Booking successfully cancelled and deleted",
    });
  } catch (error: any) {
    console.error(
      "Error deleting booking:",
      error.response?.data || error.message
    );

    if (error.response?.status === 404) {
      return res
        .status(404)
        .json({ error: "Booking not found in Amadeus or already deleted" });
    }

    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getSeatMapsByFlightId(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { referenceId } = req.params;

    if (!referenceId) {
      return res.status(400).json({ error: "Flight order ID is required" });
    }

    const token = await getAmadeusToken();

    // Call Amadeus Seat Maps API with correct parameter name and no manual encoding
    const response = await axios.get(`${baseURL}/v1/shopping/seatmaps`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: {
        flightOrderId: referenceId, // Correct parameter name (camelCase, no hyphen)
      },
    });

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error(
      "Error occurred while fetching seat maps:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}

export async function getOneFlightDetails(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { flightId } = req.params;

    if (!flightId) {
      return res.status(400).json({ error: "Reference parameter is required" });
    }

    const response = await prisma.booking.findUnique({
      where: { id: flightId },
    });

    if (!response) {
      return res.status(404).json({
        message: "This Flight cannot be found",
      });
    }

    return res.status(200).json(response);
  } catch (error: any) {
    console.error(
      "Error retrieving flight details:",
      error.response?.data || error.message
    );
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateFlightStatus(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { flightId } = req.params;
    const { status } = req.body;

    if (!flightId) {
      return res.status(400).json({ error: "Reference parameter is required" });
    }

    const flightInfo = await prisma.booking.update({
      where: { id: flightId },
      data: {
        status: status,
      },
    });

    return res.status(201).json(flightInfo);
  } catch (error: any) {
    console.error(
      "Error retrieving flight details:",
      error.response?.data || error.message
    );
    return res.status(500).json({ error: "Internal server error" });
  }
}

// export const bookFlightWithAddons = async (
//   req: Request,
//   res: Response
// ): Promise<any> => {
//   const { bookingData, addonIds } = req.body; // addonIds = array of selected addon IDs
//   const { userId, guestUserId } = bookingData;

//   try {
//     // ✅ Extract base price from Amadeus pricing response
//     const basePrice = parseFloat(
//       bookingData?.apiResponse?.data?.price?.grandTotal || "0"
//     );
//     if (!basePrice) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Unable to extract base flight price from bookingData.apiResponse",
//       });
//     }

//     // ✅ Fetch selected addon records from DB
//     const addons = await prisma.flightAddon.findMany({
//       where: { id: { in: addonIds } },
//     });

//     // ✅ Calculate total addon cost
//     const addonTotal = addons.reduce((sum, addon) => sum + addon.price, 0);
//     const totalAmount = basePrice + addonTotal;

//     // ✅ Create booking
//     const booking = await prisma.booking.create({
//       data: {
//         userId,
//         guestUserId,
//         type: "FLIGHT",
//         status: "PENDING",
//         verified: false,
//         referenceId: `BK-${Date.now()}`,
//         apiResponse: bookingData.apiResponse,
//         bookingDetails: bookingData.bookingDetails,
//         totalAmount,
//         locationDetails: bookingData.locationDetails || {},
//         airlineDetails: bookingData.airlineDetails || {},
//         FlightAddon: {
//           connect: addons.map((addon) => ({ id: addon.id })), // Connect selected addons
//         },
//       },
//       include: {
//         FlightAddon: true,
//       },
//     });

//     res.status(201).json({
//       success: true,
//       message: "Flight booked with selected addons",
//       booking,
//       totalAmount,
//     });
//   } catch (error) {
//     console.error("Booking Error:", error);
//     res.status(500).json({ success: false, message: "Booking failed", error });
//   }
// };

// export async function bookFlightWithOptionalAddons(
//   req: Request,
//   res: Response
// ): Promise<any> {
//   const {
//     flightOffer,
//     travelers,
//     addonIds = [],
//     userId,
//     guestUserId,
//   } = req.body;

//   try {
//     if (!flightOffer || !travelers) {
//       return res.status(400).json({
//         error: "Missing required fields: flightOffer or travelers",
//       });
//     }

//     const token = await getAmadeusToken();

//     // ✅ Prepare Amadeus payload
//     const payload = {
//       data: {
//         type: "flight-order",
//         flightOffers: [flightOffer],
//         travelers: travelers.map((t: any) => ({
//           id: t.id,
//           dateOfBirth: t.dateOfBirth,
//           name: {
//             firstName: t.name.firstName,
//             lastName: t.name.lastName,
//           },
//           gender: t.gender,
//           contact: {
//             emailAddress: t.contact.emailAddress,
//             phones: t.contact.phones,
//           },
//           documents: t.documents.map((doc: any) => ({
//             number: doc.passportNumber || doc.number,
//             documentType: doc.documentType || "PASSPORT",
//             issuanceCountry: doc.issuanceCountry,
//             issuanceLocation: doc.issuanceLocation,
//             issuanceDate: doc.issuanceDate,
//             holder: true,
//             expiryDate: doc.expiryDate,
//             validityCountry: doc.validityCountry,
//             nationality: doc.nationality,
//             birthPlace: doc.birthPlace,
//           })),
//         })),
//         holder: {
//           name: {
//             firstName: travelers[0].name.firstName,
//             lastName: travelers[0].name.lastName,
//           },
//         },
//       },
//     };

//     // ✅ Call Amadeus API
//     const response: any = await axios.post(
//       `${baseURL}/v1/booking/flight-orders`,
//       payload,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     // ✅ Fetch margin setting
//     const marginSetting: any = await prisma.marginSetting.findFirst({
//       orderBy: { createdAt: "desc" },
//     });

//     if (!marginSetting) {
//       return res.status(500).json({ error: "Margin setting not configured" });
//     }

//     const marginPercentage = marginSetting.amount;

//     // ✅ Apply percentage margin to each flight offer
//     const modifiedFlightOffers = response.data.data.flightOffers.map(
//       (offer: any) => {
//         const originalTotal = parseFloat(offer.price.total);
//         const originalGrandTotal = parseFloat(offer.price.grandTotal);

//         const marginAdded = (marginPercentage / 100) * originalGrandTotal;

//         return {
//           ...offer,
//           price: {
//             ...offer.price,
//             total: (originalTotal + marginAdded).toFixed(2),
//             grandTotal: (originalGrandTotal + marginAdded).toFixed(2),
//             originalTotal: originalTotal.toFixed(2),
//             originalGrandTotal: originalGrandTotal.toFixed(2),
//             marginAdded: {
//               value: marginAdded.toFixed(2),
//               percentage: marginPercentage,
//             },
//           },
//         };
//       }
//     );

//     const amadeusBooking: any = response.data;
//     const basePrice = parseFloat(
//       amadeusBooking?.data?.price?.grandTotal || "0"
//     );

//     // ✅ Fetch selected addons
//     let addons: any = [];
//     let addonTotal = 0;

//     if (addonIds.length > 0) {
//       addons = await prisma.flightAddon.findMany({
//         where: { id: { in: addonIds } },
//       });
//       addonTotal = addons.reduce(
//         (sum: any, addon: any) => sum + addon.price,
//         0
//       );
//     }

//     const totalAmount = basePrice + addonTotal;

//     // ✅ Save booking in your DB
//     const booking = await prisma.booking.create({
//       data: {
//         userId,
//         guestUserId,
//         referenceId: amadeusBooking.data.id,
//         type: "FLIGHT",
//         status: "CONFIRMED",
//         verified: true,
//         apiProvider: "AMADEUS",
//         apiReferenceId: amadeusBooking.data.id,
//         apiResponse: amadeusBooking,
//         bookingDetails: flightOffer,
//         totalAmount,
//         currency: amadeusBooking?.data?.price?.currency,
//         locationDetails: {}, // optional, or pass from frontend
//         airlineDetails: {}, // optional, or pass from frontend
//         FlightAddon: {
//           create: addons.map((addon: any) => ({
//             type: addon.type, // match your schema field
//             name: addon.name, // match your schema field
//             description: addon.description,
//             price: addon.price,
//             currency: addon.currency || "USD",
//           })),
//         },
//       },
//       include: {
//         FlightAddon: true,
//       },
//     });

//     // ✅ Create travelers in DB
//     for (const t of travelers) {
//       await prisma.traveler.create({
//         data: {
//           bookingId: booking.id,
//           firstName: t.name.firstName,
//           lastName: t.name.lastName,
//           dateOfBirth: new Date(t.dateOfBirth),
//           gender: t.gender,
//           email: t.contact.emailAddress,
//           phone: t.contact.phones?.[0]?.number,
//           countryCode: t.contact.phones?.[0]?.countryCallingCode,
//           passportNumber: t.documents?.[0]?.number,
//           passportExpiry: t.documents?.[0]?.expiryDate
//             ? new Date(t.documents[0].expiryDate)
//             : undefined,
//           nationality: t.documents?.[0]?.nationality,
//         },
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       ...response.data,
//       data: {
//         ...response.data.data,
//         flightOffers: modifiedFlightOffers,
//       },
//       message: "Flight successfully booked with addons",
//       booking,
//       amadeus: amadeusBooking,
//       totalAmount,
//     });

//     // return res.status(201).json({
//     //   success: true,
//     //   message: "Flight successfully booked with addons",
//     //   booking,
//     //   amadeus: amadeusBooking,
//     //   totalAmount,
//     // });
//   } catch (error: any) {
//     console.error("Booking Error:", error.response?.data || error.message);
//     return res.status(500).json({
//       success: false,
//       message: "Flight booking failed",
//       error: error.response?.data || error.message,
//     });
//   }
// }

// export async function bookFlightWithOptionalAddons(
//   req: Request,
//   res: Response
// ): Promise<any> {
//   const {
//     flightOffer,
//     travelers,
//     addonIds = [],
//     userId,
//     guestUserId,
//   } = req.body;

//   try {
//     if (!flightOffer || !travelers) {
//       return res.status(400).json({
//         error: "Missing required fields: flightOffer or travelers",
//       });
//     }

//     const token = await getAmadeusToken();

//    const conversionRate = await getConversionRate("USD", "NGN");

//     // Prepare Amadeus booking payload
//     const payload = {
//       data: {
//         type: "flight-order",
//         flightOffers: [flightOffer],
//         travelers: travelers.map((t: any) => ({
//           id: t.id,
//           dateOfBirth: t.dateOfBirth,
//           name: {
//             firstName: t.name.firstName,
//             lastName: t.name.lastName,
//           },
//           gender: t.gender,
//           contact: {
//             emailAddress: t.contact.emailAddress,
//             phones: t.contact.phones,
//           },
//           documents: t.documents.map((doc: any) => ({
//             number: doc.passportNumber || doc.number,
//             documentType: doc.documentType || "PASSPORT",
//             issuanceCountry: doc.issuanceCountry,
//             issuanceLocation: doc.issuanceLocation,
//             issuanceDate: doc.issuanceDate,
//             holder: true,
//             expiryDate: doc.expiryDate,
//             validityCountry: doc.validityCountry,
//             nationality: doc.nationality,
//             birthPlace: doc.birthPlace,
//           })),
//         })),
//         holder: {
//           name: {
//             firstName: travelers[0].name.firstName,
//             lastName: travelers[0].name.lastName,
//           },
//         },
//       },
//     };

//     // Call Amadeus booking API
//     const response: any = await axios.post(
//       `${baseURL}/v1/booking/flight-orders`,
//       payload,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const amadeusBooking: any = response.data;

//     // Fetch margin setting
//     const marginSetting: any = await prisma.marginSetting.findFirst({
//       orderBy: { createdAt: "desc" },
//     });

//     if (!marginSetting) {
//       return res.status(500).json({ error: "Margin setting not configured" });
//     }

//     const marginPercentage = marginSetting.amount;

//     // Defensive: flightOffers might be undefined
//     const flightOffers = amadeusBooking?.data?.flightOffers || [];

//     // Apply margin to each flight offer price
//     const modifiedFlightOffers = flightOffers.map((offer: any) => {
//       const originalTotal = parseFloat(offer.price.total);
//       const originalGrandTotal = parseFloat(offer.price.grandTotal);

//       const marginAdded = (marginPercentage / 100) * originalGrandTotal;

//       return {
//         ...offer,
//         price: {
//           ...offer.price,
//           total: +(originalTotal + marginAdded).toFixed(2),
//           grandTotal: +(originalGrandTotal + marginAdded).toFixed(2),
//           originalTotal: +originalTotal.toFixed(2),
//           originalGrandTotal: +originalGrandTotal.toFixed(2),
//           marginAdded: {
//             value: +marginAdded.toFixed(2),
//             percentage: marginPercentage,
//           },
//         },
//       };
//     });

//     // Fetch selected addons
//     let addons: any[] = [];
//     let addonTotal = 0;

//     if (addonIds.length > 0) {
//       addons = await prisma.flightAddon.findMany({
//         where: { id: { in: addonIds } },
//       });
//       addonTotal = addons.reduce((sum, addon) => sum + addon.price, 0);
//     }

//     // Calculate total amount including addons
//     const basePrice = parseFloat(
//       amadeusBooking?.data?.price?.grandTotal || "0"
//     );
//     const totalAmount = basePrice + addonTotal;

//     // Save booking in DB with addons
//     const booking = await prisma.booking.create({
//       data: {
//         userId,
//         guestUserId,
//         referenceId: amadeusBooking.data.id,
//         type: "FLIGHT",
//         status: "CONFIRMED",
//         verified: true,
//         apiProvider: "AMADEUS",
//         apiReferenceId: amadeusBooking.data.id,
//         apiResponse: amadeusBooking,
//         bookingDetails: flightOffer,
//         totalAmount,
//         currency: amadeusBooking?.data?.price?.currency,
//         locationDetails: {}, // optional
//         airlineDetails: {}, // optional
//         FlightAddon: {
//           create: addons.map((addon) => ({
//             type: addon.type,
//             name: addon.name,
//             description: addon.description,
//             price: addon.price,
//             currency: addon.currency || "USD",
//           })),
//         },
//       },
//       include: {
//         FlightAddon: true,
//       },
//     });

//     // Create travelers in DB
//     for (const t of travelers) {
//       await prisma.traveler.create({
//         data: {
//           bookingId: booking.id,
//           firstName: t.name.firstName,
//           lastName: t.name.lastName,
//           dateOfBirth: new Date(t.dateOfBirth),
//           gender: t.gender,
//           email: t.contact.emailAddress,
//           phone: t.contact.phones?.[0]?.number,
//           countryCode: t.contact.phones?.[0]?.countryCallingCode,
//           passportNumber: t.documents?.[0]?.number,
//           passportExpiry: t.documents?.[0]?.expiryDate
//             ? new Date(t.documents[0].expiryDate)
//             : undefined,
//           nationality: t.documents?.[0]?.nationality,
//         },
//       });
//     }

//     return res.status(201).json({
//       success: true,
//       message: "Flight successfully booked with addons",
//       booking,
//       amadeus: amadeusBooking,
//       totalAmount,
//       flightOffers: modifiedFlightOffers,
//     });
//   } catch (error: any) {
//     console.error("Booking Error:", error.response?.data || error.message);
//     return res.status(500).json({
//       success: false,
//       message: "Flight booking failed",
//       error: error.response?.data || error.message,
//     });
//   }
// }

// export async function bookFlightWithOptionalAddons(
//   req: Request,
//   res: Response
// ): Promise<any> {
//   const {
//     flightOffer,
//     travelers,
//     addonIds = [],
//     userId,
//     guestUserId,
//   } = req.body;

//   try {
//     if (!flightOffer || !travelers) {
//       return res.status(400).json({
//         error: "Missing required fields: flightOffer or travelers",
//       });
//     }

//     const token = await getAmadeusToken();

//     // Prepare Amadeus booking payload
//     const payload = {
//       data: {
//         type: "flight-order",
//         flightOffers: [flightOffer],
//         travelers: travelers.map((t: any) => ({
//           id: t.id,
//           dateOfBirth: t.dateOfBirth,
//           name: {
//             firstName: t.name.firstName,
//             lastName: t.name.lastName,
//           },
//           gender: t.gender,
//           contact: {
//             emailAddress: t.contact.emailAddress,
//             phones: t.contact.phones,
//           },
//           documents: t.documents.map((doc: any) => ({
//             number: doc.passportNumber || doc.number,
//             documentType: doc.documentType || "PASSPORT",
//             issuanceCountry: doc.issuanceCountry,
//             issuanceLocation: doc.issuanceLocation,
//             issuanceDate: doc.issuanceDate,
//             holder: true,
//             expiryDate: doc.expiryDate,
//             validityCountry: doc.validityCountry,
//             nationality: doc.nationality,
//             birthPlace: doc.birthPlace,
//           })),
//         })),
//         holder: {
//           name: {
//             firstName: travelers[0].name.firstName,
//             lastName: travelers[0].name.lastName,
//           },
//         },
//       },
//     };

//     // Call Amadeus booking API
//     const response: any = await axios.post(
//       `${baseURL}/v1/booking/flight-orders`,
//       payload,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const amadeusBooking: any = response.data;

//     // Fetch margin setting
//     const marginSetting: any = await prisma.marginSetting.findFirst({
//       orderBy: { createdAt: "desc" },
//     });

//     if (!marginSetting) {
//       return res.status(500).json({ error: "Margin setting not configured" });
//     }

//     const marginPercentage = marginSetting.amount;

//     // Defensive: flightOffers might be undefined
//     const flightOffers = amadeusBooking?.data?.flightOffers || [];

//     // Apply margin to each flight offer price
//     const modifiedFlightOffers = flightOffers.map((offer: any) => {
//       const originalTotal = parseFloat(offer.price.total);
//       const originalGrandTotal = parseFloat(offer.price.grandTotal);

//       const marginAdded = (marginPercentage / 100) * originalGrandTotal;

//       return {
//         ...offer,
//         price: {
//           ...offer.price,
//           total: +(originalTotal + marginAdded).toFixed(2),
//           grandTotal: +(originalGrandTotal + marginAdded).toFixed(2),
//           originalTotal: +originalTotal.toFixed(2),
//           originalGrandTotal: +originalGrandTotal.toFixed(2),
//           marginAdded: {
//             value: +marginAdded.toFixed(2),
//             percentage: marginPercentage,
//           },
//         },
//       };
//     });

//     // Get conversion rate USD -> NGN for addons
//     const conversionRate = await getConversionRate("USD", "NGN");

//     // Fetch selected addons and convert prices to NGN
//     let addons: any[] = [];
//     let addonTotal = 0;

//     if (addonIds.length > 0) {
//       addons = await prisma.flightAddon.findMany({
//         where: { id: { in: addonIds } },
//       });

//       addonTotal = addons.reduce((sum, addon) => {
//         const priceInUsd = addon.price;
//         const priceInNgn = priceInUsd * conversionRate;
//         return sum + priceInNgn;
//       }, 0);
//     }

//     // Calculate total amount including addons (basePrice assumed NGN)
//     const basePrice = parseFloat(
//       amadeusBooking?.data?.price?.grandTotal || "0"
//     );
//     const totalAmount = basePrice + addonTotal;

//     // Save booking in DB with addons (converted prices)
//     const booking = await prisma.booking.create({
//       data: {
//         userId,
//         guestUserId,
//         referenceId: amadeusBooking.data.id,
//         type: "FLIGHT",
//         status: "CONFIRMED",
//         verified: true,
//         apiProvider: "AMADEUS",
//         apiReferenceId: amadeusBooking.data.id,
//         apiResponse: amadeusBooking,
//         bookingDetails: flightOffer,
//         totalAmount,
//         currency: "NGN", // Since we convert everything to NGN
//         locationDetails: {}, // optional
//         airlineDetails: {}, // optional
//         FlightAddon: {
//           create: addons.map((addon) => ({
//             type: addon.type,
//             name: addon.name,
//             description: addon.description,
//             price: +(addon.price * conversionRate).toFixed(2), // Store converted price
//             currency: "NGN",
//           })),
//         },
//       },
//       include: {
//         FlightAddon: true,
//       },
//     });

//     // Create travelers in DB
//     for (const t of travelers) {
//       await prisma.traveler.create({
//         data: {
//           bookingId: booking.id,
//           firstName: t.name.firstName,
//           lastName: t.name.lastName,
//           dateOfBirth: new Date(t.dateOfBirth),
//           gender: t.gender,
//           email: t.contact.emailAddress,
//           phone: t.contact.phones?.[0]?.number,
//           countryCode: t.contact.phones?.[0]?.countryCallingCode,
//           passportNumber: t.documents?.[0]?.number,
//           passportExpiry: t.documents?.[0]?.expiryDate
//             ? new Date(t.documents[0].expiryDate)
//             : undefined,
//           nationality: t.documents?.[0]?.nationality,
//         },
//       });
//     }

//     return res.status(201).json({
//       success: true,
//       message: "Flight successfully booked with addons",
//       booking,
//       amadeus: amadeusBooking,
//       totalAmount,
//       flightOffers: modifiedFlightOffers,
//     });
//   } catch (error: any) {
//     console.error("Booking Error:", error.response?.data || error.message);
//     return res.status(500).json({
//       success: false,
//       message: "Flight booking failed",
//       error: error.response?.data || error.message,
//     });
//   }
// }

// export async function bookFlightWithOptionalAddons(
//   req: Request,
//   res: Response
// ): Promise<any> {
//   const {
//     flightOffer,
//     travelers,
//     addonIds = [],
//     userId,
//     guestUserId,
//   } = req.body;

//   try {
//     if (!flightOffer || !travelers) {
//       return res.status(400).json({
//         error: "Missing required fields: flightOffer or travelers",
//       });
//     }

//     const token = await getAmadeusToken();

//     const payload = {
//       data: {
//         type: "flight-order",
//         flightOffers: [flightOffer],
//         travelers: travelers.map((t: any) => ({
//           id: t.id,
//           dateOfBirth: t.dateOfBirth,
//           name: {
//             firstName: t.name.firstName,
//             lastName: t.name.lastName,
//           },
//           gender: t.gender,
//           contact: {
//             emailAddress: t.contact.emailAddress,
//             phones: t.contact.phones,
//           },
//           documents: t.documents.map((doc: any) => ({
//             number: doc.passportNumber || doc.number,
//             documentType: doc.documentType || "PASSPORT",
//             issuanceCountry: doc.issuanceCountry,
//             issuanceLocation: doc.issuanceLocation,
//             issuanceDate: doc.issuanceDate,
//             holder: true,
//             expiryDate: doc.expiryDate,
//             validityCountry: doc.validityCountry,
//             nationality: doc.nationality,
//             birthPlace: doc.birthPlace,
//           })),
//         })),
//         holder: {
//           name: {
//             firstName: travelers[0].name.firstName,
//             lastName: travelers[0].name.lastName,
//           },
//         },
//       },
//     };

//     const response: any = await axios.post(
//       `${baseURL}/v1/booking/flight-orders`,
//       payload,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const amadeusBooking: any = response.data;

//     const marginSetting: any = await prisma.marginSetting.findFirst({
//       orderBy: { createdAt: "desc" },
//     });

//     if (!marginSetting) {
//       return res.status(500).json({ error: "Margin setting not configured" });
//     }

//     const marginPercentage = marginSetting.amount;

//     const flightOffers = amadeusBooking?.data?.flightOffers || [];

//     const modifiedFlightOffers = flightOffers.map((offer: any) => {
//       const originalTotal = parseFloat(offer.price.total);
//       const originalGrandTotal = parseFloat(offer.price.grandTotal);

//       const marginAdded = (marginPercentage / 100) * originalGrandTotal;

//       return {
//         ...offer,
//         price: {
//           ...offer.price,
//           total: +(originalTotal + marginAdded).toFixed(2),
//           grandTotal: +(originalGrandTotal + marginAdded).toFixed(2),
//           originalTotal: +originalTotal.toFixed(2),
//           originalGrandTotal: +originalGrandTotal.toFixed(2),
//           marginAdded: {
//             value: +marginAdded.toFixed(2),
//             percentage: marginPercentage,
//           },
//         },
//       };
//     });

//     // Conversion
//     const conversionRate = await getConversionRate("USD", "NGN");

//     // Convert Amadeus base price to NGN
//     const basePriceUsd = parseFloat(
//       amadeusBooking?.data?.price?.grandTotal || "0"
//     );
//     const originalTotalAmount = basePriceUsd * conversionRate;

//     let addons: any[] = [];
//     let addonTotal = 0;

//     if (addonIds.length > 0) {
//       addons = await prisma.flightAddon.findMany({
//         where: { id: { in: addonIds } },
//       });

//       addonTotal = addons.reduce((sum, addon) => {
//         const priceInUsd = addon.price;
//         const priceInNgn = priceInUsd * conversionRate;
//         return sum + priceInNgn;
//       }, 0);
//     }

//     const totalAmount = originalTotalAmount + addonTotal;

//     const booking = await prisma.booking.create({
//       data: {
//         userId,
//         guestUserId,
//         referenceId: amadeusBooking.data.id,
//         type: "FLIGHT",
//         status: "CONFIRMED",
//         verified: true,
//         apiProvider: "AMADEUS",
//         apiReferenceId: amadeusBooking.data.id,
//         apiResponse: amadeusBooking,
//         bookingDetails: flightOffer,
//         totalAmount,
//         currency: "NGN",
//         locationDetails: {},
//         airlineDetails: {},
//         FlightAddon: {
//           create: addons.map((addon) => ({
//             type: addon.type,
//             name: addon.name,
//             description: addon.description,
//             price: +(addon.price * conversionRate).toFixed(2),
//             currency: "NGN",
//           })),
//         },
//       },
//       include: {
//         FlightAddon: true,
//       },
//     });

//     for (const t of travelers) {
//       await prisma.traveler.create({
//         data: {
//           bookingId: booking.id,
//           firstName: t.name.firstName,
//           lastName: t.name.lastName,
//           dateOfBirth: new Date(t.dateOfBirth),
//           gender: t.gender,
//           email: t.contact.emailAddress,
//           phone: t.contact.phones?.[0]?.number,
//           countryCode: t.contact.phones?.[0]?.countryCallingCode,
//           passportNumber: t.documents?.[0]?.number,
//           passportExpiry: t.documents?.[0]?.expiryDate
//             ? new Date(t.documents[0].expiryDate)
//             : undefined,
//           nationality: t.documents?.[0]?.nationality,
//         },
//       });
//     }
//     console.log(
//       "Amadeus booking data:",
//       JSON.stringify(amadeusBooking, null, 2)
//     );

//     return res.status(201).json({
//       success: true,
//       message: "Flight successfully booked with addons",
//       booking,
//       amadeus: amadeusBooking,
//       originalTotalAmount: +originalTotalAmount.toFixed(2),
//       addonTotal: +addonTotal.toFixed(2),
//       totalAmount: +totalAmount.toFixed(2),
//       flightOffers: modifiedFlightOffers,
//     });
//   } catch (error: any) {
//     console.error("Booking Error:", error.response?.data || error.message);
//     return res.status(500).json({
//       success: false,
//       message: "Flight booking failed",
//       error: error.response?.data || error.message,
//     });
//   }
// }

export async function bookFlightWithOptionalAddons(
  req: Request,
  res: Response
): Promise<any> {
  const {
    flightOffer,
    travelers,
    addonIds = [],
    userId,
    guestUserId,
  } = req.body;

  try {
    if (!flightOffer || !travelers) {
      return res.status(400).json({
        error: "Missing required fields: flightOffer or travelers",
      });
    }

    const token = await getAmadeusToken();

    // Prepare Amadeus booking payload
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

    // Book flight on Amadeus
    const response: any = await axios.post(
      `${baseURL}/v1/booking/flight-orders`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    const amadeusBooking: any = response.data;

    // Margin
    const marginSetting: any = await prisma.marginSetting.findFirst({
      orderBy: { createdAt: "desc" },
    });

    console.log(`Margin settings:`, marginSetting);

    if (!marginSetting) {
      return res.status(500).json({ error: "Margin setting not configured" });
    }
    const marginPercentage = marginSetting?.amount;

    // Extract base price from the first flight offer (assuming at least one)
    const flightOffers = amadeusBooking?.data?.flightOffers || [];
    if (flightOffers.length === 0) {
      return res
        .status(500)
        .json({ error: "No flight offers found in Amadeus response" });
    }
    const basePriceNGN = parseFloat(flightOffers[0].price?.grandTotal || "0");

    // Apply margin to base price (if needed)
    const marginAdded = (marginPercentage / 100) * basePriceNGN;
    const originalTotalAmount = basePriceNGN + marginAdded;

    // Get conversion rate for addons (USD -> NGN)
    const conversionRate = await getConversionRate("USD", "NGN");

    // Fetch addons and convert prices from USD to NGN
    let addons: any[] = [];
    let addonTotalNGN = 0;

    if (addonIds.length > 0) {
      addons = await prisma.flightAddon.findMany({
        where: { id: { in: addonIds } },
      });

      addonTotalNGN = addons.reduce((sum, addon) => {
        const priceInUsd = addon.price;
        const priceInNgn = priceInUsd * conversionRate;
        return sum + priceInNgn;
      }, 0);
    }

    // Calculate grand total (base + margin + addons)
    const totalAmountNGN = originalTotalAmount + addonTotalNGN;

    // Save booking with converted addon prices
    const booking = await prisma.booking.create({
      data: {
        userId,
        guestUserId,
        referenceId: amadeusBooking.data.id,
        type: "FLIGHT",
        status: "CONFIRMED",
        verified: true,
        apiProvider: "AMADEUS",
        apiReferenceId: amadeusBooking.data.id,
        apiResponse: amadeusBooking,
        bookingDetails: flightOffer,
        totalAmount: +totalAmountNGN.toFixed(2),
        currency: "NGN",
        locationDetails: {},
        airlineDetails: {},
        FlightAddon: {
          create: addons.map((addon) => ({
            type: addon.type,
            name: addon.name,
            description: addon.description,
            price: +(addon.price * conversionRate).toFixed(2),
            currency: "NGN",
          })),
        },
      },
      include: { FlightAddon: true },
    });

    // Save travelers
    for (const t of travelers) {
      await prisma.traveler.create({
        data: {
          bookingId: booking.id,
          firstName: t.name.firstName,
          lastName: t.name.lastName,
          dateOfBirth: new Date(t.dateOfBirth),
          gender: t.gender,
          email: t.contact.emailAddress,
          phone: t.contact.phones?.[0]?.number,
          countryCode: t.contact.phones?.[0]?.countryCallingCode,
          passportNumber: t.documents?.[0]?.number,
          passportExpiry: t.documents?.[0]?.expiryDate
            ? new Date(t.documents[0].expiryDate)
            : undefined,
          nationality: t.documents?.[0]?.nationality,
        },
      });
    }

    // Debug logs
    console.log("Base price (NGN):", basePriceNGN);
    console.log("Margin added (NGN):", marginAdded);
    console.log("Addon total (NGN):", addonTotalNGN);
    console.log("Total amount (NGN):", totalAmountNGN);

    return res.status(201).json({
      success: true,
      message: "Flight successfully booked with addons",
      booking,
      amadeus: amadeusBooking,
      originalTotalAmount: +originalTotalAmount.toFixed(2), // base + margin
      addonTotal: +addonTotalNGN.toFixed(2),
      totalAmount: +totalAmountNGN.toFixed(2),
    });
  } catch (error: any) {
    console.error("Booking Error:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Flight booking failed",
      error: error.response?.data || error.message,
    });
  }
}
