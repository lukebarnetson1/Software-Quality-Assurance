const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { Sequelize, Op } = require("sequelize");
const { User } = require("../../models");
const { validateSignUp } = require("../../middlewares/validation");
const { sendVerificationEmail } = require("./helpers");
require("dotenv").config();

const { validationResult } = require("express-validator");

// GET /auth/signup - Render the signup page
router.get("/signup", (req, res) => {
  res.render("auth/signup", { title: "Sign Up" });
});

// POST /auth/signup - Handle user signup submission
router.post("/signup", validateSignUp, async (req, res) => {
  const { email, username, password } = req.body;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Flash error messages if validation fails
    req.flash(
      "error",
      errors
        .array()
        .map((err) => err.msg)
        .join(" | "),
    );
    return res.status(422).render("auth/signup", {
      title: "Sign Up",
      errors: errors.array(),
      oldInput: req.body,
    });
  }

  try {
    // Check if a user with the given email or username already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email },
          Sequelize.where(
            Sequelize.fn("lower", Sequelize.col("username")),
            Sequelize.fn("lower", username),
          ),
        ],
      },
    });

    if (existingUser) {
      // Flash an error message if email or username is already in use
      if (existingUser.email === email) {
        req.flash("error", "Email address already in use.");
      } else {
        req.flash("error", "Username already in use.");
      }
      return res.redirect("/auth/signup");
    }

    // Hash the password before storing it securely
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create the new user in the database
    const newUser = await User.create({
      email,
      username,
      password: hashedPassword,
      isVerified: false,
    });

    try {
      // Send a verification email to the new user
      await sendVerificationEmail(newUser, req);
      req.flash(
        "success",
        "Signup successful! Check your email to verify your account.",
      );
      res.redirect("/auth/login");
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      req.flash(
        "error",
        "Verification email failed to send. Please ensure the email address is valid.",
      );
      res.redirect("/auth/signup");
    }
  } catch (err) {
    console.error("Signup failed:", err);
    req.flash("error", "Internal server error.");
    res.redirect("/auth/signup");
  }
});

module.exports = router;
