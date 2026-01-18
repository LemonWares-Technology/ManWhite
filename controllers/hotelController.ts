import { Request, Response } from "express";
import getAmadeusToken from "../utils/getToken";
import axios from "axios";
import { prisma } from "../lib/prisma";
import { sendHotelBookingConfirmationEmail } from "../utils/zeptomail";
import { sendSuccess, sendError } from "../utils/apiResponse";
import {
  extractAmadeusReference,
  extractCurrency,
  extractTotalAmount,
  generateBookingReference,
} from "../utils/helper";

const baseURL: string = "https://test.api.amadeus.com";

// Autocomplete Hotel
export async function hotelAutocomplete(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { keyword, subType } = req.query;

    if (!keyword || typeof keyword !== "string") {
      return sendError(res, "keyword query parameter is required", 400);
    }

    if (keyword.length < 3) {
      return sendError(res, "keyword must be at least 3 characters long", 400);
    }

    const token = await getAmadeusToken();

    // Build query parameters
    const params: any = {
      keyword: keyword.trim(),
    };

    // Add subType if provided and valid
    if (subType && typeof subType === "string") {
      // Amadeus supports: HOTEL_LEISURE, HOTEL_GDS
      const validSubTypes = ["HOTEL_LEISURE", "HOTEL_GDS"];
      if (validSubTypes.includes(subType.toUpperCase())) {
        params.subType = subType.toUpperCase();
      }
    }

    // Call Amadeus Hotel List API by keyword (city or hotel name)
    const response: any = await axios.get(
      `${baseURL}/v1/reference-data/locations/hotel`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params: {
          keyword,
          subType: "HOTEL_GDS",
        },
        timeout: 10000, // 10 second timeout for autocomplete
      }
    );

    // Check if response has data
    const hotels = response.data?.data || [];

    if (hotels.length === 0) {
      return sendSuccess(res, "No hotels found for the given keyword", []);
    }

    // Extract relevant hotel info for autocomplete
    // const suggestions = hotels.map((hotel: any) => ({
    //   id: hotel.id,
    //   iataCode: hotel.iataCode,
    //   hotelId: hotel?.hotelIds[0],
    //   name: hotel.name,
    //   cityCode: hotel.address?.cityCode,
    //   cityName: hotel.address?.cityName,
    //   countryCode: hotel.address?.countryCode,
    //   countryName: hotel.address?.countryName,
    //   // Include coordinates if available for mapping
    //   ...(hotel.geoCode && {
    //     latitude: hotel.geoCode.latitude,
    //     longitude: hotel.geoCode.longitude,
    //   }),
    //   // Include distance if search was location-based
    // }));

    return sendSuccess(res, "Hotels fetched successfully", hotels);
  } catch (error: any) {
    console.error("Error fetching hotel autocomplete:", error.response?.data || error.message);
    return sendError(res, "Failed to fetch hotel autocomplete suggestions", error.response?.status || 500, error);
  }
}

// Hotel List / Search
export const searchHotels = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { cityCode } = req.query;

    if (!cityCode) {
      return sendError(res, "Missing required query parameters: CityCode is required.", 400);
    }

    const token = await getAmadeusToken();
    console.log("Token:", token); // Log the token for debugging

    const hotelResponse = await axios.get(
      `${baseURL}/v1/reference-data/locations/hotels/by-city`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          cityCode,
        },
      }
    );

    console.log("Keyword:", cityCode); // Log the keyword for debugging

    return sendSuccess(res, "Hotels fetched successfully", hotelResponse.data);
  } catch (error: any) {
    console.error("Error fetching hotels:", error);
    return sendError(res, "Error occurred while searching for hotels", 500, error);
  }
};

