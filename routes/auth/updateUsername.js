const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const transporter = require("../../config/mailer");
const { Sequelize } = require("sequelize");
const { User, BlogPost } = require("../../models");
const { isAuthenticated } = require("../../middlewares/auth");
const { validateUpdateUsername } = require("../../middlewares/validation");
const { generateToken } = require("./helpers");
require("dotenv").config();

const { validationResult } = require("express-validator");

// GET /auth/update-username - Render the update username form
router.get("/update-username", isAuthenticated, (req, res) => {
  res.render("auth/update-username", { title: "Update Username" });
});

// POST /auth/update-username - Process the username update request
router.post(
  "/update-username",
  isAuthenticated,
  validateUpdateUsername,
  async (req, res) => {
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
      const existingUser = await User.findOne({
        where: Sequelize.where(
          Sequelize.fn("lower", Sequelize.col("username")),
          Sequelize.fn("lower", newUsername),
        ),
      });
      if (existingUser) {
        req.flash("error", "Username already in use.");
        return res.redirect("/auth/update-username");
      }
      // Generate a token containing the user ID and the new username
      const token = generateToken({ userId: user.id, newUsername }, "1h");
      const host = process.env.APP_HOST || req.get("host");
      const confirmURL = `${req.protocol}://${host}/auth/confirm-update-username?token=${token}`;

      // Send a confirmation email to the user's email address
      await transporter.sendMail({
        from: `"Byte-Sized Bits" <noreply@yourapp.com>`,
        to: user.email,
        subject: "Confirm Username Change",
        html: `
        <p>Hello ${user.username},</p>
        <p>You requested to change your username to <strong>${newUsername}</strong>. Please click the link below to confirm this change:</p>
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
      res.redirect("/auth/update-username");
    }
  },
);

// GET /auth/confirm-update-username - Confirm the username update via token
router.get("/confirm-update-username", async (req, res) => {
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
    const oldUsername = user.username;
    const existingUser = await User.findOne({
      where: Sequelize.where(
        Sequelize.fn("lower", Sequelize.col("username")),
        Sequelize.fn("lower", decoded.newUsername),
      ),
    });
    if (existingUser) {
      req.flash("error", "Username already in use.");
      return res.redirect("/auth/account-settings");
    }
    // Update the user's username and save changes
    user.username = decoded.newUsername;
    await user.save();
    // Update all blog posts to reflect the new username for the author
    await BlogPost.update(
      { author: decoded.newUsername },
      { where: { author: oldUsername } },
    );

    req.flash("success", "Username updated successfully.");
    res.redirect("/auth/account-settings");
  } catch (err) {
    console.error(err);
    req.flash("error", "Token is invalid or has expired.");
    res.redirect("/auth/account-settings");
  }
});

module.exports = router;
