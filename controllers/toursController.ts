import { prisma } from "../lib/prisma";
import { Request, Response } from "express";
import axios from "axios";
import getAmadeusToken from "../utils/getToken";
import { sendSuccess, sendError } from "../utils/apiResponse";

const baseURL: string = `https://test.api.amadeus.com`;

// export async function searchToursByCity(
//   req: Request,
//   res: Response
// ): Promise<any> {
//   try {
//     const { cityName, radiusKM = 5 } = req.query;

//     if (!cityName || typeof cityName !== "string") {
//       return res
//         .status(400)
//         .json({ error: "cityName query parameter is required" });
//     }

//     // 1. Get Amadeus OAuth token
//     const token = await getAmadeusToken();

//     // 2. Search cities to get coordinates for all matches
//     const cityResponse: any = await axios.get(
//       `${baseURL}/v1/reference-data/locations/cities`,
//       {
//         params: {
//           keyword: cityName,
//         },
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       }
//     );

//     const cities = cityResponse.data?.data || [];
//     if (cities.length === 0) {
//       return res.status(404).json({ message: "No cities found" });
//     }

//     // 3. For each city, fetch tours/activities by radius using latitude and longitude
//     const radius = Number(radiusKM);

//     const city = cities[0];

//     const longitude = city.geoCode?.longitude;
//     const latitude = city.geoCode?.latitude;

//     const activitiesResponse: any = await axios.get(`${baseURL}/v1/shopping/activities`, {
//         params: {
//             longitude,
//             latitude,
//             radius: radius,
//         },
//         headers: {
//             Authorization: `Bearer ${token}`
//         }
//     })

//     const activities = activitiesResponse.data.data

//     return res.status(200).json({
//       message: `Found ${activities.length} tours near ${cities[0]} cities matching '${cityName}'`,
//       results: activities,
//     });
//   } catch (error: any) {
//     console.error(
//       "Error in searchToursByCity:",
//       error.response?.data || error.message
//     );
//     return res.status(500).json({
//       error: "Failed to search tours",
//       details:
//         process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// }

export async function searchToursByCity(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { cityName, radiusKM = 5 } = req.query;

    if (!cityName || typeof cityName !== "string") {
      return sendError(res, "cityName query parameter is required", 400);
    }

    // 1. Get Amadeus OAuth token
    const token = await getAmadeusToken();

    // 2. Search cities to get coordinates for all matches
    const cityResponse: any = await axios.get(
      `${baseURL}/v1/reference-data/locations/cities`,
      {
        params: {
          keyword: cityName,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const cities = cityResponse.data?.data || [];
    if (cities.length === 0) {
      return sendError(res, "No cities found", 404);
    }

    // 3. Use the first city’s coordinates
    const radius = Number(radiusKM);
    const city = cities[0];
    const longitude = city.geoCode?.longitude;
    const latitude = city.geoCode?.latitude;

    if (longitude === undefined || latitude === undefined) {
      return sendError(res, "City coordinates not found", 500);
    }

    // 4. Fetch tours/activities by radius
    const activitiesResponse: any = await axios.get(
      `${baseURL}/v1/shopping/activities`,
      {
        params: {
          longitude,
          latitude,
          radius,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const activities = activitiesResponse.data?.data || [];

    // 5. Filter out tours without price or pictures
    const filteredActivities = activities.filter(
      (tour: any) =>
        tour.price &&
        typeof tour.price.amount === "string" &&
        tour.price.amount.trim() !== "" &&
        Array.isArray(tour.pictures) &&
        tour.pictures.length > 0
    );

    return sendSuccess(res, `Found ${filteredActivities.length} tours near ${city.name} matching '${cityName}'`, filteredActivities);
  } catch (error: any) {
    console.error("Error in searchToursByCity:", error.response?.data || error.message);
    return sendError(res, "Failed to search tours", 500, error);
  }
}

export async function getTourDetailsById(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { activityId } = req.params;

    if (!activityId) {
      return sendError(res, "Missing required parameters: activityId", 400);
    }

    const token = await getAmadeusToken();

    const activity: any = await axios.get(
      `${baseURL}/v1/shopping/activities/${activityId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const activityResponse = activity.data?.data;

    return sendSuccess(res, "Success", activityResponse);
  } catch (error: any) {
    console.error(`Error:`, error);
    return sendError(res, "Internal server error", 500, error);
  }
}
