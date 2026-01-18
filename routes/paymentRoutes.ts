import express from "express";
import {
  initializePayment,
  initializeStripePayment,
  verifyFlutterwavePaymentWithEmail,
  verifyStripePayment,
} from "../controllers/paymentController";

import { authenticateToken } from "../middleware/auth";

const router = express.Router();

router.route("/initialize").post(authenticateToken, initializePayment); // Working
router.route("/verify").post(verifyFlutterwavePaymentWithEmail); // Working
router.route("/stripe/initialize").post(authenticateToken, initializeStripePayment);
router.route("/stripe/verify").get(verifyStripePayment);
export default router;
