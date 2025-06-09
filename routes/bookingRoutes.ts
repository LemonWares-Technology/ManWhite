import express from "express";
import {
  addFlightToCart,
  bookFlight,
  bookUserFlight,
  emptyUserFlightCart,
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
router.route("/delete-cart/:userId", ).delete(emptyUserFlightCart);
router
  .route("/remove-from-cart/:cartId")
  .delete( removeFlightFromCart);
router.route("/book-flight/:userId/:transactionId").post(bookUserFlight);
// authenticateToken,
router.route("/add-to-cart/:userId").post(addFlightToCart);
router.route("/remove-from-cart/:cartId").delete(removeFlightFromCart);
router.route("/cart/:userId").get(getUserCart);
// authenticateToken,
export default router;
