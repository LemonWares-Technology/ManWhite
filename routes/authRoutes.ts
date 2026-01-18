import express from "express";
import {
  checkPassword,
  createAccount,
  createGuestUser,
  createNewPassword,
  createPassword,
  createTraveler,
  deleteUserById,
  getAllAccounts,
  getAllGuestUsers,
  getAllTravelers,
  getGuestUserById,
  getSingleUserAccount,
  getTravelerById,
  getTravelerForAmadeusBooking,
  getTravelersForAmadeusBooking,
  loginAccount,
  requestPasswordReset,
  resetPassword,
  updateTravelerDetails,
  updateuserAccountDetails,
  verifyAccount,
  logout,
  refreshTokens,
} from "../controllers/authController";
import { authenticateToken, authenticateAdmin } from "../middleware/auth";

const router = express.Router();
// Creating an account
router.route("/").post(createAccount);

// Verify account code
router.route("/verify-account").post(verifyAccount);

// Updating the account's name , password after signup up
router.route("/:id/create-password").patch(createPassword);

// Email part for login
router.route("/login").post(loginAccount);

// Authenticating if the password inputed matches the email account's details
router.route("/:email/check-password").post(checkPassword); //Tested and working perfectly

router.route("/logout").post(logout);
router.route("/refresh-token").post(refreshTokens);

router.route("/user/:userId").delete(deleteUserById);

// Requesting reset the password
router.route("/request-reset-password").post(requestPasswordReset);

// Resetting password
router.route("/reset-password").post(resetPassword);

// Creating new password
router.route("/:id/complete").patch(createNewPassword);

// Getting users's details (User or Admin)
router.route("/:id/get-details").get(authenticateToken, getSingleUserAccount);

// Getting all account details (Admins only)
router.route("/users").get(authenticateAdmin, getAllAccounts);

//Updating user's details
router.route("/:id/update-details").patch(authenticateToken, updateuserAccountDetails);

//updating traveler details
router.route("/traveler").post(createTraveler);
//getting all travelers details
router.route("/travelers").get(getAllTravelers);

router.route("/traveler/:id/amadeus").get(getTravelerForAmadeusBooking);

router.route("/travelers/amadeus").get(getTravelersForAmadeusBooking);

//getting one traveler details
router.route("/traveler/:id").get(getTravelerById);
//updating one traveler details
router.route("/traveler/:id").put(updateTravelerDetails);

router.route("/guest-user").post(createGuestUser);

router.route("/guest-users").get(getAllGuestUsers);
router.route("/guest-user/:id").get(getGuestUserById);

export default router;
