import express from "express";
import {
  addFlightToCart,
  bookFlight,
  bookUserFlight,
  deleteBooking,
  emptyUserFlightCart,
  getUserCart,
  removeFlightFromCart,
  getUserBookingStats,
} from "../controllers/bookingController";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

router.route("/book-flight/:transactionId").post(bookFlight);

router
  .route("/book-flight/:userId/:transactionId")
  .post(authenticateToken, bookUserFlight);

router.route("/add-to-cart/:userId").post(authenticateToken, addFlightToCart);
router.route("/cart/:userId").get(authenticateToken, getUserCart);
router.route("/stats/:userId").get(authenticateToken, getUserBookingStats);
router.route("/delete-cart/:userId").delete(authenticateToken, emptyUserFlightCart);
router.route("/remove-from-cart/:cartId").delete(authenticateToken, removeFlightFromCart);
router.route("/delete-booking/:bookingId").delete(authenticateToken, deleteBooking);
export default router;
