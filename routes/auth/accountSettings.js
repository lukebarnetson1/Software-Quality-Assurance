const express = require("express");
const router = express.Router();
const { User } = require("../../models");
const { isAuthenticated } = require("../../middlewares/auth");

// GET /auth/account-settings - Render the account settings page
router.get("/account-settings", isAuthenticated, async (req, res) => {
  const user = await User.findByPk(req.session.userId);
  res.render("auth/account-settings", { title: "Account Settings", user });
});

module.exports = router;
