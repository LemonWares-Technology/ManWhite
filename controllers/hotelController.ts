import { Request, Response } from "express";
import getAmadeusToken from "../utils/getToken";
import axios from "axios";
import { streamUpload } from "../config/streamifier";
import { PrismaClient } from "@prisma/client";

const baseURL: string = "https://test.api.amadeus.com";

const prisma = new PrismaClient();

// Search Endpoint working
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

export async function searchOneHotelDetail(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { hotelIds } = req.query;

    if (!hotelIds) {
      return res.status(400).json({
        message: `Missing required query parameters: HotelIds is required.`,
      });
    }

    const token = await getAmadeusToken();

    const hotelResponse = await axios.get(
      `${baseURL}/v1/reference-data/locations/hotels/by-hotels`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          hotelIds,
        },
      }
    );

    return res.status(200).json({
      message: `Hotel details fetched successfully`,
      data: hotelResponse?.data,
    });
  } catch (error: any) {
    console.error(`Error:`, error);

    return res.status(500).json({
      error: `Internal server error`,
    });
  }
}

export async function getOneHotelOffer(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { hotelIds } = req.query;

    if (!hotelIds) {
      return res.status(400).json({
        error: `Missing required query parameters: HotelIds is required.`,
      });
    }

    const token = await getAmadeusToken();

    const hotelResponse = await axios.get(
      `${baseURL}/v3/shopping/hotel-offers`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          hotelIds,
        },
      }
    );

    return res.status(200).json({
      message: `Hotel offers gotten successfully`,
      data: hotelResponse?.data,
    });
  } catch (error: any) {
    console.error(`Error: `, error);

    return res.status(500).json({
      error: `Internal server error`,
    });
  }
}

export async function getHotelRating(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { hotelIds } = req.query;

    if (!hotelIds) {
      return res.status(400).json({
        error: `Missing required query parameters: HotelIds is required.`,
      });
    }

    const token = await getAmadeusToken();
    const hotelResponse = await axios.get(
      `${baseURL}/v2/e-reputation/hotel-sentiments`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          hotelIds,
        },
      }
    );

    return res.status(200).json({
      message: `Hotel ratings gotten successfully`,
      data: hotelResponse?.data,
    });
  } catch (error: any) {
    console.error(`Error:`, error);

    return res.status(500).json({
      error: `Internal server error`,
    });
  }
}

export const createCustomHotels = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const {
      name,
      description,
      address,
      city,
      country,
      phone,
      email,
      website,
      rating,
      price,
    } = req.body;

    if (!name || !address || !city || !country) {
      return res.status(400).json({ error: `Missing required fields ` });
    }
    const files: any = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({
        error: `Image is required`,
      });
    }

    if (files.length > 7) {
      return res.status(400).json({ error: "Maximum 7 images allowed" });
    }

    const uploadPromises = files.map((file: any) => streamUpload(file.buffer));

    const imageUrls = await Promise.all(uploadPromises);

    const hotel = await prisma.hotel.create({
      data: {
        name,
        description,
        address,
        city,
        country,
        phone,
        email,
        website,
        rating: rating ? parseFloat(rating) : undefined,
        price: price ? parseFloat(price) : undefined,
        images: imageUrls,
      },
    });

    return res.status(201).json({
      message: `Hotel created successfully`,
      data: hotel,
    });
  } catch (error: any) {
    console.error(`Error:`, error);

    return res.status(500).json({
      error: `Internal server error`,
    });
  }
};

export async function getAllHotelDetails(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const hotels = await prisma.hotel.findMany();

    if (!hotels) {
      return res.status(404).json({ error: `Hotels not found ` });
    }

    return res.status(200).json({
      message: `Hotels successfully retrieved`,
      data: hotels,
    });
  } catch (error: any) {
    console.error(`Error:`, error);

    return res.status(500).json({
      error: `Internal server error`,
    });
  }
}

export async function getSingleHotelDetailsById(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { hotelId } = req.params;

    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });

    if (!hotel) {
      return res.status(404).json({ error: `Hotel does not exist` });
    }

    return res.status(200).json({
      message: `Hotel's details gotten successfully`,
      data: hotel,
    });
  } catch (error: any) {
    console.error(`Response:`, error);

    return res.status(500).json({
      message: `Internal server error`,
    });
  }
}

export async function deleteSingleHotel(
  req: Request,
  res: Response
): Promise<any> {
  try {
    const { hotelId } = req.params;
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });

    if (!hotel) {
      return res.status(404).json({
        error: `Hotel not found`,
      });
    }

    await prisma.hotel.delete({ where: { id: hotelId } });

    return res.status(200).json({
      message: `Hotel deleted successfully`,
    });
  } catch (error: any) {
    console.error(`Response:`, error);

    return res.status(500).json({
      error: `Internal server error`,
    });
  }
}
