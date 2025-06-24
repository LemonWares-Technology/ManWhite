import { Router } from "express";
import { bookCarTransfer, searchCars } from "../controllers/carsController";

const router = Router();
router.route("/search-cars").post(searchCars); // Working

export default router;
