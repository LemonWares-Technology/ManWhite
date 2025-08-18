"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const carsController_1 = require("../controllers/carsController");
const router = (0, express_1.Router)();
router.route("/search-cars").post(carsController_1.searchCars); // Working
exports.default = router;
