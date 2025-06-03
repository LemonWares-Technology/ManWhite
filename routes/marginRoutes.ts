import express from "express";
import {
  createMargin,
  deleteMargin,
  getAllMargins,
  getMarginById,
  updateMargin,
} from "../controllers/marginController";

const router = express.Router();
router.route("/create-margin").post(createMargin); // Working
router.route("/get-margins").get(getAllMargins); //Tested and Working Perectly
router.route("/get-margin/:marginId").get(getMarginById); //Tested and working perfectly
router.route("/create-margin").post(createMargin); // Working
router.route("/update-margin").patch(updateMargin); // Working
router.route("/delete-margin").delete(deleteMargin); // Working
export default router;
