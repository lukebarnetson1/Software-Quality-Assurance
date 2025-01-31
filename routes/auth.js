const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const transporter = require("../config/mailer");
const { BlogPost, User } = require("../models");
const { Sequelize, Op } = require("sequelize");
const { isAuthenticated } = require("../middlewares/auth");
require("dotenv").config();
const {
  validateSignUp,
  validateLogin,
  validateUpdateUsername,
} = require("../middlewares/validation");

// Helpers
function generateToken(payload, expiresIn = "1h") {
  // Sign a JWT that expires in 1 hour
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

async function sendVerificationEmail(user, req) {
  // Generate a JWT
  const token = generateToken({ email: user.email });

  // Use the correct host
  const host = process.env.APP_HOST || req.get("host");
  const verificationURL = `${req.protocol}://${host}/auth/verify?token=${token}`;

  await transporter.sendMail({
    from: `"Byte-Sized Bits" <noreply@yourapp.com>`,
    to: user.email,
    subject: "Please verify your email",
    html: `
      <p>Hi ${user.username},</p>
      <p>Click below to verify your email (valid for 1 hour):</p>
      <a href="${verificationURL}">${verificationURL}</a>
    `,
  });
}

// SIGN UP
router.get("/signup", (req, res) => {
  res.render("auth/signup", { title: "Sign Up" });
});

router.post("/signup", validateSignUp, async (req, res) => {
  const { email, username, password } = req.body;

  // Check for validation errors
  const { validationResult } = require("express-validator");
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Store them in flash and re-render
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
    // Check if email or username is already used
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
      if (existingUser.email === email) {
        req.flash("error", "Email address already in use.");
      } else {
        req.flash("error", "Username already in use.");
      }
      return res.redirect("/auth/signup");
    }

    // Hash & create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      email,
      username,
      password: hashedPassword,
      isVerified: false,
    });

    try {
      // Attempt to send verification email
      await sendVerificationEmail(newUser, req);
      // If successful, inform the user to check their email
      req.flash(
        "success",
        "Signup successful! Check your email to verify your account.",
      );
      res.redirect("/auth/login");
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      // Inform the user that sign-up was successful but email sending failed
      req.flash(
        "error",
        "Verification email failed to send. Please ensure the email address is valid.",
      );
      res.redirect("/auth/signup");
    }

    // Redirect to login page regardless of email sending success
  } catch (err) {
    console.error("Signup failed:", err);
    req.flash("error", "Internal server error.");
    res.redirect("/auth/signup");
  }
});

// EMAIL VERIFICATION
router.get("/verify", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      req.flash("error", "Missing token");
      return res.redirect("/auth/login");
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ where: { email: decoded.email } });
    if (!user) {
      req.flash("error", "Invalid token or user no longer exists.");
      return res.redirect("/auth/login");
    }
    if (user.isVerified) {
      req.flash("success", "Account already verified. You are now logged in.");
      return res.redirect("/");
    }
    user.isVerified = true;
    await user.save();
    req.flash("success", "Email verified! You are now logged in.");
    res.redirect("/");
  } catch (err) {
    console.error(err);
    req.flash("error", "Token is invalid or has expired.");
    res.redirect("/auth/login");
  }
});

// LOGIN
router.get("/login", (req, res) => {
  res.render("auth/login", { title: "Login" });
});

router.post("/login", validateLogin, async (req, res) => {
  // Manual check of validation error
  const { validationResult } = require("express-validator");
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Inline errors:
    return res.status(422).render("auth/login", {
      title: "Login",
      errors: errors.array(),
      oldInput: req.body,
    });
  }

  const { identifier, password, rememberMe } = req.body;

  try {
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
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      req.flash("error", "Invalid email/username or password");
      return res.redirect("/auth/login");
    }

    // Save to session
    req.session.userId = user.id;
    if (rememberMe) {
      // Extend session cookie life
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 7;
    }

    req.flash("success", `Welcome back, ${user.username}!`);
    res.redirect("/");
  } catch (err) {
    console.error(err);
    req.flash("error", "Internal server error.");
    res.redirect("/auth/login");
  }
});

// LOGOUT
router.get("/logout", (req, res) => {
  req.flash("success", "You have been logged out.");
  req.session.save((err) => {
    if (err) console.error(err);
    req.session.destroy((err) => {
      if (err) console.error(err);
      res.clearCookie("connect.sid");
      res.redirect("/");
    });
  });
});

// FORGOT PASSWORD
router.get("/forgot", (req, res) => {
  res.render("auth/forgot", { title: "Forgot Password" });
});

