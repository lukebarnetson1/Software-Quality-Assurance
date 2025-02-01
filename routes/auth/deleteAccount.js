const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const transporter = require("../../config/mailer");
const { User, BlogPost } = require("../../models");
const { isAuthenticated } = require("../../middlewares/auth");
const { generateToken } = require("./helpers");
require("dotenv").config();

// GET /auth/delete-account - Render the account deletion confirmation page
router.get("/delete-account", isAuthenticated, (req, res) => {
  res.render("auth/delete-account", { title: "Delete Account" });
});

// POST /auth/delete-account - Process the account deletion request by sending a confirmation email
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
    // Generate a token for account deletion confirmation
    const token = generateToken({ userId: user.id }, "1h");
    const host = process.env.APP_HOST || req.get("host");
    const confirmURL = `${req.protocol}://${host}/auth/confirm-delete-account?token=${token}`;

    // Send a confirmation email regarding account deletion
    await transporter.sendMail({
      from: `"Byte-Sized Bits" <noreply@yourapp.com>`,
      to: user.email,
      subject: "Confirm Account Deletion",
      html: `
        <p>Hello ${user.username},</p>
        <p>You requested to delete your account. This action is irreversible.</p>
        <p>Please click the link below to confirm account deletion:</p>
        <a href="${confirmURL}">${confirmURL}</a>
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
    res.redirect("/");
  }
});

// GET /auth/confirm-delete-account - Confirm and process account deletion via token
router.get("/confirm-delete-account", async (req, res) => {
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
      return res.redirect("/");
    }

    // Update blog posts to anonymise the author name
    await BlogPost.update(
      { author: "[Deleted-User]" },
      { where: { author: user.username } },
    );

    // Delete the user from the database
    await user.destroy();

    req.flash("success", "Account successfully deleted.");

    // Save and destroy the session, then clear the session cookie
    req.session.save((err) => {
      if (err) console.error(err);
      req.session.destroy((destroyErr) => {
        if (destroyErr) console.error(destroyErr);
        res.clearCookie("connect.sid");
        res.redirect("/");
      });
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Token is invalid or has expired.");
    res.redirect("/auth/account-settings");
  }
});

module.exports = router;
