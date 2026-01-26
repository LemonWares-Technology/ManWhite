"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const flightController_1 = require("../controllers/flightController");
const rateLimitMiddleware_1 = require("../middleware/rateLimitMiddleware");
const router = express_1.default.Router();
router.route("/search").get(rateLimitMiddleware_1.locationSearchRateLimit, flightController_1.searchFlights); // Working - with rate limiting
router.route("/save-flight-offer").post(flightController_1.saveSelectedFlightOffer); // Working
router.route("/get-flight-offers").get(flightController_1.getFlightOffers); //Working
router.route("/get-flight-offer/:id").get(flightController_1.getFlightOfferById); //working
router
    .route("/search-flight-price")
    .post(rateLimitMiddleware_1.flightSearchRateLimit, flightController_1.searchFlightPrice); //Working - with rate limiting
router.route("/book-flight").post(flightController_1.bookFlightWithOptionalAddons); // Working
router.route("/book-guest-flight").post(flightController_1.bookFlightAsGuest); // Working
router.route("/booking/:referenceId/status").patch(flightController_1.updateBookingStatus);
router.route("/get-flight-details/:referenceId").get(flightController_1.retrieveFlightDetails); // Working
router.route("/delete-flight-details/:referenceId").delete(flightController_1.deleteFlightBooking); // Working
router.route("/get-seatmaps/:referenceId").get(flightController_1.getSeatMapsByFlightId); // Working
router.route("/get-one-flight/:flightId").get(flightController_1.getOneFlightDetails); // Working
router.route("/update-flight-status/:flightId").patch(flightController_1.updateFlightStatus); // Working
router.route("/airport-details").get(flightController_1.getAirportDetails); // Working
router.route("/airline-details").get(flightController_1.getAirlineDetailsEndpoint); // Working
router.route("/airport-airlines").get(flightController_1.getAirlinesByAirport); // Working
router.route("/airlines-by-airports").get(flightController_1.getAirlinesByMultipleLocations); //
router.route("/flight-offers").get(flightController_1.getFlightOffersRandom); //
router.route("/flight-offer-details").post(flightController_1.getFlightOfferDetails); //
// router.route("/get-all-bookings").get(getAllBookings)
// router.route("/booking-with-addons").post(bookFlightWithAddons);
exports.default = router;
