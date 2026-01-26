import express from "express";
import {
  initializePayment,
  initializeStripePayment,
  verifyFlutterwavePaymentWithEmail,
  verifyStripePayment,
} from "../controllers/paymentController";

import { authenticateToken } from "../middleware/auth";

const router = express.Router();

router.route("/initialize").post(initializePayment); // Working - removed auth for guest bookings
router.route("/verify").post(verifyFlutterwavePaymentWithEmail); // Working
router.route("/stripe/initialize").post(initializeStripePayment); // Removed auth for guest bookings
router.route("/stripe/verify").get(verifyStripePayment);
export default router;
