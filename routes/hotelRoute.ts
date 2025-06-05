import express from 'express'
import { createCustomHotels, deleteSingleHotel, getAllHotelDetails, getSingleHotelDetailsById, searchHotels } from '../controllers/hotelController';
import multer from 'multer';

const storage: any = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { files: 7, fileSize: 5 * 1024 * 1024 },
});


const router = express.Router();
router.route("/search-hotel").get(searchHotels); // I'd come back to this particular one, it's supposed to be from Amadeus
router.route("/create-hotel").post(upload.array("images", 7), createCustomHotels); // Working
router.route("/get").get(getAllHotelDetails); // Working
router.route("/get/hotels/:hotelId").get(getSingleHotelDetailsById); // Working
router.route("/delete-hotel/:hotelId").delete(deleteSingleHotel); // Working


export default router;