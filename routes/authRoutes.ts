import express from "express";
import {
  checkPassword,
  createAccount,
  createNewPassword,
  createPassword,
  createTraveler,
  getAllAccounts,
  getSingleUserAccount,
  loginAccount,
  resetPassword,
  updateuserAccountDetails,
} from "../controllers/authController";

const router = express.Router();
// Creating an account
router.route("/").post(createAccount);

// Updating the account's name , password after signup up
router.route("/:id/create-password").patch(createPassword);

// Email part for login
router.route("/login").post(loginAccount);

// Authenticating if the password inputed matches the email account's details
router.route("/:email/check-password").post(checkPassword);

// Reseting the password
router.route("/reset-password").post(resetPassword);

// Creating new password
router.route("/:id/complete").patch(createNewPassword);

// Getting users's details
router.route("/:id/get-details").get(getSingleUserAccount);

// Getting all account details
router.route("/users").get(getAllAccounts);

//Updating user's details
router.route("/:id/update-details").patch(updateuserAccountDetails);


//updating traveler details
router.route("/traveler").post(createTraveler);

export default router;