// Hotel Offers Search
export async function hotelOfferSearch(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const {
      hotelIds,
      checkInDate,
      checkOutDate,
      adults,
      children,
      rooms,
      currency,
      roomQuantity,
    } = req.query;

    // Validate required parameters
    if (!hotelIds) {
      return sendError(res, "Missing required parameter: hotelIds", 400);
    }

    if (!checkInDate || !checkOutDate) {
      return sendError(res, "Missing required parameters: checkInDate and checkOutDate are required", 400);
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (
      !dateRegex.test(checkInDate as string) ||
      !dateRegex.test(checkOutDate as string)
    ) {
      return sendError(res, "Invalid date format. Use YYYY-MM-DD format", 400);
    }

    // Validate that check-in is before check-out
    if (new Date(checkInDate as string) >= new Date(checkOutDate as string)) {
      return sendError(res, "checkInDate must be before checkOutDate", 400);
    }

    const token = await getAmadeusToken();

    // Build query parameters
    const params: any = {
      hotelIds,
      checkInDate,
      checkOutDate,
      adults: adults || 1, // Default to 1 adult
    };

    // Add optional parameters if provided
    if (children) params.children = children;
    if (rooms) params.rooms = rooms;
    if (currency) params.currency = currency;
    if (roomQuantity) params.roomQuantity = roomQuantity;

    console.log("Hotel offer search params:", params);

    const response: any = await axios.get(
      `${baseURL}/v3/shopping/hotel-offers`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params,
        timeout: 30000, // 30 second timeout
      }
    );

    // Extract and format the response data
    const offers = response.data?.data || [];

    // Transform the data for easier frontend consumption
    const formattedOffers = offers.map((hotel: any) => ({
      hotelId: hotel.hotel?.hotelId,
      hotelName: hotel.hotel?.name,
      hotelRating: hotel.hotel?.rating,
      address: {
        cityCode: hotel.hotel?.cityCode,
        cityName: hotel.hotel?.address?.cityName,
        countryCode: hotel.hotel?.address?.countryCode,
        lines: hotel.hotel?.address?.lines,
        postalCode: hotel.hotel?.address?.postalCode,
      },
      contact: hotel.hotel?.contact,
      amenities: hotel.hotel?.amenities,
      offers:
        hotel.offers?.map((offer: any) => ({
          id: offer.id,
          checkInDate: offer.checkInDate,
          checkOutDate: offer.checkOutDate,
          roomQuantity: offer.roomQuantity,
          rateCode: offer.rateCode,
          rateFamilyEstimated: offer.rateFamilyEstimated,
          room: {
            type: offer.room?.type,
            typeEstimated: offer.room?.typeEstimated,
            description: offer.room?.description?.text,
          },
          guests: offer.guests,
          price: {
            currency: offer.price?.currency,
            base: offer.price?.base,
            total: offer.price?.total,
            variations: offer.price?.variations,
          },
          policies: {
            paymentType: offer.policies?.paymentType,
            cancellation: offer.policies?.cancellation,
          },
          self: offer.self, // Important: This contains the offer URL for booking
        })) || [],
    }));

    return sendSuccess(res, "Hotel offers retrieved successfully", formattedOffers);
  } catch (error: any) {
    console.error(
      "Error fetching hotel offers:",
      error.response?.data || error.message
    );

    if (error.response?.status === 400) {
      const errorDetails = error.response?.data?.errors?.[0];

      // Handle specific "No rooms available" error
      if (
        errorDetails?.code === 3664 ||
        errorDetails?.title?.includes("NO ROOMS AVAILABLE")
      ) {
        return sendSuccess(res, "No rooms available for the selected dates", []);
      }

      // Handle "ROOM OR RATE NOT FOUND" error (code 11226)
      if (
        errorDetails?.code === 11226 ||
        errorDetails?.title === "ROOM OR RATE NOT FOUND"
      ) {
        return sendError(res, "Room or rate not found for the specified hotel and dates.", 404);
      }

      // Default 400 error handler
      return sendError(res, "Failed to fetch hotel offers", 500, error);
    }
    return sendError(res, "An unexpected error occurred", 500, error);
  }
}

