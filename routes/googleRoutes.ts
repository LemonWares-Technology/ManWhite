import express from "express";
import passport from "passport";

const router = express.Router();

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "https://manwhitareos.web.app/auth",
    // failureRedirect: "http://localhost:5173/auth",
    session: true,
  }),
  (req, res) => {
    res.redirect("https://manwhitareos.web.app/home");
    // res.redirect("http://localhost:5173/home");
  }
);

router.get("/current-user", (req: any, res: any) => {
  if (req.isAuthenticated()) {
    return res.status(200).json(req.user); // You can send more details if needed
  } else {
    return res.status(401).json({ message: "Not authenticated" });
  }
});

router.get("/logout", (req, res) => {
  req.logOut(() => {
    // res.redirect("http://localhost:5173/auth");
    res.redirect("https://manwhitareos.web.app/auth");
  });
});

export default router;
