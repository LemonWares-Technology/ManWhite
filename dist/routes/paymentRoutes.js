"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const paymentController_1 = require("../controllers/paymentController");
const router = express_1.default.Router();
router.route("/initialize").post(paymentController_1.initializePayment);
router.route("/payment/verify").get(paymentController_1.verifyFlutterwavePayment);
exports.default = router;
