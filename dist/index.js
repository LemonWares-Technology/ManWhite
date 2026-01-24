"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mainApp_1 = require("./mainApp");
require("dotenv/config"); // Add this at the top
const app = (0, express_1.default)();
const port = parseInt(process.env.PORT) || 5000;
(0, mainApp_1.mainApp)(app);
const server = app.listen(port, "0.0.0.0", () => {
    console.log("");
    console.log("🚀 Server is running!");
    console.log(`📡 Listening on http://localhost:${port}`);
    console.log(`📡 Network: http://192.168.114.68:${port}`);
    console.log(`🏥 Health check: http://localhost:${port}/health`);
    console.log("");
});
process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
    process.exit(1);
});
process.on("unhandledRejection", (reason) => {
    console.error("❌ Unhandled Rejection:", reason);
    server.close(() => {
        process.exit(1);
    });
});
