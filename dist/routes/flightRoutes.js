"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const flightController_1 = require("../controllers/flightController");
const router = express_1.default.Router();
router.route("/search").get(flightController_1.searchFlights); // Working
router.route("/search-flight-price").post(flightController_1.searchFlightPrice); //Working
router.route("/book-flight").post(flightController_1.bookFlightWithOptionalAddons); // Working
router.route("/get-flight-details/:referenceId").get(flightController_1.retrieveFlightDetails); // Working
router.route("/delete-flight-details/:referenceId").delete(flightController_1.deleteFlightBooking); // Working
router.route("/get-seatmaps/:referenceId").get(flightController_1.getSeatMapsByFlightId); // Working
router.route("/get-one-flight/:flightId").get(flightController_1.getOneFlightDetails); // Working
router.route("/update-flight-status/:flightId").patch(flightController_1.updateFlightStatus); // Working
// router.route("/booking-with-addons").post(bookFlightWithAddons);
exports.default = router;
