import express from "express";
import { initializePayment } from "../controllers/paymentController";

const router = express.Router();

router.route("/initialize").post(initializePayment);

export default router; 