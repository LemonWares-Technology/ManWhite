import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import env from "dotenv";
env.config();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Cache within the request scope
const locationCache: Record<string, any> = {};
const iataCache: Record<string, string> = {};

export async function getCachedIataCode(
  locationName: string,
  token: string
): Promise<string | null> {
  // Robust check for IATA code (3 uppercase letters)
  if (locationName && typeof locationName === 'string') {
    const trimmed = locationName.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(trimmed)) {
      return trimmed;
    }
  }

  if (iataCache[locationName]) return iataCache[locationName];

  try {
    const response: any = await axios.get(
      "https://test.api.amadeus.com/v1/reference-data/locations",
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          keyword: locationName,
          subType: "CITY,AIRPORT",
          page: { limit: 1 },
        },
      }
    );

    const code = response.data.data?.[0]?.iataCode || null;
    if (code) iataCache[locationName] = code;
    return code;
  } catch (error: any) {
    console.error(
      `Failed to get IATA for ${locationName}:`,
      error.response?.data || error.message
    );
    return null;
  }
}

export async function getCachedLocationDetails(
  iataCode: string,
  token: string
): Promise<any> {
  if (locationCache[iataCode]) return locationCache[iataCode];

  try {
    // Small delay to prevent 429
    await sleep(300);

    const response: any = await axios.get(
      "https://test.api.amadeus.com/v1/reference-data/locations",
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          keyword: iataCode,
          subType: "AIRPORT",
        },
      }
    );

    const details = response.data.data?.[0];
    if (details) locationCache[iataCode] = details;
    return details;
  } catch (error: any) {
    console.error(
      `Failed to get location for ${iataCode}:`,
      error.response?.data || error.message
    );
    return null;
  }
}

// Flutterwave handler
export async function initiateHotelBookingTemplate(
  amount: number,
  currency: string,
  customerEmail: string
) {
  const paymentData = {
    tx_ref: `hotel_${uuidv4}`,
    amount,
    currency,
    redirect_url: `${process.env.FRONTEND_URL}/success`,
    payment_options: `card,bank`,
    customers: {
      email: customerEmail,
      name: `Hotel Guest`,
    },
    customizations: {
      title: `Hotel Booking Payment`,
      description: `Payment for hotel booking`,
    },
  };

  const response = await axios.post(
    `https://api.flutterwave.com/v3/payments`,
    paymentData,
    {
      headers: {
        Authorization: `Bearer ${process.env.FLUTTER_SECRET}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response?.data;
}

// Helper function to generate booking reference
export function generateBookingReference(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `HTL${timestamp}${random}`;
}

// Helper function to extract total amount from response
export function extractTotalAmount(amadeusResponse: any): number | null {
  try {
    return (
      amadeusResponse.data?.price?.total ||
      amadeusResponse.data?.totalPrice ||
      amadeusResponse.data?.booking?.totalPrice ||
      null
    );
  } catch (error) {
    console.warn("Could not extract total amount:", error);
    return null;
  }
}

// Helper function to extract currency from response
export function extractCurrency(amadeusResponse: any): string {
  try {
    return (
      amadeusResponse.data?.price?.currency ||
      amadeusResponse.data?.currency ||
      amadeusResponse.data?.booking?.currency ||
      "USD"
    );
  } catch (error) {
    console.warn("Could not extract currency:", error);
    return "USD";
  }
}

// Helper function to extract Amadeus reference ID
export function extractAmadeusReference(amadeusResponse: any): string | null {
  try {
    return (
      amadeusResponse.data?.id ||
      amadeusResponse.data?.bookingId ||
      amadeusResponse.data?.confirmationNumber ||
      null
    );
  } catch (error) {
    console.warn("Could not extract Amadeus reference:", error);
    return null;
  }
}

export function generateCarBookingReference(): string {
  const prefix = "CAR"; // Car prefix
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

// Helper functions to extract information from Amadeus response
export function extractCarTotalAmount(amadeusResponse: any): number | null {
  try {
    // Adjust based on actual Amadeus car booking response structure
    return (
      amadeusResponse.data?.quotation?.totalPrice?.amount ||
      amadeusResponse.data?.price?.total ||
      null
    );
  } catch (error) {
    console.warn("Could not extract total amount from car booking response");
    return null;
  }
}

export function extractCarCurrency(amadeusResponse: any): string {
  try {
    // Adjust based on actual Amadeus car booking response structure
    return (
      amadeusResponse.data?.quotation?.totalPrice?.currency ||
      amadeusResponse.data?.price?.currency ||
      "USD"
    );
  } catch (error) {
    console.warn("Could not extract currency from car booking response");
    return "USD";
  }
}

export function extractCarAmadeusReference(
  amadeusResponse: any
): string | null {
  try {
    // Adjust based on actual Amadeus car booking response structure
    return (
      amadeusResponse.data?.id ||
      amadeusResponse.data?.confirmationNumber ||
      amadeusResponse.data?.reference ||
      null
    );
  } catch (error) {
    console.warn(
      "Could not extract Amadeus reference from car booking response"
    );
    return null;
  }
}

// Additional helper function to clear cart separately if needed
