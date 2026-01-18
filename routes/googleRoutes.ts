import express, { Request, Response } from "express";
import passport from "passport";

import { sendSuccess, sendError } from "../utils/apiResponse";

const router = express.Router();

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "https://manwhit.lemonwares.com.ng/auth",
    // failureRedirect: "http://localhost:5173/auth",
    session: true,
  }),
  (req: Request, res: Response) => {
    res.redirect("https://manwhit.lemonwares.com.ng/auth");
    // res.redirect("http://localhost:5173/home");
  }
);

const currentUserHandler: express.RequestHandler = (req, res) => {
  if ((req as any).isAuthenticated()) {
    sendSuccess(res, "User authenticated", (req as any).user);
  } else {
    sendError(res, "Not authenticated", 401);
  }
};

router.get("/current-user", currentUserHandler);

router.get("/logout", (req: Request, res: Response) => {
  (req as any).logOut(() => {
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    // res.redirect("http://localhost:5173/auth");
    res.redirect("https://manwhit.lemonwares.com.ng/auth");
  });
});

export default router;
