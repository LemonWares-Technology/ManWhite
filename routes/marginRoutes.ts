import express from "express";
import {
  createMargin,
  deleteMargin,
  updateMargin,
} from "../controllers/marginController";

const router = express.Router();
router.route("/create-margin").post(createMargin); // Working
router.route("/update-margin").patch(updateMargin); // Working
router.route("/delete-margin").delete(deleteMargin); // Working
export default router;