// export async function searchHotelsAndOffers(
//   req: Request,
//   res: Response
// ): Promise<any> {
//   try {
//     // Extract query parameters
//     const {
//       cityCode,
//       checkInDate,
//       checkOutDate,
//       adults,
//       children,
//       rooms,
//       currency,
//       roomQuantity,
//     } = req.query;

//     console.log("Received combined search request with params:", req.query);

//     // Validate cityCode
//     if (!cityCode || typeof cityCode !== "string") {
//       console.warn("Missing or invalid cityCode parameter");
//       return res.status(400).json({
//         error: "Missing or invalid required parameter: cityCode",
//       });
//     }

//     // Validate checkInDate and checkOutDate presence and format
//     if (!checkInDate || !checkOutDate) {
//       console.warn("Missing checkInDate or checkOutDate parameter");
//       return res.status(400).json({
//         error: "Missing required parameters: checkInDate and checkOutDate are required",
//       });
//     }

//     const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
//     if (!dateRegex.test(checkInDate as string) || !dateRegex.test(checkOutDate as string)) {
//       console.warn("Invalid date format for checkInDate or checkOutDate");
//       return res.status(400).json({
//         error: "Invalid date format. Use YYYY-MM-DD format",
//       });
//     }

//     if (new Date(checkInDate as string) >= new Date(checkOutDate as string)) {
//       console.warn("checkInDate must be before checkOutDate");
//       return res.status(400).json({
//         error: "checkInDate must be before checkOutDate",
//       });
//     }

//     // Get Amadeus API token
//     console.log("Fetching Amadeus API token...");
//     const token = await getAmadeusToken();
//     console.log("Amadeus token acquired");

//     // Step 1: Fetch hotels by cityCode
//     console.log(`Fetching hotels for cityCode: ${cityCode}`);
//     const hotelResponse:any = await axios.get(
//       `${baseURL}/v1/reference-data/locations/hotels/by-city`,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//         params: { cityCode },
//       }
//     );

//     // After fetching hotels by cityCode
// const hotels = hotelResponse.data?.data || [];
// console.log(`Found ${hotels.length} hotels for cityCode ${cityCode}`);

// if (hotels.length === 0) {
//   console.info("No hotels found for the specified cityCode");
//   return res.status(200).json({
//     message: "No hotels found for the given cityCode",
//     data: [],
//   });
// }

// // Limit the number of hotels to 30 to reduce load
// const limitedHotels = hotels.slice(0, 30);
// console.log(`Limiting to ${limitedHotels.length} hotels for offer search`);

// // Extract hotelIds from limited hotels only
// const hotelIdsArray = limitedHotels
//   .map((hotel: any) => hotel.hotelId)
//   .filter((id: string | undefined) => !!id);

// if (hotelIdsArray.length === 0) {
//   console.info("No hotelIds found in the limited hotels data");
//   return res.status(200).json({
//     message: "No hotelIds found for hotels in the specified city",
//     data: [],
//   });
// }

// console.log(`Extracted ${hotelIdsArray.length} hotelIds from limited hotels`);

//     // Step 2: Fetch hotel offers for these hotelIds
//     const params: any = {
//       hotelIds: hotelIdsArray.join(','), // Comma-separated hotelIds string
//       checkInDate,
//       checkOutDate,
//       adults: adults || 1,
//     };

//     // Add optional parameters if provided
//     if (children) params.children = children;
//     if (rooms) params.rooms = rooms;
//     if (currency) params.currency = currency;
//     if (roomQuantity) params.roomQuantity = roomQuantity;

//     console.log("Fetching hotel offers with params:", params);
//     const offersResponse:any = await axios.get(
//       `${baseURL}/v3/shopping/hotel-offers`,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//         params,
//         timeout: 30000,
//       }
//     );

//     const offers = offersResponse.data?.data || [];
//     console.log(`Received ${offers.length} hotel offers`);

