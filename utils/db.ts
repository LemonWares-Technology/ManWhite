import { Pool } from "pg";

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
});

// Test the connection
pool.query("SELECT NOW()", (err: any, res: any) => {
  if (err) console.error("Database connection error:", err);
  else console.log("Database connected at:", res.rows[0].now);
});
