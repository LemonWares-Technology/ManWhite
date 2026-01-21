import { Application, json, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import flightRoutes from "./routes/flightRoutes";
import bookingRoutes from "./routes/bookingRoutes";
import morgan from "morgan";
import session from "express-session";
import "./controllers/passport";
import googleRoutes from "./routes/googleRoutes";
import account from "./routes/authRoutes";
import hotelRoutes from "./routes/hotelRoute";
import paymentRoutes from "./routes/paymentRoutes";
import adminRoutes from "./routes/adminRoutes";
import marginRoutes from "./routes/marginRoutes";
import tourRoutes from "./routes/toursRoutes";
import carsRoutes from "./routes/CarRoutes";
import passport from "passport";
import { errorHandler } from "./middleware/errorMiddleware";
import env from "dotenv";
env.config();

export const mainApp = (app: Application) => {
  app.use(json());
  app.use(cookieParser());
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:5173",
    "http://192.168.114.68:3000",
    "http://10.0.2.2:3000", // Android Emulator
  ].filter((o): o is string => !!o);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || origin.startsWith("http://192.168.")) {
          callback(null, true);
        } else {
          callback(null, false); // Or new Error('CORS')
        }
      },
      methods: ["GET", "POST", "DELETE", "PATCH", "PUT"],
      credentials: true,
    })
  );

  app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
      message: "Manwhit Areos API is Live 🚀",
      version: "1.0.0",
      docs: `${process.env.FRONTEND_URL || "http://localhost:3000"}/docs`,
    });
  });

  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });
  app.use(
    session({
      secret: process.env.JWT!,
      resave: false,
      saveUninitialized: false,
    })
  );

  app.use(morgan("dev"));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use("/account", account);
  app.use("/auth", googleRoutes);
  app.use("/flight", flightRoutes);
  app.use("/booking", bookingRoutes);
  app.use("/hotel", hotelRoutes);
  app.use("/payment", paymentRoutes);
  app.use("/admin", adminRoutes);
  app.use("/margin", marginRoutes);
  app.use("/tours", tourRoutes);
  app.use("/cars", carsRoutes);

  app.get("/verify/:userId", (req: Request, res: Response) => {
    const userAgent = req.headers["user-agent"] || "";
    const { userId } = req.params;

    const isAndroid = /android/i.test(userAgent);
    const isIOS = /iphone|ipad|ipod/i.test(userAgent);

    if (isAndroid || isIOS) {
      res.redirect(`manwhitaroes://auth/completeprofile/${userId}`);
    } else {
      res.redirect(`https://manwhit.lemonwares.com/auth/${userId}`);
    }
  });

  // Centralized Error Handling (Must be last)
  app.use(errorHandler);
};
