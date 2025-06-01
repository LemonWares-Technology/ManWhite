import axios from "axios";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Cache within the request scope
const locationCache: Record<string, any> = {};
const iataCache: Record<string, string> = {};

export async function getCachedIataCode(
  locationName: string,
  token: string
): Promise<string | null> {
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
    await sleep(250);

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
