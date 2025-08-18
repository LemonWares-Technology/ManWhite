import getAmadeusToken from "./getToken";

// Fix: Use base URL without the full path
const baseURL: string = "https://test.api.amadeus.com";

export const getIataCodeDetails = async (iataCode: string) => {
  try {
    // Build the complete URL
    const searchUrl = `${baseURL}/v1/reference-data/locations?keyword=${iataCode}&subType=AIRPORT&page[limit]=1`;

    const token = await getAmadeusToken();

    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`IATA lookup data for ${iataCode}:`, data);

    if (data.data && data.data.length > 0) {
      const airport = data.data[0];
      return {
        iataCode: airport.iataCode,
        name: airport.name,
        detailedName: airport.detailedName,
        cityName: airport.address?.cityName,
        cityCode: airport.address?.cityCode,
        countryName: airport.address?.countryName,
        countryCode: airport.address?.countryCode,
        stateCode: airport.address?.stateCode,
        timeZone: airport.timeZoneOffset,
        coordinates: {
          latitude: airport.geoCode?.latitude,
          longitude: airport.geoCode?.longitude,
        },
        type: airport.subType,
        relevance: airport.relevance,
      };
    } else {
      throw new Error(`No airport found for IATA code: ${iataCode}`);
    }
  } catch (error) {
    console.error(`Error looking up IATA code ${iataCode}:`, error);
    throw error;
  }
};