//     // Format offers for frontend consumption
//     const formattedOffers = offers.map((hotel: any) => ({
//       hotelId: hotel.hotel?.hotelId,
//       hotelName: hotel.hotel?.name,
//       hotelRating: hotel.hotel?.rating,
//       address: {
//         cityCode: hotel.hotel?.cityCode,
//         cityName: hotel.hotel?.address?.cityName,
//         countryCode: hotel.hotel?.address?.countryCode,
//         lines: hotel.hotel?.address?.lines,
//         postalCode: hotel.hotel?.address?.postalCode,
//       },
//       contact: hotel.hotel?.contact,
//       amenities: hotel.hotel?.amenities,
//       offers:
//         hotel.offers?.map((offer: any) => ({
//           id: offer.id,
//           checkInDate: offer.checkInDate,
//           checkOutDate: offer.checkOutDate,
//           roomQuantity: offer.roomQuantity,
//           rateCode: offer.rateCode,
//           rateFamilyEstimated: offer.rateFamilyEstimated,
//           room: {
//             type: offer.room?.type,
//             typeEstimated: offer.room?.typeEstimated,
//             description: offer.room?.description?.text,
//           },
//           guests: offer.guests,
//           price: {
//             currency: offer.price?.currency,
//             base: offer.price?.base,
//             total: offer.price?.total,
//             variations: offer.price?.variations,
//           },
//           policies: {
//             paymentType: offer.policies?.paymentType,
//             cancellation: offer.policies?.cancellation,
//           },
//           self: offer.self,
//         })) || [],
//     }));

//     console.log("Sending response with hotels and offers data");
//     return res.status(200).json({
//       message: "Hotels and offers retrieved successfully",
//       hotelsCount: hotels.length,
//       offersCount: formattedOffers.length,
//       hotels,
//       offers: formattedOffers,
//       searchParams: {
//         cityCode,
//         checkInDate,
//         checkOutDate,
//         adults: adults || 1,
//         ...(children && { children }),
//         ...(rooms && { rooms }),
//         ...(currency && { currency }),
//       },
//     });
//   } catch (error: any) {
//     console.error("Error fetching hotels and offers:", error.response?.data || error.message);

//     if (error.response?.status === 400) {
//       const errorDetails = error.response?.data?.errors?.[0];
//       if (
//         errorDetails?.code === 3664 ||
//         errorDetails?.title?.includes("NO ROOMS AVAILABLE")
//       ) {
//         console.warn("No rooms available for the requested property and dates");
//         return res.status(200).json({
//           message: "Search completed successfully",
//           data: [],
//           availability: {
//             status: "NO_ROOMS_AVAILABLE",
//             hotelId:
//               errorDetails?.source?.parameter?.split("=")?.[1] || "unknown",
//             reason:
//               "No rooms available at the requested property for the selected dates",
//             suggestions: [
//               "Try different dates",
//               "Check nearby hotels",
//               "Modify guest count",
//               "Contact hotel directly for availability",
//             ],
//           },
//         });
//       }
//       console.error("Failed to fetch hotel offers due to bad request");
//       return res.status(500).json({
//         error: "Failed to fetch hotel offers",
//         ...(process.env.NODE_ENV === "development" && {
//           details: error.message,
//         }),
//       });
//     }

//     return res.status(500).json({
//       error: "An error occurred while fetching hotels and offers",
//       ...(process.env.NODE_ENV === "development" && {
//         details: error.message,
//       }),
//     });
//   }
// }

/// Get Hotel Offer Details by ID

