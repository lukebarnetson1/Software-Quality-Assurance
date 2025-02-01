const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { User } = require("../../models");
require("dotenv").config();

// GET /auth/verify - Verify the user's email address using the provided token
router.get("/verify", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      req.flash("error", "Missing token.");
      return res.redirect("/auth/login");
    }

    // Verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ where: { email: decoded.email } });

    if (!user) {
      req.flash("error", "Invalid token or user no longer exists.");
      return res.redirect("/auth/login");
    }

    if (user.isVerified) {
      req.flash("success", "Your account is already verified.");
      return res.redirect("/");
    }

    // Mark user as verified and save changes
    user.isVerified = true;
    await user.save();

    // Auto-login the user by storing their ID in the session
    req.session.userId = user.id;

    req.flash(
      "success",
      "Your email has been verified! You are now logged in.",
    );
    res.redirect("/");
  } catch (err) {
    console.error(err);
    req.flash("error", "Verification link is invalid or has expired.");
    res.redirect("/auth/login");
  }
});

module.exports = router;
