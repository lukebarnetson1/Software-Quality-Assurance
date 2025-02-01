const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const transporter = require("../../config/mailer");
const { User } = require("../../models");
require("dotenv").config();

// GET /auth/forgot - Render the forgot password page
router.get("/forgot", (req, res) => {
  res.render("auth/forgot", { title: "Forgot Password" });
});

// POST /auth/forgot - Process the forgot password form submission
router.post("/forgot", async (req, res) => {
  try {
    const { email } = req.body;
    // Find the user by email
    const user = await User.findOne({ where: { email } });
    const message = "If that email exists, a reset link has been sent.";
    if (!user) {
      req.flash("success", message);
      return res.redirect("/auth/forgot");
    }

    // Generate a reset token valid for 1 hour
    const resetToken = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const host = process.env.APP_HOST || req.get("host");
    const resetURL = `${req.protocol}://${host}/auth/reset?token=${resetToken}`;

    // Send the password reset email
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

// GET /auth/reset - Render the password reset page
router.get("/reset", (req, res) => {
  const { token } = req.query;
  if (!token) {
    req.flash("error", "Missing token");
    return res.redirect("/auth/forgot");
  }
  res.render("auth/reset", { title: "Reset Password", token });
});

// POST /auth/reset - Process the password reset form submission
router.post("/reset", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token) {
      req.flash("error", "Missing token");
      return res.redirect("/auth/forgot");
    }
    // Verify the reset token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ where: { email: decoded.email } });
    if (!user) {
      req.flash("error", "Invalid token or user no longer exists");
      return res.redirect("/auth/forgot");
    }

    // Hash the new password and update the user record
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    req.flash("success", "Password reset successful.");
    if (req.session.userId) {
      res.redirect("/auth/account-settings");
    } else {
      res.redirect("/auth/login");
    }
  } catch (err) {
    console.error(err);
    req.flash("error", "Token is invalid or has expired.");
    res.redirect("/auth/forgot");
  }
});

// GET /auth/update-password - Send a password reset email for the logged-in user
router.get("/update-password", async (req, res) => {
  try {
    const { User } = require("../../models");
    const user = await User.findByPk(req.session.userId);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/auth/account-settings");
    }

    // Generate a token for password reset
    const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const host = process.env.APP_HOST || req.get("host");
    const resetURL = `${req.protocol}://${host}/auth/reset?token=${token}`;

    // Send confirmation email for password reset
    await transporter.sendMail({
      from: `"Byte-Sized Bits" <noreply@yourapp.com>`,
      to: user.email,
      subject: "Confirm Your Password Reset",
      html: `
        <p>Hi ${user.username},</p>
        <p>You requested to reset your password. Click below to confirm:</p>
        <a href="${resetURL}">${resetURL}</a>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });

    req.flash(
      "success",
      "A confirmation email has been sent to your email address.",
    );
    res.redirect("/auth/account-settings");
  } catch (err) {
    console.error(err);
    req.flash("error", "Internal server error.");
    res.redirect("/auth/account-settings");
  }
});

module.exports = router;
