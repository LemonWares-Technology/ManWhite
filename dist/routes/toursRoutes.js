"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const toursController_1 = require("../controllers/toursController");
const router = (0, express_1.Router)();
router.route("/get-tours").get(toursController_1.searchToursByCity); // Working
router.route("/get-tours/:activityId").get(toursController_1.getTourDetailsById); // Working
exports.default = router;
