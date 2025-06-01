"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const flightController_1 = require("../controllers/flightController");
const bookingController_1 = require("../controllers/bookingController");
const router = express_1.default.Router();
router.route("/search").get(flightController_1.searchFlights); // Working
router.route("/verify-flight").post(bookingController_1.verifyFlightPrice);
exports.default = router;
