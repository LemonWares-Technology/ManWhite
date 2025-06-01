import express from 'express'
import { searchHotels } from '../controllers/hotelController';

const router = express.Router();
router.route("/search-hotel").get(searchHotels);


export default router;