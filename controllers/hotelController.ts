import { Request, Response } from "express";
import getAmadeusToken from "../utils/getToken";
import axios from "axios";

const baseURL: string = "https://test.api.amadeus.com";

export const searchHotels = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { keyword, subType } = req.query;

    if (!keyword || !subType) {
      return res.status(400).json({
        message:
          "Missing required query parameters: keyword and subType are required.",
      });
    }

    const allowedSubTypes = ["HOTEL_LEISURE", "HOTEL_GDS"];
    if (!allowedSubTypes.includes(String(subType).toUpperCase())) {
      return res.status(400).json({
        message: `Invalid subType. Allowed values are ${allowedSubTypes.join(
          ", "
        )}`,
      });
    }

    const token = await getAmadeusToken();
    console.log("Token:", token); // Log the token for debugging

    const hotelResponse = await axios.get(
      `${baseURL}/v1/reference-data/locations/hotels`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          subType,
          keyword,
        },
      }
    );

    console.log("Keyword:", keyword); // Log the keyword for debugging
    console.log("SubType:", subType); // Log the subType for debugging

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


// export const hotelOffers = async (req: Request, res: Response): Promise<any> => {
//     try {
//         const {}
//     } catch (error: any) {
//         return res.status(500).json({
//             message: `Error occured while searching for hotel offers`,
//             data: error?.message || "Unknown error",
//             amadeusError: error.response?.data, // include Amadeus error details in the response
//         })
//     }
// }
