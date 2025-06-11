"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const hotelController_1 = require("../controllers/hotelController");
const multer_1 = __importDefault(require("multer"));
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: { files: 7, fileSize: 5 * 1024 * 1024 },
});
const router = express_1.default.Router();
router.route("/search-hotel").get(hotelController_1.searchHotels); // I'd come back to this particular one, it's supposed to be from Amadeus
router.route("/create-hotel").post(upload.array("images", 7), hotelController_1.createCustomHotels); // Working
router.route("/get").get(hotelController_1.getAllHotelDetails); // Working
router.route("/get/hotels/:hotelId").get(hotelController_1.getSingleHotelDetailsById); // Working
router.route("/delete-hotel/:hotelId").delete(hotelController_1.deleteSingleHotel); // Working
exports.default = router;
