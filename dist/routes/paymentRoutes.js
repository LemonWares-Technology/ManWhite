"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const paymentController_1 = require("../controllers/paymentController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.route("/initialize").post(auth_1.authenticateToken, paymentController_1.initializePayment); // Working
router.route("/verify").post(paymentController_1.verifyFlutterwavePaymentWithEmail); // Working
router.route("/stripe/initialize").post(auth_1.authenticateToken, paymentController_1.initializeStripePayment);
router.route("/stripe/verify").get(paymentController_1.verifyStripePayment);
exports.default = router;
