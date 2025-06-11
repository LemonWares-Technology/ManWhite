"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const router = express_1.default.Router();
// Creating an account
router.route("/").post(authController_1.createAccount);
// Updating the account's name , password after signup up
router.route("/:id/create-password").patch(authController_1.createPassword);
// Email part for login
router.route("/login").post(authController_1.loginAccount);
// Authenticating if the password inputed matches the email account's details
router.route("/:email/check-password").post(authController_1.checkPassword); //Tested and working perfectly
// Reseting the password
router.route("/reset-password").post(authController_1.resetPassword);
// Creating new password
router.route("/:id/complete").patch(authController_1.createNewPassword);
// Getting users's details
router.route("/:id/get-details").get(authController_1.getSingleUserAccount);
// Getting all account details
router.route("/users").get(authController_1.getAllAccounts);
//Updating user's details
router.route("/:id/update-details").patch(authController_1.updateuserAccountDetails);
//updating traveler details
router.route("/traveler").post(authController_1.createTraveler);
//getting all travelers details
router.route("/travelers").get(authController_1.getAllTravelers);
router.route("/traveler/:id/amadeus").get(authController_1.getTravelerForAmadeusBooking);
router.route("/travelers/amadeus").get(authController_1.getTravelersForAmadeusBooking);
//getting one traveler details
router.route("/traveler/:id").get(authController_1.getTravelerById);
//updating one traveler details
router.route("/traveler/:id").put(authController_1.updateTravelerDetails);
router.route("/guest-user").post(authController_1.createGuestUser);
router.route("/guest-users").get(authController_1.getAllGuestUsers);
router.route("/guest-user/:id").get(authController_1.getGuestUserById);
exports.default = router;