router.post("/forgot", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });

    // Always send the same flash so we don't leak info about existing emails
    const message = "If that email exists, a reset link has been sent.";
    if (!user) {
      req.flash("success", message);
      return res.redirect("/auth/forgot");
    }

    const resetToken = generateToken({ email: user.email }, "1h");
    const host = process.env.APP_HOST || req.get("host");
    const resetURL = `${req.protocol}://${host}/auth/reset?token=${resetToken}`;
    await transporter.sendMail({
      from: `"Byte-Sized Bits" <noreply@yourapp.com>`,
      to: user.email,
      subject: "Password Reset",
      html: `
        <p>You requested a password reset.</p>
        <p>Click below to reset (valid for 1 hour):</p>
        <a href="${resetURL}">${resetURL}</a>
      `,
    });

    req.flash("success", message);
    res.redirect("/auth/forgot");
  } catch (err) {
    console.error(err);
    req.flash("error", "Internal server error.");
    res.redirect("/auth/forgot");
  }
});

// RESET PASSWORD
router.get("/reset", (req, res) => {
  const { token } = req.query;
  if (!token) {
    req.flash("error", "Missing token");
    return res.redirect("/auth/forgot");
  }
  res.render("auth/reset", { title: "Reset Password", token });
});

router.post("/reset", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token) {
      req.flash("error", "Missing token");
      return res.redirect("/auth/forgot");
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ where: { email: decoded.email } });
    if (!user) {
      req.flash("error", "Invalid token or user no longer exists");
      return res.redirect("/auth/forgot");
    }

    // Update password
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    req.flash("success", "Password reset successful. You can now log in.");
    res.redirect("/auth/login");
  } catch (err) {
    console.error(err);
    req.flash("error", "Token is invalid or has expired.");
    res.redirect("/auth/forgot");
  }
});

// UPDATE EMAIL
router.get("/update-email", isAuthenticated, (req, res) => {
  res.render("auth/update-email", { title: "Update Email Address" });
});

router.post("/update-email", async (req, res) => {
  if (!req.session.userId) {
    req.flash("error", "You must be logged in to update your email.");
    return res.redirect("/auth/login");
  }

  try {
    const { newEmail } = req.body;
    const user = await User.findByPk(req.session.userId);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/");
    }
    // Check if already in use
    const existingUser = await User.findOne({ where: { email: newEmail } });
    if (existingUser) {
      req.flash("error", "Email already in use by another account.");
      return res.redirect("/");
    }
    user.email = newEmail;
    user.isVerified = false;
    await user.save();
    await sendVerificationEmail(user, req);

    req.flash(
      "success",
      "Email updated. Check inbox to verify your new email.",
    );
    res.redirect("/");
  } catch (err) {
    console.error(err);
    req.flash("error", "Internal server error.");
    res.redirect("/");
  }
});

// UPDATE USERNAME
router.get("/update-username", isAuthenticated, (req, res) => {
  res.render("auth/update-username", { title: "Update Username" });
});

router.post(
  "/update-username",
  isAuthenticated,
  validateUpdateUsername,
  async (req, res) => {
    const { validationResult } = require("express-validator");
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash(
        "error",
        errors
          .array()
          .map((err) => err.msg)
          .join(" | "),
      );
      return res.redirect("/auth/update-username");
    }

    try {
      const { newUsername } = req.body;
      const user = await User.findByPk(req.session.userId);
      if (!user) {
        req.flash("error", "User not found.");
        return res.redirect("/");
      }

      // Check if username already used
      const existingUser = await User.findOne({
        where: Sequelize.where(
          Sequelize.fn("lower", Sequelize.col("username")),
          Sequelize.fn("lower", newUsername),
        ),
      });
      if (existingUser) {
        req.flash("error", "Username already in use");
        return res.redirect("/auth/update-username");
      }

      user.username = newUsername;
      await user.save();

      req.flash("success", "Username updated successfully.");
      res.redirect("/auth/update-username");
    } catch (err) {
      console.error(err);
      req.flash("error", "Internal server error.");
      res.redirect("/auth/update-username");
    }
  },
);

// DELETE ACCOUNT
router.get("/delete-account", isAuthenticated, (req, res) => {
  res.render("auth/delete-account", { title: "Delete Username" });
});

router.post("/delete-account", async (req, res) => {
  if (!req.session.userId) {
    req.flash("error", "Not logged in.");
    return res.redirect("/auth/login");
  }
  try {
    const user = await User.findByPk(req.session.userId);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/");
    }
    // Change author of all posts belonging to that user to "[Deleted-User]"
    await BlogPost.update(
      { author: "[Deleted-User]" },
      { where: { author: user.username } },
    );
    await user.destroy();
    req.flash("success", "Account deleted successfully.");
    req.session.destroy((err) => {
      if (err) console.error(err);
      res.clearCookie("connect.sid");
      res.redirect("/");
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Internal server error.");
    res.redirect("/");
  }
});

module.exports = router;
