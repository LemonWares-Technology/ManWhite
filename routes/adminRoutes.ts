import { Router } from "express";
import {
  createAdminAccount,
  adminLogin,
  verifyAgent,
  agentSetupProfile,
  loginAgent,
  getAgentAccountById,
  getAllAgentAccounts,
  deleteAgentAccount,
  createAgent,
  createUserByAdmin,
  getBookingAnalytics,
  getAllBookings,
  createExclusion,
  readExclusion,
  updateExclusion,
  deleteExclusion,
  createFlightAddon,
  updateFlightAddon,
  deleteFlightAddon,
  getAllFlightAddons,
  updateUserByAdmin,
  deleteUserByAdmin,
} from "../controllers/adminController";

const router = Router();

router.route("/create").post(createAdminAccount); // Tested and working perfectly
router.route("/login").post(adminLogin); // Tested and working perfectly
router.route("/create-agent/:adminId").post(createAgent); // Tested and working perfectly
router.route("/create-user/:adminId").post(createUserByAdmin); // Tested and working perfectly
router.route("/update-user/:adminId/:userId").patch(updateUserByAdmin); //Tested and working perfectly
router.route("/delete-user/:adminId/:userId").delete(deleteUserByAdmin); //Tested and working perfectly
router.route("/verify-agent/:agentId").patch(verifyAgent); // Tested and working perfectly
router.route("/setup-profile").patch(agentSetupProfile); // Tested and working perfectly
router.route("/agent-login").post(loginAgent); // Tested and working perfectly
router.route("/agent/:agentId").get(getAgentAccountById); // Tested and working perfectly
router.route("/agents").get(getAllAgentAccounts); // Tested and working perfectly
router.route("/delete-agent/:agentId").delete(deleteAgentAccount); // Tested and working perfectly
router.route("/get-bookings-analytics").get(getBookingAnalytics); // Working
router.route("/get-bookings").get(getAllBookings); // Working
router.route("/create-code").post(createExclusion); // Working
router.route("/get-code").get(readExclusion); // Working
router.route("/update-code/:iataCode").patch(updateExclusion); // Working
router.route("/delete-code/:iataCode").delete(deleteExclusion); // Working
router.route("/create-addons/:adminId").post(createFlightAddon);
router.route("/get-addons").get(getAllFlightAddons);
router.route("/update-addons").patch(updateFlightAddon);
router.route("/delete-addons").delete(deleteFlightAddon);

export default router;
