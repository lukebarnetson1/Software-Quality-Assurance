const sequelize = require("../config/database");
const User = require("./user");
const BlogPost = require("./blogPost");

// Sync models with the database
const initialiseModels = async () => {
  try {
    // Drop and re-create tables only in development or test environments
    const resetDB = process.env.RESET_DB === "true";
    await sequelize.sync({ force: resetDB });

    if (resetDB) {
      console.log("Database reset and re-synchronised successfully.");
    } else {
      console.log("Database synchronised successfully.");
    }
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
