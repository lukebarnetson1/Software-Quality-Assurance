const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const transporter = require("../../config/mailer");
const { User } = require("../../models");
const { isAuthenticated } = require("../../middlewares/auth");
const { generateToken, sendVerificationEmail } = require("./helpers");
require("dotenv").config();

// GET /auth/update-email - Render the update email form (requires authentication)
router.get("/update-email", isAuthenticated, (req, res) => {
  res.render("auth/update-email", { title: "Update Email Address" });
});

// POST /auth/update-email - Process the email update request
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
    const existingUser = await User.findOne({ where: { email: newEmail } });
    if (existingUser) {
      req.flash("error", "Email already in use by another account.");
      return res.redirect("/");
    }
    // Generate a token that includes the user ID and new email address
    const token = generateToken({ userId: user.id, newEmail }, "1h");
    const host = process.env.APP_HOST || req.get("host");
    const confirmURL = `${req.protocol}://${host}/auth/confirm-update-email?token=${token}`;

    // Send a confirmation email to the user's current email address
    await transporter.sendMail({
      from: `"Byte-Sized Bits" <noreply@yourapp.com>`,
      to: user.email,
      subject: "Confirm Email Change",
      html: `
        <p>Hello ${user.username},</p>
        <p>You requested to change your email address to <strong>${newEmail}</strong>. Please click the link below to confirm this change:</p>
        <a href="${confirmURL}">${confirmURL}</a>
      `,
    });

    req.flash(
      "success",
      "A confirmation email has been sent to your current email address.",
    );
    res.redirect("/auth/account-settings");
  } catch (err) {
    console.error(err);
    req.flash("error", "Internal server error.");
    res.redirect("/");
  }
});

// GET /auth/confirm-update-email - Confirm the email update via token
router.get("/confirm-update-email", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      req.flash("error", "Missing token.");
      return res.redirect("/auth/account-settings");
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/auth/account-settings");
    }
    const existingUser = await User.findOne({
      where: { email: decoded.newEmail },
    });
    if (existingUser) {
      req.flash("error", "Email already in use by another account.");
      return res.redirect("/auth/account-settings");
    }
    // Update the user's email and mark it as unverified
    user.email = decoded.newEmail;
    user.isVerified = false;
    await user.save();
    // Send a new verification email for the updated email address
    await sendVerificationEmail(user, req);

    req.flash(
      "success",
      "Email updated successfully. Please verify your new email address.",
    );
    res.redirect("/auth/account-settings");
  } catch (err) {
    console.error(err);
    req.flash("error", "Token is invalid or has expired.");
    res.redirect("/auth/account-settings");
  }
});

module.exports = router;
