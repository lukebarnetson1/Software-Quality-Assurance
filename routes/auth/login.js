const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { Sequelize, Op } = require("sequelize");
const { User } = require("../../models");
const { validateLogin } = require("../../middlewares/validation");
require("dotenv").config();

const { validationResult } = require("express-validator");

// GET /auth/login - Render the login page
router.get("/login", (req, res) => {
  res.render("auth/login", { title: "Login" });
});

// POST /auth/login - Handle login form submission
router.post("/login", validateLogin, async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Render the login page with validation errors if any
    return res.status(422).render("auth/login", {
      title: "Login",
      errors: errors.array(),
      oldInput: req.body,
    });
  }

  const { identifier, password, rememberMe } = req.body;

  try {
    // Find the user by email or username (username matching is case-insensitive)
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: identifier },
          Sequelize.where(
            Sequelize.fn("lower", Sequelize.col("username")),
            Sequelize.fn("lower", identifier),
          ),
        ],
      },
    });

    if (!user) {
      req.flash("error", "Invalid email/username or password");
      return res.redirect("/auth/login");
    }
    if (!user.isVerified) {
      req.flash("error", "Please verify your email before logging in.");
      return res.redirect("/auth/login");
    }
    // Compare the provided password with the stored hashed password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      req.flash("error", "Invalid email/username or password");
      return res.redirect("/auth/login");
    }

    // Store the user ID in session for authentication
    req.session.userId = user.id;
    // Set session cookie max age if "remember me" is selected
    if (rememberMe) {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 7; // 7 days
    }

    req.flash("success", `Welcome back, ${user.username}!`);
    res.redirect("/");
  } catch (err) {
    console.error(err);
    req.flash("error", "Internal server error.");
    res.redirect("/auth/login");
  }
});

module.exports = router;
