import express from "express";
import { mainApp } from "./mainApp";
import "dotenv/config"; // Add this at the top

const app = express();

const port: number = parseInt(process.env.PORT!) || 5000;

mainApp(app);
const server = app.listen(port, "0.0.0.0", () => {
  console.log("");
  console.log("🚀 Server is running!");
  console.log(`📡 Listening on http://localhost:${port}`);
  console.log(`📡 Network: http://192.168.114.68:${port}`);
  console.log(`🏥 Health check: http://localhost:${port}/health`);
  console.log("");
});

process.on("uncaughtException", (error: any) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason: any) => {
  console.error("❌ Unhandled Rejection:", reason);
  server.close(() => {
    process.exit(1);
  });
});
