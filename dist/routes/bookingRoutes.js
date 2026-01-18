"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bookingController_1 = require("../controllers/bookingController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.route("/book-flight/:transactionId").post(bookingController_1.bookFlight);
router
    .route("/book-flight/:userId/:transactionId")
    .post(auth_1.authenticateToken, bookingController_1.bookUserFlight);
router.route("/add-to-cart/:userId").post(auth_1.authenticateToken, bookingController_1.addFlightToCart);
router.route("/cart/:userId").get(auth_1.authenticateToken, bookingController_1.getUserCart);
router.route("/delete-cart/:userId").delete(auth_1.authenticateToken, bookingController_1.emptyUserFlightCart);
router.route("/remove-from-cart/:cartId").delete(auth_1.authenticateToken, bookingController_1.removeFlightFromCart);
router.route("/delete-booking/:bookingId").delete(auth_1.authenticateToken, bookingController_1.deleteBooking);
exports.default = router;
