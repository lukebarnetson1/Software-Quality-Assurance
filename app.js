const express = require("express");
const path = require("path");
const { sequelize } = require("./models");
const blogRoutes = require("./routes/blog");

const app = express();
const port = process.env.PORT || 3000;

// View engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Routes
app.use("/", blogRoutes);

// Export the app without starting the server
module.exports = app;

// Only start the server if this file is run directly
if (require.main === module) {
  sequelize.sync().then(() => {
    // istanbul ignore next
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  });
}
