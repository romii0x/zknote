import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  //ssl config here for prod
  //ssl: { rejectUnauthorized: false }
});

export async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}
