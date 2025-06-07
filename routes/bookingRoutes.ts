import express from "express";
import {
  addFlightToCart,
  bookFlight,
  bookUserFlight,
  getUserCart,
  removeFlightFromCart,
} from "../controllers/bookingController";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();
router.route("/book-flight/:transactionId").post(bookFlight);
router.route("/book-flight/:userId/:transactionId").post(authenticateToken, bookUserFlight);
router.route("/add-to-cart/:userId").post(addFlightToCart);
// authenticateToken,
router.route("/cart/:userId", ).get(getUserCart);
router
  .route("/remove-from-cart/:cartId")
  .delete( removeFlightFromCart);
// authenticateToken,
export default router;
