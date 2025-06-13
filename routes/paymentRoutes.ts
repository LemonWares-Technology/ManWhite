import express from "express";
import { initializePayment, initializeStripePayment, verifyFlutterwavePayment, verifyStripePayment } from "../controllers/paymentController";

const router = express.Router();

router.route("/initialize").post(initializePayment);
router.route("/payment/verify").get(verifyFlutterwavePayment);
router.route("/stripe/initialize").post(initializeStripePayment);
router.route("/stripe/verify").get(verifyStripePayment)
export default router; 