import { optionalAuthentication } from "./../middleware/auth";
import express from "express";
import {
  bookHotel,
  getHotelRating,
  getOfferPricing,
  hotelAutocomplete,
  hotelOfferSearch,
  searchHotels,
  searchHotelsWithOffers,
  // searchHotelsAndOffers,
} from "../controllers/hotelController";

const router = express.Router();
router.route("/search-hotel").get(searchHotels); // Working perfectly
router.route("/hotel-autocomplete").get(hotelAutocomplete); // Working perfectly
router.route("/hotel-offer-search").get(hotelOfferSearch); // Working perfectly
// router.route("/hotels-offers-search").get(searchHotelsAndOffers);
router.route("/hotels-with-offers").get(searchHotelsWithOffers); // working
router.route("/hotel-offer-search/:offerId").get(getOfferPricing); // Working perfectly
router.route("/ratings").get(getHotelRating); // Working perfectly
router.route("/book-hotel").post(optionalAuthentication, bookHotel); // Working perfectly

export default router;
