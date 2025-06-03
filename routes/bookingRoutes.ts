import express from "express";
import {
  addFlightToCart,
  bookFlight,
  bookUserFlight,
  removeFlightFromCart,
} from "../controllers/bookingController";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();
router.route("/book-flight/:transactionId").post(bookFlight);
router.route("/book-flight/:userId/:transactionId").post(authenticateToken, bookUserFlight);
router.route("/add-to-cart/:userId").post(authenticateToken, addFlightToCart);
router
  .route("/remove-from-cart/:cartId")
  .delete(authenticateToken, removeFlightFromCart);

export default router;
