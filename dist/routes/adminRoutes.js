"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const router = (0, express_1.Router)();
router.route("/create").post(adminController_1.createAdminAccount); // Tested and working perfectly
router.route("/login").post(adminController_1.adminLogin); // Tested and working perfectly
router.route("/create-agent/:adminId").post(adminController_1.createAgent); // Tested and working perfectly
router.route("/create-user/:adminId").post(adminController_1.createUserByAdmin); // Tested and working perfectly
router.route("/update-user/:adminId/:userId").patch(adminController_1.updateUserByAdmin); //Tested and working perfectly
router.route("/delete-user/:adminId/:userId").delete(adminController_1.deleteUserByAdmin); //Tested and working perfectly
router.route("/verify-agent/:agentId").patch(adminController_1.verifyAgent); // Tested and working perfectly
router.route("/setup-profile").patch(adminController_1.agentSetupProfile); // Tested and working perfectly
router.route("/agent-login").post(adminController_1.loginAgent); // Tested and working perfectly
router.route("/agent/:agentId").get(adminController_1.getAgentAccountById); // Tested and working perfectly
router.route("/agents").get(adminController_1.getAllAgentAccounts); // Tested and working perfectly
router.route("/delete-agent/:agentId").delete(adminController_1.deleteAgentAccount); // Tested and working perfectly
router.route("/get-bookings-analytics").get(adminController_1.getBookingAnalytics); // Working
router.route("/get-bookings").get(adminController_1.getAllBookings); // Working
router.route("/create-code").post(adminController_1.createExclusion); // Working
router.route("/get-code").get(adminController_1.readExclusion); // Working
router.route("/update-code/:iataCode").patch(adminController_1.updateExclusion); // Working
router.route("/delete-code/:iataCode").delete(adminController_1.deleteExclusion); // Working
router.route("/create-addons/:adminId").post(adminController_1.createFlightAddon);
router.route("/get-addons").get(adminController_1.getAllFlightAddons);
router
    .route("/add-addons-to-flight-offers/:flightOfferId")
    .patch(adminController_1.addExistingAddonsToFlightOffer); //Working
router.route("/addons/:flightOfferId/").delete(adminController_1.removeAddonsFromFlightOffer);
router.route("/update-addons").patch(adminController_1.updateFlightAddon);
router.route("/delete-addons/:id").delete(adminController_1.deleteFlightAddon);
/// Sending emails
/// Sending emails for CRM
// router.route("/send-email").post(sendEmailCampaign);
// transactional emails
router.route("/send-email").post(adminController_1.sendEmailBookingProcessController);
router.route("/get-role").get(adminController_1.getUserRole);
exports.default = router;