export async function searchHotelsWithOffers(
  req: Request,
  res: Response
): Promise<any> {
  try {
    console.log(
      "Received searchHotelsWithOffers request with query:",
      req.query
    );

    const {
      cityCode,
      checkInDate,
      checkOutDate,
      adults,
      children,
      rooms,
      currency,
      roomQuantity,
    } = req.query;

    // Validate cityCode
    if (!cityCode || typeof cityCode !== "string") {
      return sendError(res, "Missing or invalid cityCode", 400);
    }

    // Validate checkInDate and checkOutDate presence and format
    if (!checkInDate || !checkOutDate) {
      return sendError(res, "Missing checkInDate or checkOutDate", 400);
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (
      !dateRegex.test(checkInDate as string) ||
      !dateRegex.test(checkOutDate as string)
    ) {
      return sendError(res, "Dates must be in YYYY-MM-DD format", 400);
    }

    if (new Date(checkInDate as string) >= new Date(checkOutDate as string)) {
      return sendError(res, "checkInDate must be before checkOutDate", 400);
    }

    console.log("Validation passed for input parameters");

    // Get Amadeus API token
    console.log("Requesting Amadeus API token...");
    const token = await getAmadeusToken();
    console.log("Amadeus API token acquired");

    // Step 1: Fetch hotels by cityCode
    console.log(`Fetching hotels for cityCode: ${cityCode}`);
    const hotelResponse: any = await axios.get(
      `${baseURL}/v1/reference-data/locations/hotels/by-city`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { cityCode },
      }
    );

    const hotels = hotelResponse.data?.data || [];
    console.log(`Fetched ${hotels.length} hotels for cityCode ${cityCode}`);

    if (hotels.length === 0) {
      return sendSuccess(res, "No hotels found", []);
    }

    // Limit hotels to 50 to control load
    const limitedHotels = hotels.slice(0, 50);
    console.log(`Limiting to ${limitedHotels.length} hotels for offer search`);

    // Extract hotelIds
    const hotelIds = limitedHotels
      .map((hotel: any) => hotel.hotelId)
      .filter((id: string | undefined) => !!id);

    if (hotelIds.length === 0) {
      return sendSuccess(res, "No hotelIds found", []);
    }

    console.log(`Extracted ${hotelIds.length} hotelIds`);

    // Step 2: Fetch offers for hotelIds
    const offerParams: any = {
      hotelIds: hotelIds.join(","),
      checkInDate,
      checkOutDate,
      adults: adults || 1,
    };
    if (children) offerParams.children = children;
    if (rooms) offerParams.rooms = rooms;
    if (currency) offerParams.currency = currency;
    if (roomQuantity) offerParams.roomQuantity = roomQuantity;

    console.log("Fetching hotel offers with parameters:", offerParams);
    const offersResponse: any = await axios.get(
      `${baseURL}/v3/shopping/hotel-offers`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params: offerParams,
        timeout: 30000,
      }
    );

    const offersData = offersResponse.data?.data || [];
    console.log(`Received ${offersData.length} hotels with offers`);

    if (offersData.length === 0) {
      return sendSuccess(res, "No hotel offers available for the selected dates", []);
    }

    // Format hotels with offers for response
    const formattedHotelsWithOffers = offersData.map((hotel: any) => ({
      hotelId: hotel.hotel?.hotelId,
      hotelName: hotel.hotel?.name,
      hotelRating: hotel.hotel?.rating,
      address: {
        cityCode: hotel.hotel?.cityCode,
        cityName: hotel.hotel?.address?.cityName,
        countryCode: hotel.hotel?.address?.countryCode,
        lines: hotel.hotel?.address?.lines,
        postalCode: hotel.hotel?.address?.postalCode,
      },
      contact: hotel.hotel?.contact,
      amenities: hotel.hotel?.amenities,
      offers:
        hotel.offers?.map((offer: any) => ({
          id: offer.id,
          checkInDate: offer.checkInDate,
          checkOutDate: offer.checkOutDate,
          roomQuantity: offer.roomQuantity,
          rateCode: offer.rateCode,
          rateFamilyEstimated: offer.rateFamilyEstimated,
          room: {
            type: offer.room?.type,
            typeEstimated: offer.room?.typeEstimated,
            description: offer.room?.description?.text,
          },
          guests: offer.guests,
          price: {
            currency: offer.price?.currency,
            base: offer.price?.base,
            total: offer.price?.total,
            variations: offer.price?.variations,
          },
          policies: {
            paymentType: offer.policies?.paymentType,
            cancellation: offer.policies?.cancellation,
          },
          self: offer.self,
        })) || [],
    }));

    return sendSuccess(res, "Hotels with offers retrieved successfully", formattedHotelsWithOffers);
  } catch (error: any) {
    console.error("Error in searchHotelsWithOffers:", error.response?.data || error.message);
    return sendError(res, "Failed to fetch hotels with offers", 500, error);
  }
}

