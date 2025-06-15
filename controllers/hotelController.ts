import { Request, Response } from "express";
import getAmadeusToken from "../utils/getToken";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import { v4 as uuid } from "uuid";

const baseURL: string = "https://test.api.amadeus.com";

const prisma = new PrismaClient();

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

    // Validate keyword length (Amadeus typically requires at least 3 characters)
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

/// Get Hotel Offer Details by ID
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

/// Booking Hotel
export async function bookHotel(req: Request, res: Response): Promise<any> {
  try {
    const { data } = req.body;

    if (!data) {
      return res
        .status(400)
        .json({ error: "Missing 'data' object in request body" });
    }

    const { guests, roomAssociations, payment, travelAgent } = data;

    // Basic validation
    if (!guests || !Array.isArray(guests) || guests.length === 0) {
      return res.status(400).json({ error: "At least one guest is required" });
    }

    if (
      !roomAssociations ||
      !Array.isArray(roomAssociations) ||
      roomAssociations.length === 0
    ) {
      return res
        .status(400)
        .json({ error: "roomAssociations with hotelOfferId is required" });
    }

    if (!payment) {
      return res.status(400).json({ error: "Payment information is required" });
    }

    // Validate presence of tid in each guest and guestReferences in roomAssociations
    for (const guest of guests) {
      if (typeof guest.tid === "undefined") {
        return res
          .status(400)
          .json({ error: "Each guest must have a 'tid' field" });
      }
    }

    for (const room of roomAssociations) {
      if (
        !room.guestReferences ||
        !Array.isArray(room.guestReferences) ||
        room.guestReferences.length === 0
      ) {
        return res.status(400).json({
          error:
            "Each roomAssociation must have a non-empty 'guestReferences' array",
        });
      }
      for (const ref of room.guestReferences) {
        if (typeof ref.guestReference === "undefined") {
          return res.status(400).json({
            error:
              "Each guestReference in roomAssociations must have a 'guestReference' field",
          });
        }
      }
    }

    // Ensure the 'type' field is set to "hotel-order"
    if (data.type !== "hotel-order") {
      data.type = "hotel-order";
    }

    // Build the booking payload exactly as required by Amadeus API
    const bookingPayload = { data };

    // Get Amadeus OAuth token
    const token = await getAmadeusToken();

    // Log payload for debugging (remove in production)
    console.log("Booking payload:", JSON.stringify(bookingPayload, null, 2));

    // Call Amadeus Hotel Booking API
    const response: any = await axios.post(
      `${baseURL}/v2/booking/hotel-orders`,
      bookingPayload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 30000,
      }
    );

    const amadeusResponse = response.data?.data;

    // Generate your own unique reference for internal tracking
    const referenceId = uuid();

    // Extract booking details for your DB storage
    const bookingDetails = {
      guests,
      roomAssociations,
      hotelOfferId: roomAssociations[0]?.hotelOfferId,
      checkInDate: amadeusResponse?.hotelBookings?.[0]?.hotelOffer?.checkInDate,
      checkOutDate:
        amadeusResponse?.hotelBookings?.[0]?.hotelOffer?.checkOutDate,
      hotelName: amadeusResponse?.hotelBookings?.[0]?.hotel?.name,
      address: amadeusResponse?.hotelBookings?.[0]?.hotel?.address,
      confirmationNumber:
        amadeusResponse?.hotelBookings?.[0]?.hotelProviderInformation?.[0]
          ?.confirmationNumber,
    };

    // Save booking record in your database
    const booking = await prisma.booking.create({
      data: {
        referenceId,
        type: "HOTEL",
        status: "CONFIRMED",
        apiProvider: "AMADEUS",
        apiReferenceId: amadeusResponse?.id,
        apiResponse: amadeusResponse,
        bookingDetails,
        totalAmount: amadeusResponse?.hotelBookings?.[0]?.hotelOffer?.price
          ?.total
          ? parseFloat(amadeusResponse.hotelBookings[0].hotelOffer.price.total)
          : undefined,
        currency:
          amadeusResponse?.hotelBookings?.[0]?.hotelOffer?.price?.currency ||
          "EUR",
      },
    });

    return res.status(200).json({
      message: "Hotel successfully booked",
      bookingId: amadeusResponse?.id,
      confirmationNumber: bookingDetails.confirmationNumber,
      data: amadeusResponse,
      bookingRecord: booking,
    });
  } catch (error: any) {
    console.error(
      "Error booking hotel:",
      error.response?.data || error.message
    );

    if (error.response) {
      return res.status(error.response.status).json({
        error: error.response.data || error.message,
      });
    }

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
