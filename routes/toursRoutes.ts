import { Router } from "express";
import { getTourDetailsById, searchToursByCity } from "../controllers/toursController";


const router = Router();
router.route("/get-tours").get(searchToursByCity); // Working
router.route("/get-tours/:activityId").get(getTourDetailsById); // Working

export default router;