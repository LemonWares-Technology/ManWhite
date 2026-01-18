import { Request, Response } from "express";
import getAmadeusToken from "../utils/getToken";
import axios from "axios";
import { prisma } from "../lib/prisma";
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
      return res
        .status(400)
        .json({ error: "keyword query parameter is required" });
    }

    if (keyword.length < 3) {
      return res
        .status(400)
        .json({ error: "keyword must be at least 3 characters long" });
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
      return res.status(200).json({
        suggestions: [],
        message: "No hotels found for the given keyword",
      });
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

    return res.status(200).json({
      data: hotels,
      count: hotels.length,
      keyword: keyword.trim(),
    });
  } catch (error: any) {
    console.error(
      "Error fetching hotel autocomplete:",
      error.response?.data || error.message
    );

    // Handle specific Amadeus errors
    if (error.response?.status === 400) {
      return res.status(400).json({
        error: "Invalid request parameters",
        details: error.response?.data,
      });
    }

    if (error.response?.status === 401) {
      return res.status(401).json({
        error: "Authentication failed",
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        message: "Too many requests. Please try again later.",
      });
    }

    return res.status(500).json({
      error: "Failed to fetch hotel autocomplete suggestions",
      ...(process.env.NODE_ENV === "development" && {
        details: error.message,
      }),
    });
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
      return res.status(400).json({
        message: "Missing required query parameters: CityCode is required.",
      });
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

    return res.status(200).json({
      message: "Hotels fetched successfully",
      data: hotelResponse.data, // Return only the data part
    });
  } catch (error: any) {
    console.error("Error fetching hotels:", error); // log the entire error
    console.error("Amadeus API Error Details:", error.response?.data); // log details

    return res.status(500).json({
      message: "Error occurred while searching for hotels",
      error: error.message || "Unknown error",
      amadeusError: error.response?.data, // include Amadeus error details in the response
    });
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
      return res.status(400).json({
        error: "Missing required parameter: hotelIds",
      });
    }

    if (!checkInDate || !checkOutDate) {
      return res.status(400).json({
        error:
          "Missing required parameters: checkInDate and checkOutDate are required",
      });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (
      !dateRegex.test(checkInDate as string) ||
      !dateRegex.test(checkOutDate as string)
    ) {
      return res.status(400).json({
        error: "Invalid date format. Use YYYY-MM-DD format",
      });
    }

    // Validate that check-in is before check-out
    if (new Date(checkInDate as string) >= new Date(checkOutDate as string)) {
      return res.status(400).json({
        error: "checkInDate must be before checkOutDate",
      });
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

    return res.status(200).json({
      message: "Hotel offers retrieved successfully",
      data: formattedOffers,
      count: formattedOffers.length,
      searchParams: {
        hotelIds,
        checkInDate,
        checkOutDate,
        adults: adults || 1,
        ...(children && { children }),
        ...(rooms && { rooms }),
        ...(currency && { currency }),
      },
    });
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
        return res.status(200).json({
          message: "Search completed successfully",
          data: [],
          availability: {
            status: "NO_ROOMS_AVAILABLE",
            hotelId:
              errorDetails?.source?.parameter?.split("=")?.[1] || "unknown",
            reason:
              "No rooms available at the requested property for the selected dates",
            suggestions: [
              "Try different dates",
              "Check nearby hotels",
              "Modify guest count",
              "Contact hotel directly for availability",
            ],
          },
        });
      }

      // Handle "ROOM OR RATE NOT FOUND" error (code 11226)
      if (
        errorDetails?.code === 11226 ||
        errorDetails?.title === "ROOM OR RATE NOT FOUND"
      ) {
        return res.status(404).json({
          error: "Room or rate not found for the specified hotel and dates.",
          reason:
            "The requested room type or rate code does not exist or is unavailable.",
          suggestions: [
            "Verify the hotel ID and room/rate parameters.",
            "Try different dates or room configurations.",
            "Contact support if the problem persists.",
          ],
          details:
            process.env.NODE_ENV === "development" ? errorDetails : undefined,
        });
      }

      // Default 400 error handler
      return res.status(500).json({
        error: "Failed to fetch hotel offers",
        ...(process.env.NODE_ENV === "development" && {
          details: error.message,
        }),
      });
    }
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
      console.warn("Validation failed: Missing or invalid cityCode");
      return res.status(400).json({ error: "Missing or invalid cityCode" });
    }

    // Validate checkInDate and checkOutDate presence and format
    if (!checkInDate || !checkOutDate) {
      console.warn("Validation failed: Missing checkInDate or checkOutDate");
      return res
        .status(400)
        .json({ error: "Missing checkInDate or checkOutDate" });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (
      !dateRegex.test(checkInDate as string) ||
      !dateRegex.test(checkOutDate as string)
    ) {
      console.warn("Validation failed: Dates not in YYYY-MM-DD format");
      return res
        .status(400)
        .json({ error: "Dates must be in YYYY-MM-DD format" });
    }

    if (new Date(checkInDate as string) >= new Date(checkOutDate as string)) {
      console.warn("Validation failed: checkInDate is not before checkOutDate");
      return res
        .status(400)
        .json({ error: "checkInDate must be before checkOutDate" });
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
      console.info("No hotels found for the specified cityCode");
      return res.status(200).json({ message: "No hotels found", data: [] });
    }

    // Limit hotels to 50 to control load
    const limitedHotels = hotels.slice(0, 50);
    console.log(`Limiting to ${limitedHotels.length} hotels for offer search`);

    // Extract hotelIds
    const hotelIds = limitedHotels
      .map((hotel: any) => hotel.hotelId)
      .filter((id: string | undefined) => !!id);

    if (hotelIds.length === 0) {
      console.info("No hotelIds found in limited hotels");
      return res.status(200).json({ message: "No hotelIds found", data: [] });
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
      console.info("No hotel offers available for the selected dates");
      return res.status(200).json({
        message: "No hotel offers available for the selected dates",
        data: [],
      });
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

    console.log("Sending response with hotels and offers");
    return res.status(200).json({
      message: "Hotels with offers retrieved successfully",
      count: formattedHotelsWithOffers.length,
      data: formattedHotelsWithOffers,
      searchParams: {
        cityCode,
        checkInDate,
        checkOutDate,
        adults: adults || 1,
        ...(children && { children }),
        ...(rooms && { rooms }),
        ...(currency && { currency }),
      },
    });
  } catch (error: any) {
    console.error(
      "Error in searchHotelsWithOffers:",
      error.response?.data || error.message
    );
    return res.status(500).json({
      error: "Failed to fetch hotels with offers",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

export async function getOfferPricing(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { offerId } = req.params;

    if (!offerId) {
      return res.status(400).json({
        error: `Missing required parameter: offerId`,
      });
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

    return res.status(200).json({
      message: `Success`,
      data: response.data, // Return only the data, not the entire response object
    });
  } catch (error: any) {
    console.error(`Error fetching hotel offer:`, error);

    // Handle specific API errors
    if (error.response) {
      return res.status(error.response.status).json({
        error: error.response.data?.error?.message || "API request failed",
      });
    }

    return res.status(500).json({
      error: `Internal server error`,
    });
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
      return res.status(400).json({
        error: `Missing required parameter: hotelIds`,
      });
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

    return res.status(200).json({
      message: `Success`,
      data: response.data, // Return only the data
    });
  } catch (error: any) {
    console.error(`Error fetching hotel ratings:`, error);

    if (error.response) {
      return res.status(error.response.status).json({
        error: error.response.data?.error?.message || "API request failed",
      });
    }

    return res.status(500).json({
      error: `Internal server error`,
    });
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

    // Get user context from request (adjust based on your auth implementation)
    const currentUserId = req.User?.id || null; // Assuming you have user in req from auth middleware

    if (!data) {
      return res.status(400).json({
        error: "Missing booking data",
      });
    }

    // Validate required fields
    if (!data.guests || data.guests.length === 0) {
      return res.status(400).json({
        error: "At least one guest is required",
      });
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

    // Return success response
    return res.status(201).json({
      success: true,
      message: "Hotel booking completed successfully",
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
    });
  } catch (error: any) {
    console.error(
      "Error booking hotel:",
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
          "Hotel booking failed",
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
