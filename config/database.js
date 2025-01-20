const { Sequelize } = require("sequelize");
const path = require("path");

const logging = process.env.NODE_ENV === "test" ? false : console.log;

//istanbul ignore next
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.join(__dirname, "..", "database.sqlite"),
  logging, // Suppress logging in test mode
});

module.exports = sequelize;
