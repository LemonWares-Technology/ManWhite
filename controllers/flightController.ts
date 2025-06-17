import { Request, Response } from "express";
import axios from "axios";
import getAmadeusToken from "../utils/getToken";
import { PrismaClient, Status } from "@prisma/client";
import {
  getConversionRate,
  mapTravelerToAmadeusFormat,
} from "../utils/amadeusHelper";
import { getCachedIataCode, getCachedLocationDetails } from "../utils/helper";

const baseURL: string = "https://test.api.amadeus.com";

const prisma = new PrismaClient();

export async function searchFlights(req: Request, res: Response): Promise<any> {
  const {
    origin,
    destination,
    adults,
    departureDate,
    keyword,
    currency = "NGN",
  } = req.query;

  try {
    const token = await getAmadeusToken();

    console.log(token);

    // If keyword is provided, return location suggestions
    if (keyword && typeof keyword === "string" && keyword.trim().length > 0) {
      const { data }: any = await axios.get(
        `${baseURL}/v1/reference-data/locations`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            subType: "CITY,AIRPORT",
            keyword,
          },
        }
      );

      const suggestions = data.data.map((item: any) => ({
        name: item.name,
        iataCode: item.iataCode,
        cityCode: item.cityCode,
        countryName: item.countryName,
        stateCode: item.stateCode,
        regionCode: item.regionCode,
      }));

      return res.json(suggestions);
    }

    // For flight search, validate required fields
    if (!origin || !destination || !adults || !departureDate) {
      return res.status(400).json({
        error:
          "Missing required field(s): origin, destination, adults, departureDate",
      });
    }

    const adultsNum = Number(adults);
    if (isNaN(adultsNum) || adultsNum < 1) {
      return res.status(400).json({ error: "Invalid 'adults' parameter" });
    }

    // Get IATA codes for origin and destination
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

    // Get excluded airlines from your database
    const excludedAirlines = await prisma.excludedAirline.findMany();
    const excludedCodesArray = excludedAirlines
      .map((a: any) => a.airlineCode?.trim())
      .filter((code: string | undefined) => code && /^[A-Z0-9]+$/.test(code));

    const params: any = {
      originLocationCode: originIata,
      destinationLocationCode: destinationIata,
      adults: adultsNum,
      departureDate,
      currencyCode: currency,
      max: 7,
    };

    if (excludedCodesArray.length > 0) {
      params.excludedAirlineCodes = excludedCodesArray.join(",");
    }

    const response: any = await axios.get(
      `${baseURL}/v2/shopping/flight-offers`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params,
      }
    );

    const offers = response.data.data;

    // Apply margin from your settings
    const marginSetting = await prisma.marginSetting.findFirst();
    const percent = marginSetting?.amount || 0;

    const adjustedOffers = offers.map((offer: any) => {
      const originalPrice = parseFloat(offer.price.total);
      const priceWithMargin = originalPrice * (1 + percent / 100);

      return {
        ...offer,
        price: {
          ...offer.price,
          total: parseFloat(priceWithMargin.toFixed(2)),
        },
      };
    });

    // Enrich segments with location details
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

    const marginSetting: any = await prisma.marginSetting.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!marginSetting) {
      return res.status(500).json({ error: "Margin setting not configured" });
    }

    const marginPercentage = marginSetting.amount;

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

    // Enrich segments with detailed location info
    for (const offer of modifiedFlightOffers) {
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

export const saveSelectedFlightOffer = async (
  req: Request,
  res: Response
): Promise<Response | any> => {
  try {
    const { offerData } = req.body;

    if (!offerData) {
      return res.status(400).json({ message: "Missing offer data" });
    }

    const savedOffer = await prisma.flightOffer.create({
      data: {
        offerData,
      },
    });

    return res.status(201).json({
      message: "Flight offer saved successfully",
      flightOfferId: savedOffer.id,
    });
  } catch (error: any) {
    console.error("Error saving flight offer:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

export const getFlightOffers = async (
  req: Request,
  res: Response
): Promise<Response | any> => {
  try {
    const flightOffers = await prisma.flightOffer.findMany({
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      message: "Flight offers retrieved successfully",
      data: flightOffers,
    });
  } catch (error: any) {
    console.error("Error fetching flight offers:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

export const getFlightOfferById = async (
  req: Request,
  res: Response
): Promise<Response | any> => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Flight offer ID is required" });
    }

    const flightOffer = await prisma.flightOffer.findUnique({
      where: { id },
      include: {
        travelers: true,
        addons: true,
      },
    });

    if (!flightOffer) {
      return res.status(404).json({ message: "Flight offer not found" });
    }

    return res.status(200).json({
      message: "Flight offer retrieved successfully",
      data: flightOffer,
    });
  } catch (error: any) {
    console.error("Error fetching flight offer:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

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

// export async function bookFlightWithOptionalAddons(
//   req: Request,
//   res: Response
// ): Promise<any> {
//   const { flightOffer, travelers, addonIds = [], userId } = req.body;

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

//     console.log(`Payload`, payload);

//     // Book flight on Amadeus
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

//     // Margin
//     const marginSetting: any = await prisma.marginSetting.findFirst({
//       orderBy: { createdAt: "desc" },
//     });

//     console.log(`Margin settings:`, marginSetting);

//     if (!marginSetting) {
//       return res.status(500).json({ error: "Margin setting not configured" });
//     }
//     const marginPercentage = marginSetting?.amount;

//     // Extract base price from the first flight offer (assuming at least one)
//     const flightOffers = amadeusBooking?.data?.flightOffers || [];
//     if (flightOffers.length === 0) {
//       return res
//         .status(500)
//         .json({ error: "No flight offers found in Amadeus response" });
//     }
//     const basePriceNGN = parseFloat(flightOffers[0].price?.grandTotal || "0");

//     // Apply margin to base price (if needed)
//     const marginAdded = (marginPercentage / 100) * basePriceNGN;
//     const originalTotalAmount = basePriceNGN + marginAdded;

//     // Get conversion rate for addons (USD -> NGN)
//     const conversionRate = await getConversionRate("USD", "NGN");

//     // Fetch addons and convert prices from USD to NGN
//     let addons: any[] = [];
//     let addonTotalNGN = 0;

//     if (addonIds.length > 0) {
//       addons = await prisma.flightAddon.findMany({
//         where: { id: { in: addonIds } },
//       });

//       addonTotalNGN = addons.reduce((sum, addon) => {
//         const priceInUsd = addon.price;
//         const priceInNgn = priceInUsd * conversionRate;
//         return sum + priceInNgn;
//       }, 0);
//     }

//     // Calculate grand total (base + margin + addons)
//     const totalAmountNGN = originalTotalAmount + addonTotalNGN;

//     // Save booking with converted addon prices
//     const booking = await prisma.booking.create({
//       data: {
//         userId,
//         referenceId: amadeusBooking.data.id,
//         type: "FLIGHT",
//         status: "CONFIRMED",
//         verified: true,
//         apiProvider: "AMADEUS",
//         apiReferenceId: amadeusBooking.data.id,
//         apiResponse: amadeusBooking,
//         bookingDetails: flightOffer,
//         totalAmount: +totalAmountNGN.toFixed(2),
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
//       include: { FlightAddon: true },
//     });

//     // Save travelers
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

//     // Debug logs
//     console.log("Base price (NGN):", basePriceNGN);
//     console.log("Margin added (NGN):", marginAdded);
//     console.log("Addon total (NGN):", addonTotalNGN);
//     console.log("Total amount (NGN):", totalAmountNGN);

//     return res.status(201).json({
//       success: true,
//       message: "Flight successfully booked with addons",
//       booking,
//       amadeus: amadeusBooking,
//       originalTotalAmount: +originalTotalAmount.toFixed(2), // base + margin
//       addonTotal: +addonTotalNGN.toFixed(2),
//       totalAmount: +totalAmountNGN.toFixed(2),
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
//   const { flightOffer, travelers, addonIds = [], userId } = req.body;

//   try {
//     console.log("Received booking request with:", {
//       flightOfferExists: !!flightOffer,
//       travelersCount: travelers?.length || 0,
//       addonIds,
//       userId,
//       travelers,
//       flightOffer,
//     });

//     if (!flightOffer || !travelers) {
//       return res.status(400).json({
//         error: "Missing required fields: flightOffer or travelers",
//       });
//     }

//     // Validate userId
//     if (!userId) {
//       return res
//         .status(400)
//         .json({ error: "userId is required for this booking endpoint." });
//     }
//     const userExists = await prisma.user.findUnique({ where: { id: userId } });
//     if (!userExists) {
//       return res.status(400).json({ error: "Invalid userId: user not found" });
//     }

//     // Transform travelers to Amadeus format if needed
//     const amadeusTravelers = travelers.map((t: any, idx: number) =>
//       t.name && t.contact && t.documents
//         ? { ...t, id: (idx + 1).toString() }
//         : mapTravelerToAmadeusFormat(t, (idx + 1).toString())
//     );

//     // Add null checks before mapping
//     if (!amadeusTravelers[0]?.name?.firstName) {
//       return res.status(400).json({
//         error: "Missing firstName in traveler data",
//       });
//     }

//     console.log(`amadeusTravelers`, amadeusTravelers);

//     const token = await getAmadeusToken();

//     // Prepare Amadeus booking payload
//     const payload = {
//       data: {
//         type: "flight-order",
//         flightOffers: [flightOffer],
//         travelers: amadeusTravelers,
//         holder: {
//           name: {
//             firstName:
//               amadeusTravelers[0]?.name?.firstName || "UNKNOWN_FIRSTNAME",
//             lastName: amadeusTravelers[0]?.name?.lastName || "UNKNOWN_LASTNAME",
//           },
//         },
//       },
//     };

//     console.log(`payload here; `, payload);
//     // console.log(`payload here; `, JSON.stringify(payload));

//     // Book flight on Amadeus
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
//     console.log(`Amadeus Response:`, response.data.data);

//     const amadeusBooking: any = response.data;
//     console.log(`amadeusBooking Response:`, response.data);

//     // Margin settings
//     const marginSetting: any = await prisma.marginSetting.findFirst({
//       orderBy: { createdAt: "desc" },
//     });
//     if (!marginSetting) {
//       return res.status(500).json({ error: "Margin setting not configured" });
//     }
//     const marginPercentage = marginSetting.amount;

//     // Extract base price from Amadeus response
//     const flightOffers = amadeusBooking?.data?.flightOffers || [];
//     if (flightOffers.length === 0) {
//       return res
//         .status(500)
//         .json({ error: "No flight offers found in Amadeus response" });
//     }
//     const basePriceNGN = parseFloat(flightOffers[0].price?.grandTotal || "0");

//     // Calculate margin and total
//     const marginAdded = (marginPercentage / 100) * basePriceNGN;
//     const originalTotalAmount = basePriceNGN + marginAdded;

//     // Get conversion rate USD -> NGN for addons
//     const conversionRate = await getConversionRate("USD", "NGN");

//     // Fetch addons and calculate total addon price in NGN
//     let addons: any[] = [];
//     let addonTotalNGN = 0;
//     if (addonIds.length > 0) {
//       addons = await prisma.flightAddon.findMany({
//         where: { id: { in: addonIds } },
//       });
//       if (addons.length !== addonIds.length) {
//         return res.status(400).json({
//           success: false,
//           message: "One or more addonIds are invalid",
//         });
//       }
//       addonTotalNGN = addons.reduce((sum, addon) => {
//         const priceInUsd = addon.price;
//         const priceInNgn = priceInUsd * conversionRate;
//         return sum + priceInNgn;
//       }, 0);
//     }

//     // Calculate grand total amount including addons
//     const totalAmountNGN = originalTotalAmount + addonTotalNGN;

//     // Step 1: Create booking (without addons)
//     const bookingData: any = {
//       userId,
//       referenceId: amadeusBooking.data.id,
//       type: "FLIGHT",
//       status: "CONFIRMED",
//       verified: true,
//       apiProvider: "AMADEUS",
//       apiReferenceId: amadeusBooking.data.id,
//       apiResponse: amadeusBooking,
//       bookingDetails: flightOffer,
//       totalAmount: +totalAmountNGN.toFixed(2),
//       currency: "NGN",
//       locationDetails: {},
//       airlineDetails: {},
//     };

//     const booking = await prisma.booking.create({ data: bookingData });

//     // Step 2: Link existing addons to booking by updating bookingId
//     if (addonIds.length > 0) {
//       await prisma.flightAddon.updateMany({
//         where: { id: { in: addonIds } },
//         data: { bookingId: booking.id },
//       });
//     }

//     // Step 3: Save travelers linked to booking
//     for (const t of travelers) {
//       await prisma.traveler.create({
//         data: {
//           bookingId: booking.id,
//           userId, // link traveler to registered user
//           firstName: t.name.firstName || t.firstName,
//           lastName: t.name.lastName || t.lastName,
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

//     // Step 4: Fetch booking with addons included
//     const bookingWithAddons = await prisma.booking.findUnique({
//       where: { id: booking.id },
//       include: { FlightAddon: true },
//     });

//     return res.status(201).json({
//       success: true,
//       message: "Flight successfully booked with addons",
//       booking: bookingWithAddons,
//       amadeus: amadeusBooking,
//       originalTotalAmount: +originalTotalAmount.toFixed(2),
//       addonTotal: +addonTotalNGN.toFixed(2),
//       totalAmount: +totalAmountNGN.toFixed(2),
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
  const { flightOffer, travelers, addonIds = [], userId } = req.body;

  try {
    console.log("Received booking request with:", {
      flightOfferExists: !!flightOffer,
      travelersCount: travelers?.length || 0,
      addonIds,
      userId,
      travelers,
      flightOffer,
    });

    if (!flightOffer || !travelers) {
      return res.status(400).json({
        error: "Missing required fields: flightOffer or travelers",
      });
    }

    // Validate userId
    if (!userId) {
      return res
        .status(400)
        .json({ error: "userId is required for this booking endpoint." });
    }
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      return res.status(400).json({ error: "Invalid userId: user not found" });
    }

    // Transform travelers to Amadeus format if needed
    const amadeusTravelers = travelers.map((t: any, idx: number) =>
      t.name && t.contact && t.documents
        ? { ...t, id: (idx + 1).toString() }
        : mapTravelerToAmadeusFormat(t, (idx + 1).toString())
    );

    // Add null checks before mapping
    if (!amadeusTravelers[0]?.name?.firstName) {
      return res.status(400).json({
        error: "Missing firstName in traveler data",
      });
    }

    console.log(`amadeusTravelers`, amadeusTravelers);

    const token = await getAmadeusToken();

    // Prepare Amadeus booking payload
    const payload = {
      data: {
        type: "flight-order",
        flightOffers: [flightOffer],
        travelers: amadeusTravelers,
        holder: {
          name: {
            firstName:
              amadeusTravelers[0]?.name?.firstName || "UNKNOWN_FIRSTNAME",
            lastName: amadeusTravelers[0]?.name?.lastName || "UNKNOWN_LASTNAME",
          },
        },
      },
    };

    console.log(`payload here; `, payload);
    // console.log(`payload here; `, JSON.stringify(payload));

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
    console.log(`Amadeus Response:`, response.data.data);

    const amadeusBooking: any = response.data;
    console.log(`amadeusBooking Response:`, response.data);

    // Margin settings
    const marginSetting: any = await prisma.marginSetting.findFirst({
      orderBy: { createdAt: "desc" },
    });
    if (!marginSetting) {
      return res.status(500).json({ error: "Margin setting not configured" });
    }
    const marginPercentage = marginSetting.amount;

    // Extract base price from Amadeus response
    const flightOffers = amadeusBooking?.data?.flightOffers || [];
    if (flightOffers.length === 0) {
      return res
        .status(500)
        .json({ error: "No flight offers found in Amadeus response" });
    }
    const basePriceNGN = parseFloat(flightOffers[0].price?.grandTotal || "0");

    // Calculate margin and total
    const marginAdded = (marginPercentage / 100) * basePriceNGN;
    const originalTotalAmount = basePriceNGN + marginAdded;

    // Get conversion rate USD -> NGN for addons
    const conversionRate = await getConversionRate("USD", "NGN");

    // Fetch addons and calculate total addon price in NGN
    let addons: any[] = [];
    let addonTotalNGN = 0;
    if (addonIds.length > 0) {
      addons = await prisma.flightAddon.findMany({
        where: { id: { in: addonIds } },
      });
      if (addons.length !== addonIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more addonIds are invalid",
        });
      }
      addonTotalNGN = addons.reduce((sum, addon) => {
        const priceInUsd = addon.price;
        const priceInNgn = priceInUsd * conversionRate;
        return sum + priceInNgn;
      }, 0);
    }

    // Calculate grand total amount including addons
    const totalAmountNGN = originalTotalAmount + addonTotalNGN;

    // Step 1: Create booking (without addons)
    const bookingData: any = {
      userId,
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
    };

    const booking = await prisma.booking.create({ data: bookingData });

    // Step 2: Link existing addons to booking by updating bookingId
    if (addonIds.length > 0) {
      await prisma.flightAddon.updateMany({
        where: { id: { in: addonIds } },
        data: { bookingId: booking.id },
      });
    }

    // Step 3: Save travelers linked to booking
    for (const t of travelers) {
      await prisma.traveler.create({
        data: {
          bookingId: booking.id,
          userId, // link traveler to registered user
          firstName: t.name.firstName || t.firstName,
          lastName: t.name.lastName || t.lastName,
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

    // Step 4: Clear user's cart after successful booking
    await prisma.flightCart.deleteMany({
      where: { userId: userId },
    });
    console.log(`Cleared cart for user: ${userId}`);

    // Step 5: Fetch booking with addons included
    const bookingWithAddons = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { FlightAddon: true },
    });

    return res.status(201).json({
      success: true,
      message: "Flight successfully booked with addons",
      booking: bookingWithAddons,
      amadeus: amadeusBooking,
      originalTotalAmount: +originalTotalAmount.toFixed(2),
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

export async function bookFlightAsGuest(
  req: Request,
  res: Response
): Promise<any> {
  const { flightOffer, travelers, addonIds = [], guestUserId } = req.body;

  try {
    console.log("Received booking request with:", {
      flightOfferExists: !!flightOffer,
      travelersCount: travelers?.length || 0,
      addonIds,
      travelers,
      flightOffer,
      guestUserId,
    });

    if (!flightOffer || !travelers) {
      return res.status(400).json({
        error: "Missing required fields: flightOffer or travelers",
      });
    }

    // Validate guestUserId
    if (!guestUserId) {
      return res
        .status(400)
        .json({ error: "guestUserId is required for guest booking." });
    }
    const guestExists = await prisma.guestUser.findUnique({
      where: { id: guestUserId },
    });
    if (!guestExists) {
      return res
        .status(400)
        .json({ error: "Invalid guestUserId: guest user not found" });
    }

    // Transform travelers to Amadeus format if needed
    const amadeusTravelers = travelers.map((t: any, idx: number) =>
      t.name && t.contact && t.documents
        ? { ...t, id: (idx + 1).toString() }
        : mapTravelerToAmadeusFormat(t, (idx + 1).toString())
    );

    const token = await getAmadeusToken();

    // Prepare Amadeus booking payload
    const payload = {
      data: {
        type: "flight-order",
        flightOffers: [flightOffer],
        travelers: amadeusTravelers,
        holder: {
          name: {
            firstName: amadeusTravelers[0].name.firstName,
            lastName: amadeusTravelers[0].name.lastName,
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

    // Margin settings
    const marginSetting: any = await prisma.marginSetting.findFirst({
      orderBy: { createdAt: "desc" },
    });
    if (!marginSetting) {
      return res.status(500).json({ error: "Margin setting not configured" });
    }
    const marginPercentage = marginSetting.amount;

    // Extract base price from Amadeus response
    const flightOffers = amadeusBooking?.data?.flightOffers || [];
    if (flightOffers.length === 0) {
      return res
        .status(500)
        .json({ error: "No flight offers found in Amadeus response" });
    }
    const basePriceNGN = parseFloat(flightOffers[0].price?.grandTotal || "0");

    // Calculate margin and total
    const marginAdded = (marginPercentage / 100) * basePriceNGN;
    const originalTotalAmount = basePriceNGN + marginAdded;

    // Get conversion rate USD -> NGN for addons
    const conversionRate = await getConversionRate("USD", "NGN");

    // Fetch addons and calculate total addon price in NGN
    let addons: any[] = [];
    let addonTotalNGN = 0;
    if (addonIds.length > 0) {
      addons = await prisma.flightAddon.findMany({
        where: { id: { in: addonIds } },
      });
      if (addons.length !== addonIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more addonIds are invalid",
        });
      }
      addonTotalNGN = addons.reduce((sum, addon) => {
        const priceInUsd = addon.price;
        const priceInNgn = priceInUsd * conversionRate;
        return sum + priceInNgn;
      }, 0);
    }

    // Calculate grand total amount including addons
    const totalAmountNGN = originalTotalAmount + addonTotalNGN;

    // Step 1: Create booking (without addons)
    const bookingData: any = {
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
    };

    const booking = await prisma.booking.create({ data: bookingData });

    // Step 2: Link existing addons to booking by updating bookingId
    if (addonIds.length > 0) {
      await prisma.flightAddon.updateMany({
        where: { id: { in: addonIds } },
        data: { bookingId: booking.id },
      });
    }

    // Step 3: Save travelers linked to booking
    for (const t of travelers) {
      await prisma.traveler.create({
        data: {
          bookingId: booking.id,
          guestUserId, // link traveler to guest user
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

    // Step 4: Fetch booking with addons included
    const bookingWithAddons = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { FlightAddon: true },
    });

    return res.status(201).json({
      success: true,
      message: "Flight successfully booked with addons",
      booking: bookingWithAddons,
      amadeus: amadeusBooking,
      originalTotalAmount: +originalTotalAmount.toFixed(2),
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

// PATCH /booking/:referenceId/status
export async function updateBookingStatus(
  req: Request,
  res: Response
): Promise<Response | any> {
  const { referenceId } = req.params;
  const { status, verified } = req.body;

  if (!referenceId) {
    return res.status(400).json({ error: "referenceId is required" });
  }
  if (!status && typeof verified === "undefined") {
    return res
      .status(400)
      .json({ error: "At least one of status or verified must be provided" });
  }

  try {
    const booking = await prisma.booking.findUnique({ where: { referenceId } });
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const updatedBooking = await prisma.booking.update({
      where: { referenceId },
      data: {
        ...(status && { status }),
        ...(typeof verified === "boolean" && { verified }),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Booking status updated successfully",
      booking: updatedBooking,
    });
  } catch (error: any) {
    console.error("Error updating booking status:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to update booking status",
      error: error.message,
    });
  }
}

// Cache or fetch airport details by IATA code
async function getCachedLocationDetail(iataCode: string, token: string) {
  const response: any = await axios.get(
    `${baseURL}/v1/reference-data/locations`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: {
        subType: "AIRPORT",
        keyword: iataCode.toUpperCase(),
      },
    }
  );
  if (response.data && response.data.data && response.data.data.length > 0) {
    return response.data.data[0];
  }
  return null;
}

// New endpoint to get airport name/details by IATA code
export async function getAirportDetails(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { iataCode } = req.query;

    if (!iataCode || typeof iataCode !== "string") {
      return res.status(400).json({ error: "Missing or invalid IATA code" });
    }

    const token = await getAmadeusToken();

    const airportDetails = await getCachedLocationDetail(iataCode, token);

    if (!airportDetails) {
      return res.status(404).json({ error: "Airport not found" });
    }

    return res.status(200).json({
      iataCode: airportDetails.iataCode,
      name: airportDetails.name,
      detailedName: airportDetails.detailedName,
      city: airportDetails.address?.cityName,
      cityCode: airportDetails.address?.cityCode,
      country: airportDetails.address?.countryName,
      countryCode: airportDetails.address?.countryCode,
      regionCode: airportDetails.address?.regionCode,
      timeZone: airportDetails.timeZoneOffset,
      coordinates: airportDetails.geoCode,
      analytics: airportDetails.analytics,
      type: airportDetails.type,
      subType: airportDetails.subType,
      id: airportDetails.id,
      selfLink: airportDetails.self?.href,
    });
  } catch (error: any) {
    console.error(
      "Airport details error:",
      error.response?.data || error.message
    );
    return res.status(500).json({
      error: "Failed to fetch airport details",
      details: error.response?.data || error.message,
    });
  }
}

// Function to get airline details by IATA code
async function getAirlineDetails(iataCode: string, token: string) {
  const response: any = await axios.get(
    `${baseURL}/v1/reference-data/airlines?airlineCodes=${iataCode}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (response.data && response.data.data && response.data.data.length > 0) {
    return response.data.data[0]; // airline details object
  }
  return null;
}

// Express route handler to get airline details
export async function getAirlineDetailsEndpoint(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { iataCode } = req.query;

    if (!iataCode || typeof iataCode !== "string") {
      return res.status(400).json({ error: "Missing or invalid IATA code" });
    }

    const token = await getAmadeusToken();

    const airlineDetails = await getAirlineDetails(iataCode, token);

    if (!airlineDetails) {
      return res.status(404).json({ error: "Airline not found" });
    }

    return res.status(200).json({
      iataCode,
      type: airlineDetails?.type,
      icaoCode: airlineDetails?.icaoCode,
      businessName: airlineDetails?.businessName,
      commonName: airlineDetails?.businessName,
    });
  } catch (error: any) {
    console.error(
      "Airline details error:",
      error.response?.data || error.message
    );
    return res.status(500).json({
      error: "Failed to fetch airline details",
      details: error.response?.data || error.message,
    });
  }
}

// Search flights departing from the airport to any destination (limited results)
async function searchFlightsFromAirport(
  originIata: string,
  destinationIata: string,
  departureDate: string,
  adults: number,
  token: string
): Promise<any[]> {
  const response: any = await axios.get(
    `${baseURL}/v2/shopping/flight-offers`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: {
        originLocationCode: originIata,
        destinationLocationCode: destinationIata,
        departureDate: departureDate,
        adults: adults,
        max: 50,
      },
    }
  );
  return response.data.data || [];
}

// Fetch airline details by multiple airline codes (comma separated)
async function getAirlinesDetails(
  airlineCodes: string[],
  token: string
): Promise<any[]> {
  if (airlineCodes.length === 0) return [];

  const codesParam = airlineCodes.join(",");

  const response: any = await axios.get(
    `${baseURL}/v1/reference-data/airlines?airlineCodes=${codesParam}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data.data || [];
}

// Express route handler to get airlines operating at an airport via flight offers
export async function getAirlinesByAirport(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { iataCode, destinationCode, departureDate, adults } = req.query;

    if (
      !iataCode ||
      typeof iataCode !== "string" ||
      !destinationCode ||
      typeof destinationCode !== "string" ||
      !departureDate ||
      typeof departureDate !== "string" ||
      !adults ||
      isNaN(Number(adults))
    ) {
      return res.status(400).json({
        error:
          "Missing or invalid parameters: iataCode, destinationCode, departureDate, adults are required",
      });
    }

    const iataCodeUpper = iataCode.toUpperCase();
    const destinationCodeUpper = destinationCode.toUpperCase();

    const token = await getAmadeusToken();

    console.log(`token`, token);

    // Step 1: Search flight offers departing from the airport
    const flightOffers = await searchFlightsFromAirport(
      iataCodeUpper,
      destinationCodeUpper,
      departureDate,
      Number(adults),
      token
    );
    console.log(`flightOffers`, flightOffers);

    // Step 2: Extract unique airline codes from flight offers
    const airlineCodesSet = new Set<string>();
    for (const offer of flightOffers) {
      if (
        offer.validatingAirlineCodes &&
        offer.validatingAirlineCodes.length > 0
      ) {
        offer.validatingAirlineCodes.forEach((code: string) =>
          airlineCodesSet.add(code)
        );
      }
      // Also consider segments airline codes if needed:
      if (offer.itineraries) {
        offer.itineraries.forEach((itinerary: any) => {
          itinerary.segments.forEach((segment: any) => {
            if (segment.carrierCode) airlineCodesSet.add(segment.carrierCode);
          });
        });
      }
    }
    const airlineCodes = Array.from(airlineCodesSet);
    console.log(`airlineCodes`, airlineCodes);

    if (airlineCodes.length === 0) {
      return res.status(200).json({
        message: "No airlines found for the given airport",
        airlines: [],
      });
    }

    // Step 3: Fetch airline details for these airline codes
    const airlinesDetails = await getAirlinesDetails(airlineCodes, token);
    console.log(`airlinesDetails`, airlinesDetails);

    // Step 4: Return airline details
    return res.status(200).json({
      airport: iataCodeUpper,
      airlines: airlinesDetails.map((airline) => ({
        iataCode: airline.iataCode,
        icaoCode: airline.icaoCode,
        businessName: airline.businessName || airline.name || null,
        type: airline.type,
      })),
    });
  } catch (error: any) {
    console.error(
      "Error fetching airlines by airport:",
      error.response?.data || error.message
    );
    return res.status(500).json({
      error: "Failed to fetch airlines for the airport",
      details: error.response?.data || error.message,
    });
  }
}

export async function getAirlinesByMultipleLocations(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { iataCodes } = req.query;

    if (!iataCodes || typeof iataCodes !== "string") {
      return res
        .status(400)
        .json({ error: "Missing or invalid 'iataCodes' query parameter" });
    }

    // Split comma-separated IATA codes and uppercase them
    const airports = iataCodes
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter((code) => code.length === 3);

    if (airports.length === 0) {
      return res
        .status(400)
        .json({ error: "No valid IATA codes provided in 'iataCodes'" });
    }

    const token = await getAmadeusToken();

    const airlineCodesSet = new Set<string>();

    // Fetch routes for each airport to get airline codes
    for (const airport of airports) {
      try {
        const response: any = await axios.get(`${baseURL}/v1/airport/routes`, {
          params: { departureAirportCode: airport },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const routes = response.data.data || [];
        for (const route of routes) {
          if (route.airlineCode) {
            airlineCodesSet.add(route.airlineCode);
          }
        }
      } catch (err: any) {
        console.warn(
          `Failed to fetch routes for airport ${airport}:`,
          err.response?.data || err.message
        );
        // Continue for other airports even if one fails
      }
    }

    const airlineCodes = Array.from(airlineCodesSet);
    if (airlineCodes.length === 0) {
      return res.status(200).json({
        message: "No airlines found for the provided airports",
        airlines: [],
      });
    }

    // Fetch airline details in bulk
    const airlinesResponse: any = await axios.get(
      `${baseURL}/v1/reference-data/airlines`,
      {
        params: { airlineCodes: airlineCodes.join(",") },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const airlines = airlinesResponse.data.data || [];

    return res.status(200).json({
      airports,
      airlines,
    });
  } catch (error: any) {
    console.error(
      "Error fetching airlines by multiple locations:",
      error.response?.data || error.message
    );
    return res.status(500).json({
      error: "Failed to fetch airlines for the provided locations",
      details: error.response?.data || error.message,
    });
  }
}

// Fallback random IATA codes if input invalid or missing

const fallbackOrigins = [
  "JFK",
  "LHR",
  "CDG",
  "FRA",
  "DXB",
  "NRT",
  "HKG",
  "YYZ",
  "ORD",
  "ATL",
  "ICN",
  "MAD",
  "GRU",
  "JNB",
  "DEL",
];

const fallbackDestinations = [
  "LAX",
  "AMS",
  "HND",
  "SIN",
  "SYD",
  "BKK",
  "SFO",
  "MIA",
  "MEX",
  "BCN",
  "MUC",
  "KUL",
  "DOH",
  "IST",
  "CAI",
];

const flightOfferCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

const extendedFallbacks = new Map<string, string>([
  ["JFK", "New York"],
  ["LHR", "London"],
  ["CDG", "Paris"],
  ["FRA", "Frankfurt"],
  ["DXB", "Dubai"],
  ["NRT", "Tokyo"],
  // Add more mappings as needed
]);

function getRandomFromArray(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isValidIataCode(code: string): boolean {
  return (
    typeof code === "string" && code.length === 3 && /^[A-Z]{3}$/.test(code)
  );
}

async function getCityOrFallback(
  iataCode: string,
  token: string
): Promise<string> {
  if (!isValidIataCode(iataCode)) return "Unknown Location";

  if (extendedFallbacks.has(iataCode)) {
    return extendedFallbacks.get(iataCode)!;
  }

  try {
    const response: any = await axios.get(
      `${baseURL}/v1/reference-data/locations`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          keyword: iataCode,
          subType: "AIRPORT",
          "page[limit]": 1,
        },
      }
    );

    const location = response.data.data?.[0];
    return location?.address?.cityName || iataCode;
  } catch (error: any) {
    console.error(
      `Failed to fetch city for IATA code ${iataCode}:`,
      error.message
    );
    return iataCode;
  }
}

async function enrichFlightOffersWithLocations(offers: any[], token: string) {
  const uniqueIatas = new Set<string>();
  const locationMap = new Map<string, string>();

  offers.forEach((offer) => {
    const segment = offer.itineraries?.[0]?.segments?.[0];
    if (segment?.departure?.iataCode)
      uniqueIatas.add(segment.departure.iataCode);
    if (segment?.arrival?.iataCode) uniqueIatas.add(segment.arrival.iataCode);
  });

  // Process in batches to avoid rate limiting
  const batchSize = 6;
  const iataArray = Array.from(uniqueIatas);

  for (let i = 0; i < iataArray.length; i += batchSize) {
    const batch = iataArray.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (iata) => {
        const city = await getCityOrFallback(iata, token);
        locationMap.set(iata, city);
      })
    );

    // Add delay between batches if needed
    if (i + batchSize < iataArray.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return offers.map((offer) => {
    const segment = offer.itineraries?.[0]?.segments?.[0];
    const fromIata = segment?.departure?.iataCode;
    const toIata = segment?.arrival?.iataCode;

    return {
      ...offer,
      fromCity: fromIata
        ? locationMap.get(fromIata) || fromIata
        : "Unknown Location",
      toCity: toIata ? locationMap.get(toIata) || toIata : "Unknown Location",
    };
  });
}

function removeDuplicateOffers(offers: any[]): any[] {
  const seen = new Set<string>();
  return offers.filter((offer) => {
    if (!offer.id) return true;
    if (seen.has(offer.id)) return false;
    seen.add(offer.id);
    return true;
  });
}

export async function getFlightOffersRandom(
  req: Request,
  res: Response
): Promise<Response | any> {
  try {
    const cacheKey = JSON.stringify(req.query);
    const cachedResponse = flightOfferCache.get(cacheKey);

    if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL) {
      return res.status(200).json({ data: cachedResponse.data });
    }

    const token = await getAmadeusToken();

    let { origin, destination, adults, departureDate, currencyCode } =
      req.query;

    if (!isValidIataCode(origin as string)) {
      origin = getRandomFromArray(fallbackOrigins);
    }
    if (!isValidIataCode(destination as string)) {
      destination = getRandomFromArray(fallbackDestinations);
    }

    const adultsNum =
      adults && !isNaN(Number(adults)) && Number(adults) > 0
        ? Number(adults)
        : 1;

    const today = new Date();
    const defaultDeparture = new Date(today.setDate(today.getDate() + 7))
      .toISOString()
      .split("T")[0];
    if (
      !departureDate ||
      typeof departureDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(departureDate)
    ) {
      departureDate = defaultDeparture;
    }

    if (
      !currencyCode ||
      typeof currencyCode !== "string" ||
      currencyCode.length !== 3
    ) {
      currencyCode = "USD";
    }

    const params = {
      originLocationCode: (origin as string).toUpperCase(),
      destinationLocationCode: (destination as string).toUpperCase(),
      departureDate,
      adults: adultsNum,
      max: 6,
      currencyCode: (currencyCode as string).toUpperCase(),
    };

    const response: any = await axios.get(
      `${baseURL}/v2/shopping/flight-offers`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "public, max-age=300",
        },
        params,
      }
    );

    const offers = response.data.data || [];
    const uniqueOffers = removeDuplicateOffers(offers);
    const enrichedOffers = await enrichFlightOffersWithLocations(
      uniqueOffers,
      token
    );

    flightOfferCache.set(cacheKey, {
      data: enrichedOffers,
      timestamp: Date.now(),
    });

    return res.status(200).json({ data: enrichedOffers });
  } catch (error: any) {
    console.error(
      "Amadeus flight offers error:",
      error.response?.data || error.message
    );

    const cacheKey = JSON.stringify(req.query);
    const cachedResponse = flightOfferCache.get(cacheKey);
    if (cachedResponse) {
      return res.status(200).json({ data: cachedResponse.data });
    }

    return res.status(500).json({ error: "Failed to fetch flight offers" });
  }
}

// const flightPricingCache = new Map<string, any>();

export async function getFlightOfferDetails(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { flightOffer } = req.body;

    // Basic validation
    if (!flightOffer || typeof flightOffer !== "object") {
      res.status(400).json({ error: "Flight offer object is required" });
      return;
    }

    // Verify required fields
    if (!flightOffer.id || !flightOffer.itineraries || !flightOffer.price) {
      res.status(400).json({
        error: "Invalid flight offer structure",
        requiredFields: ["id", "itineraries", "price"],
      });
      return;
    }

    // Get Amadeus token
    const token = await getAmadeusToken();
    if (!token) {
      res.status(500).json({ error: "Failed to authenticate with Amadeus" });
      return;
    }

    // Prepare request body for Amadeus API
    const requestBody = {
      data: {
        type: "flight-offers-pricing",
        flightOffers: [flightOffer],
      },
    };

    // Call Amadeus pricing API
    const response: any = await axios.post(
      `${baseURL}/v2/shopping/flight-offers/pricing`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    // Return the priced flight offer
    res.status(200).json(response.data.data);
  } catch (error: any) {
    console.error("Flight offer details error:", error.message);

    // Handle Amadeus API errors
    if (error.response?.data?.errors) {
      const errors = error.response.data.errors
        .map((err: any) => `${err.code}: ${err.detail}`)
        .join("; ");
      res.status(400).json({
        error: "Amadeus API error",
        details: errors,
      });
      return;
    }

    // Handle other errors
    res.status(500).json({
      error: "Failed to get flight details",
      details: error.message,
    });
  }
}
