"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const marginController_1 = require("../controllers/marginController");
const router = express_1.default.Router();
router.route("/create-margin").post(marginController_1.createMargin); // Tested and Working
router.route("/get-margins").get(marginController_1.getAllMargins); //Tested and Working Perectly
router.route("/get-margin/:marginId").get(marginController_1.getMarginById); //Tested and working perfectly
router.route("/create-margin").post(marginController_1.createMargin); // Working
router.route("/update-margin").patch(marginController_1.updateMargin); // Working
router.route("/delete-margin").delete(marginController_1.deleteMargin); // Working
exports.default = router;
