module.exports = {
  isAuthenticated: (req, res, next) => {
    if (req.session.userId) {
      return next(); // User is logged in, continue
    }
    req.flash("error", "You must be logged in to access this page.");
    return res.redirect("/auth/login");
  },
};
