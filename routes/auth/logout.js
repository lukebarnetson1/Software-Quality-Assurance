const express = require("express");
const router = express.Router();

// GET /auth/logout - Log out the current user
router.get("/logout", (req, res) => {
  req.flash("success", "You have been logged out.");
  // Save the session before destroying it
  req.session.save((err) => {
    if (err) console.error(err);
    // Destroy the session
    req.session.destroy((err) => {
      if (err) console.error(err);
      // Clear the session cookie
      res.clearCookie("connect.sid");
      res.redirect("/");
    });
  });
});

module.exports = router;
