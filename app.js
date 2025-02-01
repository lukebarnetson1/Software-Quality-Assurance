const express = require("express");
const path = require("path");
const csrf = require("csurf");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const flash = require("connect-flash");
const SQLiteStore = require("connect-sqlite3")(session);
const { User, initialiseModels } = require("./models");
const blogRoutes = require("./routes/blog");
const authRoutes = require("./routes/auth");

// Load environment variables
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Set up view engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

// Parse URL-encoded and JSON data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Use cookie-parser for CSRF cookie support
app.use(cookieParser());

// Configure session middleware
app.use(
  session({
    store: new SQLiteStore({ db: "sessions.sqlite", dir: "./" }),
    secret: process.env.SESSION_SECRET || "fallbacksecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true if using HTTPS
      maxAge: 1000 * 60 * 60 * 24, // Session expires in 1 day
    },
  }),
);

// Middleware to store logged-in user's details in res.locals
app.use(async (req, res, next) => {
  if (req.session.userId) {
    const user = await User.findByPk(req.session.userId);
    res.locals.user = user || null; // If user not found, set to null
  } else {
    res.locals.user = null;
  }
  next();
});

app.use(flash());

// Middleware to pass flash messages to res.locals for use in views
app.use((req, res, next) => {
  res.locals.flashSuccess = req.flash("success");
  res.locals.flashError = req.flash("error");
  next();
});

// Set up CSRF protection with tokens stored in cookies
app.use(csrf({ cookie: true }));

// Make the CSRF token available in all views via res.locals
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// Routes
app.use("/", blogRoutes);
app.use("/auth", authRoutes); // Mount aggregated authentication routes

// Error handler for CSRF errors
app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).send("Invalid CSRF token or session expired.");
  }
  next(err);
});

// Export the app for testing
module.exports = app;

// Only start the server if this file is run directly
if (require.main === module) {
  initialiseModels().then(() => {
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  });
}
