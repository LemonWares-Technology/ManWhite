import express from "express";
import {
  searchFlightPrice,
  searchFlights,
  // bookFlight,
  retrieveFlightDetails,
  deleteFlightBooking,
  getSeatMapsByFlightId,
  getOneFlightDetails,
  updateFlightStatus,
  bookFlightWithOptionalAddons,
  saveSelectedFlightOffer,
  getFlightOffers,
  getFlightOfferById,
  bookFlightAsGuest,
  updateBookingStatus,
  getAirportDetails,
  getAirlineDetailsEndpoint,
  getAirlinesByAirport,
  getAirlinesByMultipleLocations,
  getFlightOffersRandom,
  getFlightOfferDetails,
  // bookFlightWithAddons,
} from "../controllers/flightController";

const router = express.Router();
router.route("/search").get(searchFlights); // Working
router.route("/save-flight-offer").post(saveSelectedFlightOffer); // Working
router.route("/get-flight-offers").get(getFlightOffers); //Working
router.route("/get-flight-offer/:id").get(getFlightOfferById); //working
router.route("/search-flight-price").post(searchFlightPrice); //Working

router.route("/book-flight").post(bookFlightWithOptionalAddons); // Working
router.route("/book-guest-flight").post(bookFlightAsGuest); // Working
router.route("/booking/:referenceId/status").patch(updateBookingStatus);

router.route("/get-flight-details/:referenceId").get(retrieveFlightDetails); // Working
router.route("/delete-flight-details/:referenceId").delete(deleteFlightBooking); // Working
router.route("/get-seatmaps/:referenceId").get(getSeatMapsByFlightId); // Working
router.route("/get-one-flight/:flightId").get(getOneFlightDetails); // Working
router.route("/update-flight-status/:flightId").patch(updateFlightStatus); // Working

router.route("/airport-details").get(getAirportDetails); // Working
router.route("/airline-details").get(getAirlineDetailsEndpoint); // Working
router.route("/airport-airlines").get(getAirlinesByAirport); // Working
router.route("/airlines-by-airports").get(getAirlinesByMultipleLocations); //
router.route("/flight-offers").get(getFlightOffersRandom); //
router.route("/flight-offer-details").post(getFlightOfferDetails); //

// router.route("/get-all-bookings").get(getAllBookings)
// router.route("/booking-with-addons").post(bookFlightWithAddons);

export default router;
