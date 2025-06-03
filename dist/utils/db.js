"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const pool = new pg_1.Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
});
// Test the connection
pool.query("SELECT NOW()", (err, res) => {
    if (err)
        console.error("Database connection error:", err);
    else
        console.log("Database connected at:", res.rows[0].now);
});
