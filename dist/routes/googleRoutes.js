"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("passport"));
const apiResponse_1 = require("../utils/apiResponse");
const router = express_1.default.Router();
router.get("/google", passport_1.default.authenticate("google", { scope: ["profile", "email"] }));
router.get("/google/callback", passport_1.default.authenticate("google", {
    failureRedirect: "https://manwhit.lemonwares.com.ng/auth",
    // failureRedirect: "http://localhost:5173/auth",
    session: true,
}), (req, res) => {
    res.redirect("https://manwhit.lemonwares.com.ng/auth");
    // res.redirect("http://localhost:5173/home");
});
const currentUserHandler = (req, res) => {
    if (req.isAuthenticated()) {
        (0, apiResponse_1.sendSuccess)(res, "User authenticated", req.user);
    }
    else {
        (0, apiResponse_1.sendError)(res, "Not authenticated", 401);
    }
};
router.get("/current-user", currentUserHandler);
router.get("/logout", (req, res) => {
    req.logOut(() => {
        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");
        // res.redirect("http://localhost:5173/auth");
        res.redirect("https://manwhit.lemonwares.com.ng/auth");
    });
});
exports.default = router;
