import express from "express";
import {
  initializePayment,
  initializeStripePayment,
  verifyFlutterwavePaymentWithEmail,
  verifyStripePayment,
} from "../controllers/paymentController";

const router = express.Router();

router.route("/initialize").post(initializePayment);
router.route("/verify").post(verifyFlutterwavePaymentWithEmail);
router.route("/stripe/initialize").post(initializeStripePayment);
router.route("/stripe/verify").get(verifyStripePayment);
export default router;
