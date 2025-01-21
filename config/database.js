const { Sequelize } = require("sequelize");
const path = require("path");

// Configure database logging
const logging = process.env.NODE_ENV === "test" ? false : console.log;

// Initialise Sequelize with SQLite configuration
//istanbul ignore next
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.join(__dirname, "..", "database.sqlite"),
  logging, // Suppress logging in test mode
});

module.exports = sequelize;
