import express from "express";
import { initializePayment, verifyFlutterwavePayment } from "../controllers/paymentController";

const router = express.Router();

router.route("/initialize").post(initializePayment);
router.route("/payment/verify").get(verifyFlutterwavePayment);
export default router; 