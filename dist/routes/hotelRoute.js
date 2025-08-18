"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("./../middleware/auth");
const express_1 = __importDefault(require("express"));
const hotelController_1 = require("../controllers/hotelController");
const router = express_1.default.Router();
router.route("/search-hotel").get(hotelController_1.searchHotels); // Working perfectly
router.route("/hotel-autocomplete").get(hotelController_1.hotelAutocomplete); // Working perfectly
router.route("/hotel-offer-search").get(hotelController_1.hotelOfferSearch); // Working perfectly
// router.route("/hotels-offers-search").get(searchHotelsAndOffers);
router.route("/hotels-with-offers").get(hotelController_1.searchHotelsWithOffers); // working
router.route("/hotel-offer-search/:offerId").get(hotelController_1.getOfferPricing); // Working perfectly
router.route("/ratings").get(hotelController_1.getHotelRating); // Working perfectly
router.route("/book-hotel").post(auth_1.optionalAuthentication, hotelController_1.bookHotel); // Working perfectly
exports.default = router;
