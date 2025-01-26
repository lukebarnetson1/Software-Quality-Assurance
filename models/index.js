const sequelize = require("../config/database");
const User = require("./user");
const BlogPost = require("./blogPost");

// Sync models with the database
const initialiseModels = async () => {
  try {
    await sequelize.sync();
    console.log("Database synchronised successfully.");
  } catch (error) {
    console.error("Error syncing the database:", error);
  }
};

module.exports = {
  sequelize,
  User,
  BlogPost,
  initialiseModels,
};
