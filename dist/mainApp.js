"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mainApp = void 0;
const express_1 = require("express");
const cors_1 = __importDefault(require("cors"));
const flightRoutes_1 = __importDefault(require("./routes/flightRoutes"));
const bookingRoutes_1 = __importDefault(require("./routes/bookingRoutes"));
const morgan_1 = __importDefault(require("morgan"));
const express_session_1 = __importDefault(require("express-session"));
require("./controllers/passport");
const googleRoutes_1 = __importDefault(require("./routes/googleRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const hotelRoute_1 = __importDefault(require("./routes/hotelRoute"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const marginRoutes_1 = __importDefault(require("./routes/marginRoutes"));
const passport_1 = __importDefault(require("passport"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const mainApp = (app) => {
    app.use((0, express_1.json)());
    app.use((0, cors_1.default)({
        origin: "*",
        methods: ["GET", "POST", "DELETE", "PATCH"],
        credentials: true,
    }));
    app.get("/", (req, res) => {
        res.send(`<a href="#" target="_blank">Successfully gotten</a>`);
    });
    app.use((0, express_session_1.default)({
        secret: process.env.JWT,
        resave: false,
        saveUninitialized: false,
    }));
    app.use((0, morgan_1.default)("dev"));
    app.use(passport_1.default.initialize());
    app.use(passport_1.default.session());
    app.use("/account", authRoutes_1.default);
    app.use("/auth", googleRoutes_1.default);
    app.use("/flight", flightRoutes_1.default);
    app.use("/booking", bookingRoutes_1.default);
    app.use("/hotel", hotelRoute_1.default);
    app.use("/payment", paymentRoutes_1.default);
    app.use("/admin", adminRoutes_1.default);
    app.use("/margin", marginRoutes_1.default);
    app.get("/verify/:userId", (req, res) => {
        const userAgent = req.headers["user-agent"] || "";
        const { userId } = req.params;
        const isAndroid = /android/i.test(userAgent);
        const isIOS = /iphone|ipad|ipod/i.test(userAgent);
        if (isAndroid || isIOS) {
            res.redirect(`manwhitaroes://auth/completeprofile/${userId}`);
        }
        else {
            res.redirect(`https://manwhitareos.web.app/auth/${userId}`);
        }
    });
};
exports.mainApp = mainApp;
