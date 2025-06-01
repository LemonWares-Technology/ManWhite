"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const router = (0, express_1.Router)();
router.post("/create", adminController_1.createAdminAccount); // Tested and working perfectly
router.post("/login", adminController_1.adminLogin); // Tested and working perfectly
router.post("/create-agent", adminController_1.createAgent); // Tested and working perfectly
router.patch("/verify-agent/:agentId", adminController_1.verifyAgent); // Tested and working perfectly
router.patch("/setup-profile", adminController_1.agentSetupProfile); // Tested and working perfectly
router.post("/agent-login", adminController_1.loginAgent); // Tested and working perfectly
router.get("/agent/:agentId", adminController_1.getAgentAccountById); // Tested and working perfectly
router.route("/agents").get(adminController_1.getAllAgentAccounts); // Tested and working perfectly
router.delete("/delete-agent/:agentId", adminController_1.deleteAgentAccount); // Tested and working perfectly
exports.default = router;
