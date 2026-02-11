// config/index.js
require("dotenv").config();

const config = {
  db: {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: parseInt(process.env.DB_PORT) || 5432,
  },
  isProduction: process.env.NODE_ENV === "production",
};

// Freeze the object so it can't be modified at runtime
module.exports = Object.freeze(config);
