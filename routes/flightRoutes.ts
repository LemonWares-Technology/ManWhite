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
  // bookFlightWithAddons,
} from "../controllers/flightController";

const router = express.Router();
router.route("/search").get(searchFlights); // Working
router.route("/search-flight-price").post(searchFlightPrice); //Working
router.route("/book-flight").post(bookFlightWithOptionalAddons); // Working
router.route("/get-flight-details/:referenceId").get(retrieveFlightDetails); // Working
router.route("/delete-flight-details/:referenceId").delete(deleteFlightBooking); // Working
router.route("/get-seatmaps/:referenceId").get(getSeatMapsByFlightId); // Working
router.route("/get-one-flight/:flightId").get(getOneFlightDetails); // Working
router.route("/update-flight-status/:flightId").patch(updateFlightStatus); // Working
// router.route("/booking-with-addons").post(bookFlightWithAddons);

export default router;
