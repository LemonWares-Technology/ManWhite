"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mainApp_1 = require("./mainApp");
require("dotenv/config"); // Add this at the top
const app = (0, express_1.default)();
const port = parseInt(process.env.PORT) || 5770;
(0, mainApp_1.mainApp)(app);
const server = app.listen(port, () => {
    console.log(`❤️  ❤️`);
});
process.on("uncaughtException", (error) => {
    console.log(`Server is shutting down due to an uncaught exception: ${error === null || error === void 0 ? void 0 : error.message}`);
    process.exit(0);
});
process.on("unhandledRejection", (reason) => {
    console.log(`Server is shutting down due to an unhandled rejection: ${reason === null || reason === void 0 ? void 0 : reason.message}`);
    server.close(() => {
        process.exit(0);
    });
});
