import { Request, Response } from "express";
import axios from "axios";
import getAmadeusToken from "../utils/getToken";
import { prisma } from "../lib/prisma";
import { Status } from "@prisma/client";
import {
  getConversionRate,
  mapTravelerToAmadeusFormat,
} from "../utils/amadeusHelper";
import { getCachedIataCode, getCachedLocationDetails } from "../utils/helper";
import { sendBookingConfirmationEmails as sendBookingConfirmationEmail } from "../utils/zeptomail";
import { getIataCodeDetails } from "../utils/iata";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { amadeusRateLimiter, SearchCache } from "../utils/rateLimiter";

const baseURL: string = "https://test.api.amadeus.com";

export async function searchFlights(req: Request, res: Response): Promise<any> {
  const {
    origin: queryOrigin,
    destination: queryDestination,
    originLocationCode,
    destinationLocationCode,
    adults,
    departureDate,
    keyword,
    currency = "NGN",
    getAirportDetails = false,
  } = req.query;

  // Map alternate parameter names
  const origin = (queryOrigin || originLocationCode) as string;
  const destination = (queryDestination || destinationLocationCode) as string;

  console.log("🔍 Flight Search Request:", {
    query: req.query,
    origin,
    destination,
    adults,
    departureDate,
    keyword,
    currency,
    getAirportDetails,
  });

  try {
    const token = await getAmadeusToken();

    // If keyword is provided, return location suggestions
    if (keyword && typeof keyword === "string" && keyword.trim().length > 0) {
      console.log("🏢 Location Search Mode - Keyword:", keyword);

      // Generate cache key for keyword search
      const cacheKey = SearchCache.generateKey({ keyword });

      // Check cache first
      const cachedResult = SearchCache.get(cacheKey);
      if (cachedResult) {
        console.log(
          "💾 Returning cached location results:",
          cachedResult.length,
          "items",
        );
        return sendSuccess(
          res,
          "Suggestions retrieved from cache",
          cachedResult,
        );
      }

      // Check rate limit before making API call
      if (!amadeusRateLimiter.canMakeRequest("location_search")) {
        const retryAfter = amadeusRateLimiter.getRetryAfter("location_search");
        return sendError(
          res,
          `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
          429,
          {
            retryAfter,
            cached: false,
          },
        );
      }

      try {
        console.log(
          "🌐 Making Amadeus location API call for keyword:",
          keyword,
        );

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
          },
        );

        console.log("📍 Amadeus location API response:", {
          dataCount: data?.data?.length || 0,
          firstItem: data?.data?.[0] || null,
        });

        const suggestions = data.data.map((item: any) => ({
          name: item.name,
          iataCode: item.iataCode,
          cityCode: item.cityCode,
          countryName: item.countryName,
          stateCode: item.stateCode,
          regionCode: item.regionCode,
          ...(getAirportDetails === "true" && {
            detailedName: item.detailedName,
            cityName: item.address?.cityName,
            countryCode: item.address?.countryCode,
            coordinates: {
              latitude: item.geoCode?.latitude,
              longitude: item.geoCode?.longitude,
            },
            timeZone: item.timeZoneOffset,
            type: item.subType,
            relevance: item.relevance,
          }),
        }));

        console.log("✅ Processed suggestions:", suggestions.length, "items");

        // Cache the successful result for 5 minutes
        SearchCache.set(cacheKey, suggestions, 300);

        return sendSuccess(
          res,
          "Suggestions retrieved successfully",
          suggestions,
        );
      } catch (suggestionError: any) {
        console.error(
          "Amadeus Location Search Error:",
          suggestionError.response?.data || suggestionError.message,
        );

        // If it's a rate limit error, return appropriate response
        if (suggestionError.response?.status === 429) {
          return sendError(
            res,
            "API rate limit exceeded. Please try again later.",
            429,
            {
              retryAfter: 60,
              cached: false,
            },
          );
        }

        return sendSuccess(
          res,
          "Failed to retrieve suggestions from provider",
          [],
        );
      }
    }

    // NEW: If only getting airport details for specific IATA codes
    if (getAirportDetails === "true" && (origin || destination)) {
      const airportDetails: any = {};

      if (origin) {
        try {
          airportDetails.origin = await getIataCodeDetails(origin);
        } catch (error) {
          console.error(`Failed to get details for origin ${origin}:`, error);
          airportDetails.origin = {
            error: `Could not find details for ${origin}`,
          };
        }
      }

      if (destination) {
        try {
          airportDetails.destination = await getIataCodeDetails(destination);
        } catch (error) {
          console.error(
            `Failed to get details for destination ${destination}:`,
            error,
          );
          airportDetails.destination = {
            error: `Could not find details for ${destination}`,
          };
        }
      }

      return sendSuccess(
        res,
        "Airport details retrieved successfully",
        airportDetails,
      );
    }

    // For flight search, validate required fields
    if (!origin || !destination || !adults || !departureDate) {
      console.log("❌ Missing required fields for flight search:", {
        origin: !!origin,
        destination: !!destination,
        adults: !!adults,
        departureDate: !!departureDate,
      });
      return sendError(res, "Missing required fields", 400);
    }

    console.log("✈️ Flight Search Mode - Processing flight search...");

    const adultsNum = Number(adults);
    console.log("👥 Adults count:", adultsNum);

    const originIata = await getCachedIataCode(origin, token);
    const destinationIata = await getCachedIataCode(destination, token);

    console.log("🏢 IATA Code Resolution:", {
      origin: `${origin} → ${originIata}`,
      destination: `${destination} → ${destinationIata}`,
    });

    if (!originIata || !destinationIata) {
      console.log("❌ Could not resolve IATA codes");
      return sendError(res, "Could not resolve IATA codes", 400);
    }

    let originInfo = null;
    let destinationInfo = null;

    if (getAirportDetails === "true") {
      try {
        const [ori, dest] = await Promise.allSettled([
          getIataCodeDetails(originIata),
          getIataCodeDetails(destinationIata),
        ]);
        originInfo = ori.status === "fulfilled" ? ori.value : null;
        destinationInfo = dest.status === "fulfilled" ? dest.value : null;
      } catch (e) {
        console.error("Error getting airport details:", e);
      }
    }

    const excludedAirlines = await prisma.excludedAirline.findMany();
    const excludedCodesArray = excludedAirlines
      .map((a: any) => a.airlineCode?.trim())
      .filter((code: string | undefined) => code && /^[A-Z0-9]+$/.test(code));

    console.log("🚫 Excluded airlines:", excludedCodesArray);

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

    console.log("🔍 Amadeus flight search params:", params);

    const flightResponse: any = await axios.get(
      `${baseURL}/v2/shopping/flight-offers`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params,
      },
    );

    console.log("✈️ Amadeus flight search response:", {
      status: flightResponse.status,
      dataCount: flightResponse.data?.data?.length || 0,
      meta: flightResponse.data?.meta || null,
      firstOffer: flightResponse.data?.data?.[0] || null,
    });

    const offers = flightResponse.data.data;
    const marginSetting = await prisma.marginSetting.findFirst();
    const percent = marginSetting?.amount || 0;

    console.log("💰 Margin setting:", {
      percent,
      marginSetting: !!marginSetting,
    });

    const adjustedOffers = offers.map((offer: any) => {
      const originalPrice = parseFloat(offer.price.total);
      const priceWithMargin = originalPrice * (1 + percent / 100);
      return {
        ...offer,
        price: {
          ...offer.price,
          total: parseFloat(priceWithMargin.toFixed(2)),
          grandTotal: parseFloat(priceWithMargin.toFixed(2)),
        },
      };
    });

    console.log("💵 Price adjustment:", {
      originalOffersCount: offers.length,
      adjustedOffersCount: adjustedOffers.length,
      sampleOriginalPrice: offers[0]?.price?.total,
      sampleAdjustedPrice: adjustedOffers[0]?.price?.total,
    });

    // Enrichment optimization: Collect all unique IATA codes first
    const uniqueIatas = new Set<string>();
    for (const offer of adjustedOffers) {
      for (const itinerary of offer.itineraries) {
        for (const segment of itinerary.segments) {
          uniqueIatas.add(segment.departure.iataCode);
          uniqueIatas.add(segment.arrival.iataCode);
        }
      }
    }

    console.log(
      "🏢 Unique IATA codes for enrichment:",
      Array.from(uniqueIatas),
    );

    // Fetch unique details with staggered delay to avoid 429
    const cityDetailsMap = new Map<string, any>();
    const iataArray = Array.from(uniqueIatas);

    console.log(
      "🔄 Starting location details enrichment for",
      iataArray.length,
      "airports",
    );

    // Process unique IATAs in sequence with a delay
    for (const iataCode of iataArray) {
      try {
        const details = await getCachedLocationDetails(iataCode, token);
        if (details) {
          cityDetailsMap.set(iataCode, details);
        }
      } catch (locationError: any) {
        console.error(
          `⚠️ Failed to get location details for ${iataCode}:`,
          locationError.message,
        );
        // Continue processing other locations even if one fails
      }
    }

    console.log(
      "✅ Location details enrichment completed:",
      cityDetailsMap.size,
      "details fetched",
    );

    // Assign details back to segments
    for (const offer of adjustedOffers) {
      for (const itinerary of offer.itineraries) {
        for (const segment of itinerary.segments) {
          segment.departure.details =
            cityDetailsMap.get(segment.departure.iataCode) || null;
          segment.arrival.details =
            cityDetailsMap.get(segment.arrival.iataCode) || null;
        }
      }
    }

    const responseData: any = {
      data: adjustedOffers,
      meta: {
        origin: originIata,
        destination: destinationIata,
        currency,
        adults: adultsNum,
        departureDate,
      },
    };

    if (getAirportDetails === "true") {
      responseData.airportDetails = {
        origin: originInfo,
        destination: destinationInfo,
      };
    }

    console.log("🎯 Final response data:", {
      offersCount: responseData.data?.length || 0,
      meta: responseData.meta,
      hasAirportDetails: !!responseData.airportDetails,
      sampleOffer: responseData.data?.[0]
        ? {
            id: responseData.data[0].id,
            price: responseData.data[0].price,
            itinerariesCount: responseData.data[0].itineraries?.length,
          }
        : null,
    });

    return sendSuccess(
      res,
      "Flight offers retrieved successfully",
      responseData,
    );
  } catch (error: any) {
    console.error("❌ Flight Search Error:", {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      stack: error.stack,
    });

    return sendError(
      res,
      "Failed to fetch flight offers",
      error.response?.status || 500,
      error.response?.data || error,
    );
  }
}

export async function searchFlightPrice(
  req: Request,
  res: Response,
): Promise<any> {
  try {
    const { flightOffer } = req.body;

    console.log("🔍 Flight pricing request received:", {
      hasFlightOffer: !!flightOffer,
      flightOfferType: typeof flightOffer,
      flightOfferKeys: flightOffer ? Object.keys(flightOffer) : [],
      flightOfferId: flightOffer?.id,
      flightOfferSource: flightOffer?.source,
      hasItineraries: !!flightOffer?.itineraries,
      itinerariesCount: flightOffer?.itineraries?.length || 0,
      hasPrice: !!flightOffer?.price,
      priceStructure: flightOffer?.price ? Object.keys(flightOffer.price) : [],
    });

    if (!flightOffer) {
      return sendError(res, "Missing flight offer in request body", 400);
    }

    // Validate required flight offer structure
    if (!flightOffer.id || !flightOffer.itineraries || !flightOffer.price) {
      console.error("❌ Invalid flight offer structure:", {
        hasId: !!flightOffer.id,
        hasItineraries: !!flightOffer.itineraries,
        hasPrice: !!flightOffer.price,
        receivedKeys: Object.keys(flightOffer),
      });
      return sendError(
        res,
        "Invalid flight offer structure. Missing required fields: id, itineraries, or price",
        400,
      );
    }

    // Skip expiration check - let Amadeus API handle expired offers
    // Flight offers expire very quickly (sometimes within hours) which creates poor UX
    // The Amadeus pricing API will return appropriate errors for truly expired offers
    console.log(
      "ℹ️ Skipping local expiration check - Amadeus API will validate offer freshness",
    );

    if (flightOffer.lastTicketingDate || flightOffer.lastTicketingDateTime) {
      console.log("📅 Flight offer ticketing info:", {
        offerId: flightOffer.id,
        lastTicketingDate: flightOffer.lastTicketingDate,
        lastTicketingDateTime: flightOffer.lastTicketingDateTime,
        note: "Expiration validation delegated to Amadeus API",
      });
    }

    const token = await getAmadeusToken();

    // Clean the flight offer for Amadeus API (remove any backend-added fields)
    const cleanFlightOffer = JSON.parse(JSON.stringify(flightOffer));

    // Remove backend-added fields that Amadeus doesn't expect
    if (cleanFlightOffer.price) {
      delete cleanFlightOffer.price.originalTotal;
      delete cleanFlightOffer.price.originalGrandTotal;
      delete cleanFlightOffer.price.marginAdded;
      delete cleanFlightOffer.price.billingCurrency;

      // Ensure price values are strings (Amadeus expects strings)
      if (typeof cleanFlightOffer.price.total === "number") {
        cleanFlightOffer.price.total = cleanFlightOffer.price.total.toString();
      }
      if (typeof cleanFlightOffer.price.grandTotal === "number") {
        cleanFlightOffer.price.grandTotal =
          cleanFlightOffer.price.grandTotal.toString();
      }
      if (typeof cleanFlightOffer.price.base === "number") {
        cleanFlightOffer.price.base = cleanFlightOffer.price.base.toString();
      }
    }

    // Remove any enrichment details that were added during search
    if (cleanFlightOffer.itineraries) {
      for (const itinerary of cleanFlightOffer.itineraries) {
        if (itinerary.segments) {
          for (const segment of itinerary.segments) {
            delete segment.departure?.details;
            delete segment.arrival?.details;
          }
        }
      }
    }

    console.log("🧹 Cleaned flight offer for Amadeus:", {
      originalPriceKeys: flightOffer.price
        ? Object.keys(flightOffer.price)
        : [],
      cleanedPriceKeys: cleanFlightOffer.price
        ? Object.keys(cleanFlightOffer.price)
        : [],
      priceTotal: cleanFlightOffer.price?.total,
      priceGrandTotal: cleanFlightOffer.price?.grandTotal,
    });

    const payload = {
      data: {
        type: "flight-offers-pricing",
        flightOffers: [cleanFlightOffer],
      },
    };

    console.log("🚀 Sending pricing request to Amadeus:", {
      payloadType: payload.data.type,
      flightOffersCount: payload.data.flightOffers.length,
      firstOfferId: payload.data.flightOffers[0]?.id,
    });

    const response: any = await axios.post(
      `${baseURL}/v1/shopping/flight-offers/pricing`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-HTTP-Method-Override": "GET",
        },
      },
    );

    console.log("✅ Amadeus pricing response received:", {
      status: response.status,
      hasData: !!response.data,
      hasFlightOffers: !!response.data?.data?.flightOffers,
      offersCount: response.data?.data?.flightOffers?.length || 0,
    });

    console.log("💾 Fetching margin setting from database...");
    const marginSetting: any = await prisma.marginSetting.findFirst({
      orderBy: { createdAt: "desc" },
    });

    let marginPercentage = 0; // Default to 0% margin if no setting found

    if (!marginSetting) {
      console.warn(
        "⚠️ No margin setting found in database, using default 0% margin",
      );
      marginPercentage = 0;
    } else {
      console.log("✅ Margin setting retrieved:", {
        id: marginSetting.id,
        amount: marginSetting.amount,
        createdAt: marginSetting.createdAt,
      });
      marginPercentage = marginSetting.amount;
    }

    console.log("🔢 Processing flight offers with margin calculation...");
    const modifiedFlightOffers = response.data.data.flightOffers.map(
      (offer: any, index: number) => {
        console.log(`📊 Processing offer ${index + 1}:`, {
          offerId: offer.id,
          originalTotal: offer.price.total,
          originalGrandTotal: offer.price.grandTotal,
          marginPercentage,
        });

        const originalTotal = parseFloat(offer.price.total);
        const originalGrandTotal = parseFloat(offer.price.grandTotal);

        if (isNaN(originalTotal) || isNaN(originalGrandTotal)) {
          console.error(`❌ Invalid price values in offer ${offer.id}:`, {
            total: offer.price.total,
            grandTotal: offer.price.grandTotal,
            totalParsed: originalTotal,
            grandTotalParsed: originalGrandTotal,
          });
          throw new Error(`Invalid price values in flight offer ${offer.id}`);
        }

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
      },
    );

    console.log("✅ Flight offers processing completed successfully:", {
      originalOffersCount: response.data.data.flightOffers.length,
      modifiedOffersCount: modifiedFlightOffers.length,
      sampleModifiedOffer: modifiedFlightOffers[0]
        ? {
            id: modifiedFlightOffers[0].id,
            originalPrice: modifiedFlightOffers[0].price.originalGrandTotal,
            newPrice: modifiedFlightOffers[0].price.grandTotal,
            marginAdded: modifiedFlightOffers[0].price.marginAdded,
          }
        : null,
    });

    // Skip location enrichment for pricing endpoint to avoid rate limiting issues
    // Location details are not essential for booking and can cause failures
    console.log(
      "ℹ️ Skipping location enrichment for pricing endpoint to ensure booking success",
    );

    console.log("🚀 Preparing final response...");
    const finalResponse = {
      ...response.data,
      data: {
        ...response.data.data,
        flightOffers: modifiedFlightOffers,
      },
    };

    console.log("✅ Final response prepared, sending success response");
    return sendSuccess(
      res,
      "Flight pricing retrieved successfully",
      finalResponse,
    );
  } catch (error: any) {
    console.error("❌ Flight pricing error occurred:", {
      message: error.message,
      stack: error.stack,
      status: error.response?.status,
      statusText: error.response?.statusText,
      amadeusError: error.response?.data,
      hasResponse: !!error.response,
      errorName: error.name,
      errorCode: error.code,
    });

    // Handle specific Amadeus API errors
    if (error.response?.status === 400) {
      const amadeusError = error.response.data;

      // Check if it's an expired offer error
      if (
        amadeusError?.errors?.some(
          (err: any) =>
            err.code === "4926" || // Offer expired
            err.title?.toLowerCase().includes("expired") ||
            err.detail?.toLowerCase().includes("expired") ||
            err.detail?.toLowerCase().includes("no longer available"),
        )
      ) {
        return sendError(
          res,
          "This flight offer has expired. Please search for new flights.",
          400,
          {
            code: "OFFER_EXPIRED",
            details:
              "Flight prices change frequently. Please perform a new search to see current availability and pricing.",
          },
        );
      }

      return sendError(res, "Invalid flight offer data", 400, {
        details: error.response.data,
        message:
          "The flight offer structure is invalid or contains outdated information",
      });
    }

    if (error.response?.status === 429) {
      return sendError(
        res,
        "Rate limit exceeded. Please try again later",
        429,
        {
          retryAfter: 60,
        },
      );
    }

    return sendError(
      res,
      `Failed to fetch flight pricing: ${error.message}`,
      500,
      {
        error:
          process.env.NODE_ENV === "development"
            ? {
                message: error.message,
                stack: error.stack,
                amadeusResponse: error.response?.data,
              }
            : undefined,
      },
    );
  }
}

export const saveSelectedFlightOffer = async (
  req: Request,
  res: Response,
): Promise<Response | any> => {
  try {
    const { offerData } = req.body;

    if (!offerData) {
      return sendError(res, "Missing offer data", 400);
    }

    const savedOffer = await prisma.flightOffer.create({
      data: {
        offerData,
      },
    });

    return sendSuccess(
      res,
      "Flight offer saved successfully",
      { flightOfferId: savedOffer.id },
      201,
    );
  } catch (error: any) {
    console.error("Error saving flight offer:", error);
    return sendError(res, "Server error", 500, error);
  }
};

export const getFlightOffers = async (
  req: Request,
  res: Response,
): Promise<Response | any> => {
  try {
    const flightOffers = await prisma.flightOffer.findMany({
      orderBy: { createdAt: "desc" },
    });

    return sendSuccess(
      res,
      "Flight offers retrieved successfully",
      flightOffers,
    );
  } catch (error: any) {
    console.error("Error fetching flight offers:", error);
    return sendError(res, "Server error", 500, error);
  }
};

export const getFlightOfferById = async (
  req: Request,
  res: Response,
): Promise<Response | any> => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, "Flight offer ID is required", 400);
    }

    const flightOffer = await prisma.flightOffer.findUnique({
      where: { id },
      include: {
        travelers: true,
        addons: true,
      },
    });

    if (!flightOffer) {
      return sendError(res, "Flight offer not found", 404);
    }

    return sendSuccess(res, "Flight offer retrieved successfully", flightOffer);
  } catch (error: any) {
    console.error("Error fetching flight offer:", error);
    return sendError(res, "Server error", 500, error);
  }
};

export async function retrieveFlightDetails(
  req: Request,
  res: Response,
): Promise<any> {
  try {
    const rawReferenceId = req.params.referenceId;
    if (!rawReferenceId) {
      return sendError(res, "Reference parameter is required", 400);
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
      },
    );

    return sendSuccess(
      res,
      "Flight details retrieved successfully",
      response.data,
    );
  } catch (error: any) {
    console.error(
      "Error retrieving flight details:",
      error.response?.data || error.message,
    );
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function deleteFlightBooking(
  req: Request,
  res: Response,
): Promise<any> {
  try {
    const rawReferenceId = req.params.referenceId; // Kept this line as it was already there

    if (!rawReferenceId) {
      return sendError(res, "Reference ID is required", 400);
    }

    const decodedReferenceId = decodeURIComponent(rawReferenceId);

    const encodedReferenceId = encodeURIComponent(decodedReferenceId);

    const booking = await prisma.booking.findUnique({
      where: { referenceId: encodedReferenceId },
    });

    if (!booking) {
      return sendError(res, "Booking not found in local database", 404);
    }

    const token = await getAmadeusToken();

    await axios.delete(
      `${baseURL}/v1/booking/flight-orders/${encodedReferenceId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    await prisma.booking.delete({
      where: { referenceId: encodedReferenceId },
    });

    return sendSuccess(res, "Booking successfully cancelled and deleted");
  } catch (error: any) {
    console.error(
      "Error deleting booking:",
      error.response?.data || error.message,
    );

    if (error.response?.status === 404) {
      return sendError(
        res,
        "Booking not found in Amadeus or already deleted",
        404,
      );
    }

    return sendError(res, "Internal server error", 500, error);
  }
}

export async function getSeatMapsByFlightId(
  req: Request,
  res: Response,
): Promise<any> {
  try {
    const { referenceId } = req.params; // Kept this line as it was already there

    if (!referenceId) {
      return sendError(res, "Flight order ID is required", 400);
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

    return sendSuccess(res, "Seat maps fetched successfully", response.data);
  } catch (error: any) {
    console.error(
      "Error occurred while fetching seat maps:",
      error.response?.data || error.message,
    );

    return sendError(res, "Internal server error", 500, error);
  }
}

export async function getOneFlightDetails(
  req: Request,
  res: Response,
): Promise<any> {
  try {
    const { flightId } = req.params;

    if (!flightId) {
      return sendError(res, "Reference parameter is required", 400);
    }

    const response = await prisma.booking.findUnique({
      where: { id: flightId },
    });

    if (!response) {
      return sendError(res, "This Flight cannot be found", 404);
    }

    return sendSuccess(res, "Flight details retrieved successfully", response);
  } catch (error: any) {
    console.error(
      "Error retrieving flight details:",
      error.response?.data || error.message,
    );
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function updateFlightStatus(
  req: Request,
  res: Response,
): Promise<any> {
  try {
    const { flightId } = req.params;
    const { status } = req.body;

    if (!flightId) {
      return sendError(res, "Reference parameter is required", 400);
    }

    const flightInfo = await prisma.booking.update({
      where: { id: flightId },
      data: {
        status: status,
      },
    });

    return sendSuccess(res, "Flight status updated successfully", flightInfo);
  } catch (error: any) {
    console.error(
      "Error retrieving flight details:",
      error.response?.data || error.message,
    );
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function bookFlightAsGuest(
  req: Request,
  res: Response,
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
      return sendError(
        res,
        "Missing required fields: flightOffer or travelers",
        400,
      );
    }

    // Validate guestUserId
    if (!guestUserId) {
      return sendError(res, "guestUserId is required for guest booking.", 400);
    }
    const guestExists = await prisma.guestUser.findUnique({
      where: { id: guestUserId },
    });
    if (!guestExists) {
      return sendError(res, "Invalid guestUserId: guest user not found", 400);
    }

    // Transform travelers to Amadeus format if needed
    const amadeusTravelers = travelers.map((t: any, idx: number) =>
      t.name && t.contact && t.documents
        ? { ...t, id: (idx + 1).toString() }
        : mapTravelerToAmadeusFormat(t, (idx + 1).toString()),
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
      },
    );
    const amadeusBooking: any = response.data;

    // Margin settings
    const marginSetting: any = await prisma.marginSetting.findFirst({
      orderBy: { createdAt: "desc" },
    });

    let marginPercentage = 0; // Default to 0% margin if no setting found

    if (!marginSetting) {
      console.warn(
        "⚠️ No margin setting found in database, using default 0% margin",
      );
      marginPercentage = 0;
    } else {
      marginPercentage = marginSetting.amount;
    }

    // Extract base price from Amadeus response
    const flightOffersFromResp = amadeusBooking?.data?.flightOffers || [];
    if (flightOffersFromResp.length === 0) {
      return sendError(res, "No flight offers found in Amadeus response", 500);
    }
    const basePriceNGN = parseFloat(
      flightOffersFromResp[0].price?.grandTotal || "0",
    );

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
        return sendError(res, "One or more addonIds are invalid", 400);
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

    return sendSuccess(
      res,
      "Flight successfully booked with addons",
      {
        booking: bookingWithAddons,
        amadeus: amadeusBooking,
        originalTotalAmount: +originalTotalAmount.toFixed(2),
        addonTotal: +addonTotalNGN.toFixed(2),
        totalAmount: +totalAmountNGN.toFixed(2),
      },
      201,
    );
  } catch (error: any) {
    console.error("Booking Error:", error.response?.data || error.message);
    return sendError(res, "Flight booking failed", 500, error);
  }
}

// PATCH /booking/:referenceId/status
export async function updateBookingStatus(
  req: Request,
  res: Response,
): Promise<Response | any> {
  const { referenceId } = req.params;
  const { status, verified } = req.body;

  if (!referenceId) {
    return sendError(res, "referenceId is required", 400);
  }
  if (!status && typeof verified === "undefined") {
    return sendError(
      res,
      "At least one of status or verified must be provided",
      400,
    );
  }

  try {
    const booking = await prisma.booking.findUnique({ where: { referenceId } });
    if (!booking) {
      return sendError(res, "Booking not found", 404);
    }

    const updatedBooking = await prisma.booking.update({
      where: { referenceId },
      data: {
        ...(status && { status }),
        ...(typeof verified === "boolean" && { verified }),
      },
    });

    return sendSuccess(
      res,
      "Booking status updated successfully",
      updatedBooking,
    );
  } catch (error: any) {
    console.error("Error updating booking status:", error.message);
    return sendError(res, "Failed to update booking status", 500, error);
  }
}

// New endpoint to get airport name/details by IATA code
export async function getAirportDetails(
  req: Request,
  res: Response,
): Promise<any> {
  try {
    const { iataCode } = req.query;

    if (!iataCode || typeof iataCode !== "string") {
      return sendError(res, "Missing or invalid IATA code", 400);
    }

    const token = await getAmadeusToken();

    const airportDetails = await getCachedLocationDetails(iataCode, token);

    if (!airportDetails) {
      return sendError(res, "Airport not found", 404);
    }

    return sendSuccess(res, "Airport details fetched successfully", {
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
      error.response?.data || error.message,
    );
    return sendError(res, "Failed to fetch airport details", 500, error);
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
    },
  );

  if (response.data && response.data.data && response.data.data.length > 0) {
    return response.data.data[0]; // airline details object
  }
  return null;
}

// Express route handler to get airline details
export async function getAirlineDetailsEndpoint(
  req: Request,
  res: Response,
): Promise<any> {
  try {
    const { iataCode } = req.query;

    if (!iataCode || typeof iataCode !== "string") {
      return sendError(res, "Missing or invalid IATA code", 400);
    }

    const token = await getAmadeusToken();

    const airlineDetails = await getAirlineDetails(iataCode, token);

    if (!airlineDetails) {
      return sendError(res, "Airline not found", 404);
    }

    return sendSuccess(res, "Airline details fetched successfully", {
      iataCode,
      type: airlineDetails?.type,
      icaoCode: airlineDetails?.icaoCode,
      businessName: airlineDetails?.businessName,
      commonName: airlineDetails?.businessName,
    });
  } catch (error: any) {
    console.error(
      "Airline details error:",
      error.response?.data || error.message,
    );
    return sendError(res, "Failed to fetch airline details", 500, error);
  }
}

// Search flights departing from the airport to any destination (limited results)
async function searchFlightsFromAirport(
  originIata: string,
  destinationIata: string,
  departureDate: string,
  adults: number,
  token: string,
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
    },
  );
  return response.data.data || [];
}

// Fetch airline details by multiple airline codes (comma separated)
async function getAirlinesDetails(
  airlineCodes: string[],
  token: string,
): Promise<any[]> {
  if (airlineCodes.length === 0) return [];

  const codesParam = airlineCodes.join(",");

  const response: any = await axios.get(
    `${baseURL}/v1/reference-data/airlines?airlineCodes=${codesParam}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return response.data.data || [];
}

// Express route handler to get airlines operating at an airport via flight offers
export async function getAirlinesByAirport(
  req: Request,
  res: Response,
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
      return sendError(
        res,
        "Missing or invalid parameters: iataCode, destinationCode, departureDate, adults are required",
        400,
      );
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
      token,
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
          airlineCodesSet.add(code),
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
      return sendSuccess(res, "No airlines found for the given airport", {
        airport: iataCodeUpper,
        airlines: [],
      });
    }

    // Step 3: Fetch airline details for these airline codes
    const airlinesDetails = await getAirlinesDetails(airlineCodes, token);
    console.log(`airlinesDetails`, airlinesDetails);

    // Step 4: Return airline details
    return sendSuccess(res, "Airline details fetched successfully", {
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
      error.response?.data || error.message,
    );
    return sendError(
      res,
      "Failed to fetch airlines for the airport",
      500,
      error,
    );
  }
}

export async function getAirlinesByMultipleLocations(
  req: Request,
  res: Response,
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
          err.response?.data || err.message,
        );
        // Continue for other airports even if one fails
      }
    }

    const airlineCodes = Array.from(airlineCodesSet);
    if (airlineCodes.length === 0) {
      return sendSuccess(res, "No airlines found for the provided airports", {
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
      },
    );

    const airlines = airlinesResponse.data.data || [];

    return sendSuccess(res, "Airline details retrieved successfully", {
      airports,
      airlines,
    });
  } catch (error: any) {
    console.error(
      "Error fetching airlines by multiple locations:",
      error.response?.data || error.message,
    );
    return sendError(
      res,
      "Failed to fetch airlines for the provided locations",
      500,
      error,
    );
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
  token: string,
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
      },
    );

    const location = response.data.data?.[0];
    return location?.address?.cityName || iataCode;
  } catch (error: any) {
    console.error(
      `Failed to fetch city for IATA code ${iataCode}:`,
      error.message,
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
      }),
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
  res: Response,
): Promise<Response | any> {
  try {
    const cacheKey = JSON.stringify(req.query);
    const cachedResponse = flightOfferCache.get(cacheKey);

    if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL) {
      return sendSuccess(
        res,
        "Flight offers retrieved successfully (from cache)",
        cachedResponse.data,
      );
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
      },
    );

    const offers = response.data.data || [];
    const uniqueOffers = removeDuplicateOffers(offers);
    const enrichedOffers = await enrichFlightOffersWithLocations(
      uniqueOffers,
      token,
    );

    flightOfferCache.set(cacheKey, {
      data: enrichedOffers,
      timestamp: Date.now(),
    });

    return sendSuccess(
      res,
      "Flight offers retrieved successfully",
      enrichedOffers,
    );
  } catch (error: any) {
    console.error(
      "Amadeus flight offers error:",
      error.response?.data || error.message,
    );

    const cacheKey = JSON.stringify(req.query);
    const cachedResponse = flightOfferCache.get(cacheKey);
    if (cachedResponse) {
      return sendSuccess(
        res,
        "Flight offers retrieved successfully (from cache)",
        cachedResponse.data,
      );
    }

    return sendError(res, "Failed to fetch flight offers", 500, error);
  }
}

// const flightPricingCache = new Map<string, any>();

export async function getFlightOfferDetails(
  req: Request,
  res: Response,
): Promise<Response | any> {
  try {
    const { flightOffer } = req.body;

    // Basic validation
    if (!flightOffer || typeof flightOffer !== "object") {
      return sendError(res, "Flight offer object is required", 400);
    }

    // Verify required fields
    if (!flightOffer.id || !flightOffer.itineraries || !flightOffer.price) {
      return sendError(res, "Invalid flight offer structure", 400, {
        requiredFields: ["id", "itineraries", "price"],
      });
    }

    // Get Amadeus token
    const token = await getAmadeusToken();
    if (!token) {
      return sendError(res, "Failed to authenticate with Amadeus", 500);
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
      },
    );

    // Return the priced flight offer
    return sendSuccess(
      res,
      "Flight offer details retrieved successfully",
      response.data.data,
    );
  } catch (error: any) {
    console.error("Flight offer details error:", error.message);

    // Handle Amadeus API errors
    if (error.response?.data?.errors) {
      const errors = error.response.data.errors
        .map((err: any) => `${err.code}: ${err.detail}`)
        .join("; ");
      return sendError(res, "Amadeus API error", 400, { details: errors });
    }

    // Handle other errors
    return sendError(res, "Failed to get flight details", 500, error);
  }
}

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

//     if (!userId) {
//       return res
//         .status(400)
//         .json({ error: "userId is required for this booking endpoint." });
//     }
//     const userExists = await prisma.user.findUnique({ where: { id: userId } });
//     if (!userExists) {
//       return res.status(400).json({ error: "Invalid userId: user not found" });
//     }

//     const amadeusTravelers = travelers.map((t: any, idx: number) =>
//       t.name && t.contact && t.documents
//         ? { ...t, id: (idx + 1).toString() }
//         : mapTravelerToAmadeusFormat(t, (idx + 1).toString())
//     );

//     if (!amadeusTravelers[0]?.name?.firstName) {
//       return res.status(400).json({
//         error: "Missing firstName in traveler data",
//       });
//     }

//     const token = await getAmadeusToken();

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
//     if (flightOffers.length === 0) {
//       return res
//         .status(500)
//         .json({ error: "No flight offers found in Amadeus response" });
//     }
//     const basePriceNGN = parseFloat(flightOffers[0].price?.grandTotal || "0");

//     const marginAdded = (marginPercentage / 100) * basePriceNGN;
//     const originalTotalAmount = basePriceNGN + marginAdded;

//     const conversionRate = await getConversionRate("USD", "NGN");

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

//     const totalAmountNGN = originalTotalAmount + addonTotalNGN;

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

//     if (addonIds.length > 0) {
//       await prisma.flightAddon.updateMany({
//         where: { id: { in: addonIds } },
//         data: { bookingId: booking.id },
//       });
//     }

//     for (const t of travelers) {
//       await prisma.traveler.create({
//         data: {
//           bookingId: booking.id,
//           userId,
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

//       // Send booking confirmation email to each traveler
//       if (t.contact.emailAddress) {
//         await sendBookingConfirmationEmail({
//           toEmail: t.contact.emailAddress,
//           toName: `${t.name.firstName || t.firstName} ${
//             t.name.lastName || t.lastName
//           }`,
//           bookingId: booking.id,
//           flightOffer,
//         });
//       }
//     }

//     const bookingWithAddons = await prisma.booking.findUnique({
//       where: { id: booking.id },
//       include: { FlightAddon: true },
//     });

//     return res.status(201).json({
//       success: true,
//       message:
//         "Flight successfully booked with addons and confirmation emails sent",
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
  res: Response,
): Promise<any> {
  const { flightOffer, travelers, addonIds = [], userId } = req.body;

  console.log("=== BOOKING FUNCTION STARTED ===");
  console.log("Request body keys:", Object.keys(req.body));
  console.log("Full request body:", JSON.stringify(req.body, null, 2));

  try {
    console.log("Received booking request with:", {
      flightOfferExists: !!flightOffer,
      travelersCount: travelers?.length || 0,
      addonIds,
      userId,
      travelers,
      flightOffer,
    });

    // Validation checks with detailed logging
    console.log("=== VALIDATION PHASE ===");

    if (!flightOffer || !travelers) {
      console.error("Validation failed: Missing flightOffer or travelers");
      console.error("flightOffer exists:", !!flightOffer);
      console.error("travelers exists:", !!travelers);
      return sendError(
        res,
        "Missing required fields: flightOffer or travelers",
        400,
      );
    }
    console.log("✓ flightOffer and travelers validation passed");

    if (!userId) {
      console.error("Validation failed: userId is missing");
      return sendError(
        res,
        "userId is required for this booking endpoint.",
        400,
      );
    }
    console.log("✓ userId validation passed:", userId);

    // Database user check
    console.log("=== USER VERIFICATION ===");
    console.log("Checking if user exists with ID:", userId);

    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    console.log(
      "User query result:",
      userExists ? "User found" : "User not found",
    );

    if (!userExists) {
      console.error("User verification failed: User not found for ID:", userId);
      return sendError(res, "Invalid userId: user not found", 400);
    }
    console.log("✓ User verification passed");

    // Traveler mapping
    console.log("=== TRAVELER MAPPING ===");
    console.log("Original travelers data:", JSON.stringify(travelers, null, 2));

    const amadeusTravelers = travelers.map((t: any, idx: number) => {
      console.log(`Mapping traveler ${idx + 1}:`, JSON.stringify(t, null, 2));

      const mapped =
        t.name && t.contact && t.documents
          ? { ...t, id: (idx + 1).toString() }
          : mapTravelerToAmadeusFormat(t, (idx + 1).toString());

      console.log(
        `Mapped traveler ${idx + 1}:`,
        JSON.stringify(mapped, null, 2),
      );
      return mapped;
    });

    console.log(
      "All amadeusTravelers:",
      JSON.stringify(amadeusTravelers, null, 2),
    );

    // First traveler validation
    console.log("=== FIRST TRAVELER VALIDATION ===");
    console.log("First traveler name object:", amadeusTravelers[0]?.name);
    console.log(
      "First traveler firstName:",
      amadeusTravelers[0]?.name?.firstName,
    );

    if (!amadeusTravelers[0]?.name?.firstName) {
      console.error("First traveler validation failed: Missing firstName");
      console.error(
        "First traveler data:",
        JSON.stringify(amadeusTravelers[0], null, 2),
      );
      return sendError(res, "Missing firstName in traveler data", 400);
    }
    console.log("✓ First traveler validation passed");

    // Amadeus token acquisition
    console.log("=== AMADEUS TOKEN ACQUISITION ===");
    console.log("Requesting Amadeus token...");

    const token = await getAmadeusToken();
    console.log("Amadeus token acquired:", token ? "Success" : "Failed");
    console.log("Token length:", token?.length || 0);

    // Clean flight offer - remove enriched fields added by backend
    console.log("=== CLEANING FLIGHT OFFER ===");
    const cleanFlightOffer = JSON.parse(JSON.stringify(flightOffer));

    // Remove backend-added fields from price
    if (cleanFlightOffer.price) {
      delete cleanFlightOffer.price.originalTotal;
      delete cleanFlightOffer.price.originalGrandTotal;
      delete cleanFlightOffer.price.marginAdded;
      delete cleanFlightOffer.price.billingCurrency;

      // Convert string prices to numbers if needed
      if (typeof cleanFlightOffer.price.total === "string") {
        cleanFlightOffer.price.total = parseFloat(cleanFlightOffer.price.total);
      }
      if (typeof cleanFlightOffer.price.grandTotal === "string") {
        cleanFlightOffer.price.grandTotal = parseFloat(
          cleanFlightOffer.price.grandTotal,
        );
      }
      if (typeof cleanFlightOffer.price.base === "string") {
        cleanFlightOffer.price.base = parseFloat(cleanFlightOffer.price.base);
      }
    }

    // Remove details from segments
    if (cleanFlightOffer.itineraries) {
      for (const itinerary of cleanFlightOffer.itineraries) {
        if (itinerary.segments) {
          for (const segment of itinerary.segments) {
            if (segment.departure?.details) {
              delete segment.departure.details;
            }
            if (segment.arrival?.details) {
              delete segment.arrival.details;
            }
          }
        }
      }
    }

    console.log(
      "Cleaned flight offer:",
      JSON.stringify(cleanFlightOffer, null, 2),
    );

    // Payload construction
    console.log("=== PAYLOAD CONSTRUCTION ===");
    const payload = {
      data: {
        type: "flight-order",
        flightOffers: [cleanFlightOffer], // Use cleaned offer
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

    console.log("Final Amadeus API payload:", JSON.stringify(payload, null, 2));
    console.log("Payload size (bytes):", JSON.stringify(payload).length);

    // Amadeus API call
    console.log("=== AMADEUS API CALL ===");
    console.log("Making request to:", `${baseURL}/v1/booking/flight-orders`);
    console.log("Request headers:", {
      Authorization: `Bearer ${token.substring(0, 10)}...`,
      "Content-Type": "application/json",
    });

    const response: any = await axios.post(
      `${baseURL}/v1/booking/flight-orders`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("Amadeus API response status:", response.status);
    console.log("Amadeus API response headers:", response.headers);
    console.log(
      "Amadeus API response data:",
      JSON.stringify(response.data, null, 2),
    );

    const amadeusBooking: any = response.data;
    console.log("✓ Amadeus booking created successfully");

    // Margin setting retrieval
    console.log("=== MARGIN SETTING RETRIEVAL ===");
    console.log("Fetching latest margin setting...");

    const marginSetting: any = await prisma.marginSetting.findFirst({
      orderBy: { createdAt: "desc" },
    });

    console.log(
      "Margin setting query result:",
      marginSetting ? "Found" : "Not found",
    );
    console.log("Margin setting data:", JSON.stringify(marginSetting, null, 2));

    let marginPercentage = 0; // Default to 0% margin if no setting found

    if (!marginSetting) {
      console.warn(
        "⚠️ No margin setting found in database, using default 0% margin",
      );
      marginPercentage = 0;
    } else {
      marginPercentage = marginSetting.amount;
      console.log("✓ Margin percentage from database:", marginPercentage);
    }

    console.log("Final margin percentage to use:", marginPercentage);

    // Flight offers processing
    console.log("=== FLIGHT OFFERS PROCESSING ===");
    const flightOffers = amadeusBooking?.data?.flightOffers || [];
    console.log("Flight offers count:", flightOffers.length);
    console.log("Flight offers data:", JSON.stringify(flightOffers, null, 2));

    if (flightOffers.length === 0) {
      console.error("No flight offers found in Amadeus response");
      console.error(
        "Amadeus booking data structure:",
        Object.keys(amadeusBooking?.data || {}),
      );
      return sendError(res, "No flight offers found in Amadeus response", 500);
    }

    const basePriceNGN = parseFloat(flightOffers[0].price?.grandTotal || "0");
    console.log("Base price (NGN):", basePriceNGN);
    console.log("Flight offer price object:", flightOffers[0].price);

    // Price calculations
    console.log("=== PRICE CALCULATIONS ===");
    const marginAdded = (marginPercentage / 100) * basePriceNGN;
    const originalTotalAmount = basePriceNGN + marginAdded;

    console.log("Margin added:", marginAdded);
    console.log("Original total amount:", originalTotalAmount);

    // Currency conversion
    console.log("=== CURRENCY CONVERSION ===");
    console.log("Getting USD to NGN conversion rate...");

    const conversionRate = await getConversionRate("USD", "NGN");
    console.log("Conversion rate (USD to NGN):", conversionRate);

    // Addon processing
    console.log("=== ADDON PROCESSING ===");
    console.log("Addon IDs to process:", addonIds);
    console.log("Addon IDs count:", addonIds.length);

    let addons: any[] = [];
    let addonTotalNGN = 0;

    if (addonIds.length > 0) {
      console.log("Fetching addons from database...");

      addons = await prisma.flightAddon.findMany({
        where: { id: { in: addonIds } },
      });

      console.log("Addons found in database:", addons.length);
      console.log("Addons data:", JSON.stringify(addons, null, 2));

      if (addons.length !== addonIds.length) {
        console.error("Addon validation failed:");
        console.error("Requested addon IDs:", addonIds);
        console.error(
          "Found addon IDs:",
          addons.map((a) => a.id),
        );
        return sendError(res, "One or more addonIds are invalid", 400);
      }

      console.log("Processing addon prices...");
      addonTotalNGN = addons.reduce((sum, addon) => {
        const priceInUsd = addon.price;
        const priceInNgn = priceInUsd * conversionRate;
        console.log(`Addon ${addon.id}: $${priceInUsd} = ₦${priceInNgn}`);
        return sum + priceInNgn;
      }, 0);

      console.log("Total addon amount (NGN):", addonTotalNGN);
    } else {
      console.log("No addons to process");
    }

    // Final total calculation
    console.log("=== FINAL TOTAL CALCULATION ===");
    const totalAmountNGN = originalTotalAmount + addonTotalNGN;
    console.log("Final breakdown:");
    console.log("- Base price + margin:", originalTotalAmount);
    console.log("- Addon total:", addonTotalNGN);
    console.log("- Grand total:", totalAmountNGN);

    // Database booking creation
    console.log("=== DATABASE BOOKING CREATION ===");
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

    console.log(
      "Booking data to insert:",
      JSON.stringify(bookingData, null, 2),
    );
    console.log("Creating booking in database...");

    const booking = await prisma.booking.create({ data: bookingData });
    console.log("✓ Booking created with ID:", booking.id);
    console.log("Created booking data:", JSON.stringify(booking, null, 2));

    // Addon association
    console.log("=== ADDON ASSOCIATION ===");
    if (addonIds.length > 0) {
      console.log("Associating addons with booking...");

      const addonUpdateResult = await prisma.flightAddon.updateMany({
        where: { id: { in: addonIds } },
        data: { bookingId: booking.id },
      });

      console.log("Addon update result:", addonUpdateResult);
      console.log("✓ Addons associated with booking");
    } else {
      console.log("No addons to associate");
    }

    // Traveler creation
    console.log("=== TRAVELER CREATION ===");
    for (let i = 0; i < travelers.length; i++) {
      const t = travelers[i];
      console.log(
        `Processing traveler ${i + 1}/${travelers.length}:`,
        JSON.stringify(t, null, 2),
      );

      const travelerData = {
        bookingId: booking.id,
        userId,
        firstName: t.name?.firstName || t.firstName,
        lastName: t.name?.lastName || t.lastName,
        dateOfBirth: new Date(t.dateOfBirth),
        gender: t.gender,
        email: t.contact?.emailAddress,
        phone: t.contact?.phones?.[0]?.number,
        countryCode: t.contact?.phones?.[0]?.countryCallingCode,
        passportNumber: t.documents?.[0]?.number,
        passportExpiry: t.documents?.[0]?.expiryDate
          ? new Date(t.documents[0].expiryDate)
          : undefined,
        nationality: t.documents?.[0]?.nationality,
      };

      console.log(
        `Traveler ${i + 1} data to insert:`,
        JSON.stringify(travelerData, null, 2),
      );

      const createdTraveler = await prisma.traveler.create({
        data: travelerData,
      });

      console.log(`✓ Traveler ${i + 1} created with ID:`, createdTraveler.id);

      // Email sending
      console.log(`=== EMAIL SENDING FOR TRAVELER ${i + 1} ===`);
      if (t.contact?.emailAddress) {
        const emailData = {
          toEmail: t.contact.emailAddress,
          toName: `${t.name?.firstName || t.firstName} ${
            t.name?.lastName || t.lastName
          }`,
          bookingId: booking.id,
          flightOffer,
        };

        console.log(`Sending confirmation email to:`, emailData.toEmail);
        console.log(`Email data:`, JSON.stringify(emailData, null, 2));

        try {
          await sendBookingConfirmationEmail(emailData);
          console.log(`✓ Confirmation email sent to traveler ${i + 1}`);
        } catch (emailError) {
          console.error(
            `Email sending failed for traveler ${i + 1}:`,
            emailError,
          );
          // Don't fail the entire booking for email issues
        }
      } else {
        console.warn(`No email address for traveler ${i + 1}, skipping email`);
      }
    }

    // Final booking retrieval
    console.log("=== FINAL BOOKING RETRIEVAL ===");
    console.log("Fetching complete booking with addons...");

    const bookingWithAddons = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { FlightAddon: true },
    });

    console.log(
      "Final booking with addons:",
      JSON.stringify(bookingWithAddons, null, 2),
    );

    // Clear cart after successful booking
    if (userId) {
      await prisma.flightCart.deleteMany({ where: { userId } });
    }

    console.log("=== SUCCESS RESPONSE ===");
    const finalData = {
      booking: bookingWithAddons,
      amadeus: amadeusBooking,
      originalTotalAmount: +originalTotalAmount.toFixed(2),
      addonTotal: +addonTotalNGN.toFixed(2),
      totalAmount: +totalAmountNGN.toFixed(2),
      referenceId: booking.id,
    };

    console.log("Success response data:", JSON.stringify(finalData, null, 2));
    console.log("=== BOOKING FUNCTION COMPLETED SUCCESSFULLY ===");

    return sendSuccess(
      res,
      "Flight successfully booked with addons and confirmation emails sent",
      finalData,
      201,
    );
  } catch (error: any) {
    console.error("=== BOOKING ERROR OCCURRED ===");
    console.error("Error type:", typeof error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    if (error.response) {
      console.error("HTTP Error Response:");
      console.error("- Status:", error.response.status);
      console.error("- Status Text:", error.response.statusText);
      console.error("- Headers:", error.response.headers);
      console.error("- Data:", JSON.stringify(error.response.data, null, 2));
    }

    if (error.request) {
      console.error("HTTP Request Error:");
      console.error("- Request config:", error.config);
      console.error("- Request data:", error.request);
    }

    console.error("=== END ERROR DETAILS ===");

    return sendError(res, "Flight booking failed", 500, error);
  }
}