export async function getOfferPricing(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { offerId } = req.params;

    if (!offerId) {
      return sendError(res, "Missing required parameter: offerId", 400);
    }

    const token = await getAmadeusToken();

    const response = await axios.get(
      `${baseURL}/v3/shopping/hotel-offers/${offerId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return sendSuccess(res, "Success", response.data);
  } catch (error: any) {
    console.error(`Error fetching hotel offer:`, error);
    return sendError(res, "Internal server error", 500, error);
  }
}

/// Get Hotel Rating
export async function getHotelRating(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { hotelIds } = req.query;

    if (!hotelIds) {
      return sendError(res, "Missing required parameter: hotelIds", 400);
    }

    const token = await getAmadeusToken();

    const response = await axios.get(
      `${baseURL}/v2/e-reputation/hotel-sentiments`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          hotelIds: hotelIds, // Ensure this is a string of comma-separated IDs
        },
      }
    );

    return sendSuccess(res, "Success", response.data);
  } catch (error: any) {
    console.error(`Error fetching hotel ratings:`, error);
    return sendError(res, "Internal server error", 500, error);
  }
}

// /// Booking Hotel
// export async function bookHotel(req: Request, res: Response): Promise<any> {
//   try {
//     const { data } = req.body;

//     if (!data) {
//       return res
//         .status(400)
//         .json({ error: "Missing 'data' object in request body" });
//     }

//     const { guests, roomAssociations, payment, travelAgent } = data;

//     // Basic validation
//     if (!guests || !Array.isArray(guests) || guests.length === 0) {
//       return res.status(400).json({ error: "At least one guest is required" });
//     }

//     if (
//       !roomAssociations ||
//       !Array.isArray(roomAssociations) ||
//       roomAssociations.length === 0
//     ) {
//       return res
//         .status(400)
//         .json({ error: "roomAssociations with hotelOfferId is required" });
//     }

//     if (!payment) {
//       return res.status(400).json({ error: "Payment information is required" });
//     }

//     // Validate presence of tid in each guest and guestReferences in roomAssociations
//     for (const guest of guests) {
//       if (typeof guest.tid === "undefined") {
//         return res
//           .status(400)
//           .json({ error: "Each guest must have a 'tid' field" });
//       }
//     }

//     for (const room of roomAssociations) {
//       if (
//         !room.guestReferences ||
//         !Array.isArray(room.guestReferences) ||
//         room.guestReferences.length === 0
//       ) {
//         return res.status(400).json({
//           error:
//             "Each roomAssociation must have a non-empty 'guestReferences' array",
//         });
//       }
//       for (const ref of room.guestReferences) {
//         if (typeof ref.guestReference === "undefined") {
//           return res.status(400).json({
//             error:
//               "Each guestReference in roomAssociations must have a 'guestReference' field",
//           });
//         }
//       }
//     }

//     // Ensure the 'type' field is set to "hotel-order"
//     if (data.type !== "hotel-order") {
//       data.type = "hotel-order";
//     }

//     // Build the booking payload exactly as required by Amadeus API
//     const bookingPayload = { data };

//     // Get Amadeus OAuth token
//     const token = await getAmadeusToken();

//     // Log payload for debugging (remove in production)
//     console.log("Booking payload:", JSON.stringify(bookingPayload, null, 2));

//     // Call Amadeus Hotel Booking API
//     const response: any = await axios.post(
//       `${baseURL}/v2/booking/hotel-orders`,
//       bookingPayload,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//           Accept: "application/json",
//         },
//         timeout: 30000,
//       }
//     );

//     const amadeusResponse = response.data?.data;

//     // Generate your own unique reference for internal tracking
//     const referenceId = uuid();

//     // Extract booking details for your DB storage
//     const bookingDetails = {
//       guests,
//       roomAssociations,
//       hotelOfferId: roomAssociations[0]?.hotelOfferId,
//       checkInDate: amadeusResponse?.hotelBookings?.[0]?.hotelOffer?.checkInDate,
//       checkOutDate:
//         amadeusResponse?.hotelBookings?.[0]?.hotelOffer?.checkOutDate,
//       hotelName: amadeusResponse?.hotelBookings?.[0]?.hotel?.name,
//       address: amadeusResponse?.hotelBookings?.[0]?.hotel?.address,
//       confirmationNumber:
//         amadeusResponse?.hotelBookings?.[0]?.hotelProviderInformation?.[0]
//           ?.confirmationNumber,
//     };

//     // Save booking record in your database
//     const booking = await prisma.booking.create({
//       data: {
//         referenceId,
//         type: "HOTEL",
//         status: "CONFIRMED",
//         apiProvider: "AMADEUS",
//         apiReferenceId: amadeusResponse?.id,
//         apiResponse: amadeusResponse,
//         bookingDetails,
//         totalAmount: amadeusResponse?.hotelBookings?.[0]?.hotelOffer?.price
//           ?.total
//           ? parseFloat(amadeusResponse.hotelBookings[0].hotelOffer.price.total)
//           : undefined,
//         currency:
//           amadeusResponse?.hotelBookings?.[0]?.hotelOffer?.price?.currency ||
//           "EUR",
//       },
//     });

//     return res.status(200).json({
//       message: "Hotel successfully booked",
//       bookingId: amadeusResponse?.id,
//       confirmationNumber: bookingDetails.confirmationNumber,
//       data: amadeusResponse,
//       bookingRecord: booking,
//     });
//   } catch (error: any) {
//     console.error(
//       "Error booking hotel:",
//       error.response?.data || error.message
//     );

//     if (error.response) {
//       return res.status(error.response.status).json({
//         error: error.response.data || error.message,
//       });
//     }

//     return res.status(500).json({
//       error: "Internal server error",
//     });
//   }
// }

// /// Booking Hotel

// Helper function to extract Amadeus reference ID
export async function bookHotel(req: Request, res: Response): Promise<any> {
  try {
    const { data } = req.body;

    // @ts-ignore
    const currentUserId = req.user?.id || null; // Assuming you have user in req from auth middleware

    if (!data) {
      return sendError(res, "Missing booking data", 400);
    }

    // Validate required fields
    if (!data.guests || data.guests.length === 0) {
      return sendError(res, "At least one guest is required", 400);
    }

    // Get Amadeus access token
    const token = await getAmadeusToken();

    // Make booking request to Amadeus
    const amadeusResponse: any = await axios.post(
      `${process.env.AMADEUS_BASE_URL || `${baseURL}`}/v2/booking/hotel-orders`,
      { data },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Extract guest information
    const primaryGuest = data.guests[0];
    const guestEmail = primaryGuest.email;

    let userId: string | null = null;
    let guestUserId: string | null = null;

    // If we have a current user and their email matches, use their ID
    if (currentUserId) {
      const currentUser = await prisma.user.findUnique({
        where: { id: currentUserId },
      });

      if (currentUser && currentUser.email === guestEmail) {
        userId = currentUserId;
      }
    }

    // If no user match, try to find existing user by email
    if (!userId) {
      const existingUser = await prisma.user.findUnique({
        where: { email: guestEmail },
      });

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create or update guest user
        const guestUser = await prisma.guestUser.upsert({
          where: { email: guestEmail },
          update: {
            firstName: primaryGuest.firstName,
            lastName: primaryGuest.lastName,
            phone: primaryGuest.phone || null,
          },
          create: {
            email: guestEmail,
            firstName: primaryGuest.firstName,
            lastName: primaryGuest.lastName,
            phone: primaryGuest.phone || null,
          },
        });
        guestUserId = guestUser.id;
      }
    }

    // Create booking in database
    const booking = await prisma.booking.create({
      data: {
        userId: userId,
        guestUserId: guestUserId,
        referenceId: generateBookingReference(),
        type: "HOTEL",
        status: "CONFIRMED", // Assuming successful Amadeus booking means confirmed
        apiResponse: amadeusResponse.data,
        bookingDetails: {
          hotelOfferId: data.roomAssociations?.[0]?.hotelOfferId || null,
          guests: data.guests,
          roomAssociations: data.roomAssociations || [],
          travelAgent: data.travelAgent || null,
          checkIn: data.checkIn || null,
          checkOut: data.checkOut || null,
        },
        totalAmount: extractTotalAmount(amadeusResponse),
        currency: extractCurrency(amadeusResponse),
        apiProvider: "AMADEUS",
        apiReferenceId: extractAmadeusReference(amadeusResponse),
        verified: true, // Assuming Amadeus booking is verified
      },
    });

    // Create traveler records for each guest
    const travelerPromises = data.guests.map((guest: any, index: number) => {
      return prisma.traveler.create({
        data: {
          bookingId: booking.id,
          userId: userId,
          guestUserId: guestUserId,
          firstName: guest.firstName,
          lastName: guest.lastName,
          email: guest.email,
          phone: guest.phone || "",
          countryCode: guest.countryCode || "",
          gender:
            guest.title === "MR"
              ? "MALE"
              : guest.title === "MRS" || guest.title === "MS"
              ? "FEMALE"
              : "OTHER",
          dateOfBirth: guest.dateOfBirth
            ? new Date(guest.dateOfBirth)
            : new Date("1990-01-01"), // Default if not provided
          // Add other fields as available in your guest data
        },
      });
    });

    await Promise.all(travelerPromises);

    // Fetch the complete booking with relations
    const completeBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: {
        user: true,
        guestUser: true,
        travelers: true,
      },
    });

    // Send confirmation email
    if (completeBooking) {
      const emailRecipient = completeBooking.user || completeBooking.guestUser;
      if (emailRecipient && emailRecipient.email) {
        await sendHotelBookingConfirmationEmail(
          {
            hotelName: data.hotelName,
            checkInDate: data.checkInDate,
            checkOutDate: data.checkOutDate,
            guests: data.guests,
            totalAmount: booking.totalAmount,
            currency: booking.currency,
            bookingId: booking.referenceId,
          },
          {
            email: emailRecipient.email,
            name: (emailRecipient as any).name || 
                  `${(emailRecipient as any).firstName || ''} ${(emailRecipient as any).lastName || ''}`.trim() || 
                  "Guest",
          }
        );
      }
    }

    // Return success response
    return sendSuccess(res, "Hotel booking completed successfully", {
      booking: {
        id: completeBooking?.id,
        referenceId: completeBooking?.referenceId,
        status: completeBooking?.status,
        totalAmount: completeBooking?.totalAmount,
        currency: completeBooking?.currency,
        apiReferenceId: completeBooking?.apiReferenceId,
        createdAt: completeBooking?.createdAt,
        travelers: completeBooking?.travelers,
      },
      amadeusResponse: amadeusResponse.data,
    }, 201);
  } catch (error: any) {
    console.error("Error booking hotel:", error.response?.data || error.message);
    return sendError(res, "Hotel booking failed", error.response?.status || 500, error);
  }
}
